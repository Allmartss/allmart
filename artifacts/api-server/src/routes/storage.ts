import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import {
  ensureUploadsDir,
  newLocalObjectPath,
  LOCAL_OBJECT_PREFIX,
  LOCAL_UPLOADS_DIR,
} from "../lib/localStorageFallback";
import { isS3Configured, uploadToS3, getS3PublicUrl } from "../lib/s3Storage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/** Validates that a string is a canonical UUID v4 (no path traversal possible). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isSafeUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/** Resolve disk path and double-check it is inside the uploads directory. */
function safeLocalPath(uuid: string): string | null {
  if (!isSafeUuid(uuid)) return null;
  const resolved = path.resolve(LOCAL_UPLOADS_DIR, uuid);
  if (!resolved.startsWith(path.resolve(LOCAL_UPLOADS_DIR) + path.sep) &&
      resolved !== path.resolve(LOCAL_UPLOADS_DIR)) return null;
  return resolved;
}

const LOCAL_UPLOAD_MAX_BYTES = 20 * 1024 * 1024; // 20 MB hard limit

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    // ── Always upload via local disk endpoint ─────────────────────────────
    // Local disk is the canonical store — upload always succeeds when disk
    // write succeeds. S3 is mirrored in the background (fire-and-forget).
    ensureUploadsDir();
    const localObjectPath = newLocalObjectPath();
    const uuid = localObjectPath.replace(LOCAL_OBJECT_PREFIX, "");
    const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
    const host  = req.headers["x-forwarded-host"]  ?? req.get("host") ?? "";
    const base  = `${proto}://${host}`;
    const uploadURL = `${base}/api/storage/local/${uuid}`;
    const objectPath = localObjectPath;
    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * PUT /storage/local/:uuid
 *
 * Local-mode upload endpoint. Receives raw file bytes and saves them to disk.
 * Only accepts canonical UUID v4 filenames issued by request-url (path-traversal safe).
 * Hard body limit: 20 MB.
 */
router.put("/storage/local/:uuid", (req: Request, res: Response) => {
  const diskPath = safeLocalPath(req.params.uuid);
  if (!diskPath) {
    res.status(400).json({ error: "Invalid upload identifier" });
    return;
  }

  ensureUploadsDir();

  let received = 0;
  const ws = fs.createWriteStream(diskPath);

  req.on("data", (chunk: Buffer) => {
    received += chunk.length;
    if (received > LOCAL_UPLOAD_MAX_BYTES) {
      ws.destroy();
      fs.unlink(diskPath, () => {});
      if (!res.headersSent) res.status(413).json({ error: "File too large (max 20 MB)" });
    }
  });

  req.pipe(ws);
  ws.on("finish", () => {
    if (res.headersSent) return;

    // Local disk write succeeded — respond immediately so the upload never
    // hangs waiting on S3. S3 mirrors in the background; errors are logged
    // but do not affect the client.
    res.status(200).json({ ok: true });

    if (isS3Configured()) {
      const uuid = req.params.uuid;
      const contentType =
        (req.headers["content-type"] as string | undefined) ??
        "application/octet-stream";
      fs.promises.readFile(diskPath)
        .then((buffer) => uploadToS3(uuid, buffer, contentType))
        .then(() => req.log.info({ uuid }, "S3 mirror complete"))
        .catch((err) => req.log.error({ err, uuid }, "S3 mirror failed (file is safe on disk)"));
    }
  });
  ws.on("error", (err) => {
    req.log.error({ err }, "Local upload write error");
    if (!res.headersSent) res.status(500).json({ error: "Upload failed" });
  });
});

/**
 * GET /storage/local/:uuid  — serve a locally-stored upload file.
 * GET /storage/objects/local-objects/:uuid — alias used when imageUrl is stored
 *   as a /local-objects/<uuid> path (set during request-url in local mode).
 */
function serveLocalFile(req: Request, res: Response) {
  const diskPath = safeLocalPath(req.params.uuid);
  if (!diskPath) {
    res.status(400).json({ error: "Invalid file identifier" });
    return;
  }
  if (!fs.existsSync(diskPath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.sendFile(diskPath);
}

router.get("/storage/local/:uuid", serveLocalFile);
router.get("/storage/objects/local-objects/:uuid", serveLocalFile);
// Canonical alias: objectPath "/local-objects/<uuid>" → servingUrl "/api/storage/local-objects/<uuid>"
router.get("/storage/local-objects/:uuid", serveLocalFile);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // --- Protected route example (uncomment when using replit-auth) ---
    // if (!req.isAuthenticated()) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }
    // const canAccess = await objectStorageService.canAccessObjectEntity({
    //   userId: req.user.id,
    //   objectFile,
    //   requestedPermission: ObjectPermission.READ,
    // });
    // if (!canAccess) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
