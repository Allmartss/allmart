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
import { isS3Configured, uploadToS3, getS3PublicUrl, fileExistsInS3, downloadFromS3 } from "../lib/s3Storage";
import { requireRole } from "../lib/auth";

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
router.post("/storage/uploads/request-url", requireRole("buyer", "pm", "admin"), async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    // Always write to local disk first; if S3 is configured it mirrors in the
    // background after the PUT completes.
    ensureUploadsDir();
    const localObjectPath = newLocalObjectPath();
    const uuid = localObjectPath.replace(LOCAL_OBJECT_PREFIX, "");

    // uploadURL always points at our local PUT endpoint (browser uploads here).
    // We rewrite it to the current origin on the client side so it goes through
    // the Vite proxy correctly in dev.
    const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
    const host  = req.headers["x-forwarded-host"]  ?? req.get("host") ?? "";
    const base  = `${proto}://${host}`;
    const uploadURL = `${base}/api/storage/local/${uuid}`;

    // objectPath is what gets stored in the DB and used as the final image URL.
    // Always use the local path so images are served through our own API
    // endpoint — this works regardless of whether the S3 bucket is public.
    // The S3 mirror is for redundancy/backup, not for direct browser access.
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
router.put("/storage/local/:uuid", requireRole("buyer", "pm", "admin"), (req: Request, res: Response) => {
  const diskPath = safeLocalPath(req.params.uuid as string);
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
      const uuid = req.params.uuid as string;
      fs.promises.readFile(diskPath)
        .then((buffer) => uploadToS3(uuid, buffer, "application/octet-stream"))
        .then(() => req.log.info({ uuid }, "S3 mirror complete"))
        .catch((err) => req.log.error({ err, uuid }, "S3 mirror failed (file is safe on disk)"));
    }
  });
  ws.on("error", (err) => {
    req.log.error({ err }, "Local upload write error");
    if (!res.headersSent) res.status(500).json({ error: "Upload failed" });
  });
});

/** Detect MIME type from the first 12 bytes of a file (magic-byte sniffing). */
function detectMimeType(diskPath: string): string {
  try {
    const buf = Buffer.alloc(12);
    const fd = fs.openSync(diskPath, "r");
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    // JPEG: FF D8
    if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
    // PNG: 89 50 4E 47
    if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
    // GIF: 47 49 46
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[8] === 0x57 && buf[9] === 0x45) return "image/webp";
    // SVG / XML text
     if (buf[0] === 0x3c) return "application/octet-stream";
  } catch {
    // ignore read errors — fall through to octet-stream
  }
  return "application/octet-stream";
}

/**
 * GET /storage/local/:uuid  — serve a locally-stored upload file.
 * GET /storage/objects/local-objects/:uuid — alias used when imageUrl is stored
 *   as a /local-objects/<uuid> path (set during request-url in local mode).
 *
 * Serve order:
 *   1. Local disk (fast, always attempted first)
 *   2. S3 fallback (when local file is missing but S3 is configured)
 */
async function serveLocalFile(req: Request, res: Response) {
  const uuid = req.params.uuid as string;
  const diskPath = safeLocalPath(uuid);
  if (!diskPath) {
    res.status(400).json({ error: "Invalid file identifier" });
    return;
  }

  // 1. Serve from local disk when available
  if (fs.existsSync(diskPath)) {
    const mimeType = detectMimeType(diskPath);
    const inlineMime = /^(image\/(jpeg|png|gif|webp))$/.test(mimeType)
      ? mimeType
      : "application/octet-stream";
    res.setHeader("Content-Type", inlineMime);
    res.setHeader("Cache-Control", "private, no-store");
    if (inlineMime === "application/octet-stream") {
      res.setHeader("Content-Disposition", 'attachment; filename="file"');
    }
    res.sendFile(diskPath);
    return;
  }

  // 2. Fall back to S3 (handles case where local file was lost or only in S3)
  if (isS3Configured()) {
    try {
      const s3File = await downloadFromS3(uuid);
      if (s3File) {
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", 'attachment; filename="file"');
        res.setHeader("Cache-Control", "private, no-store");
        s3File.body.pipe(res);
        return;
      }
    } catch (err) {
      req.log.error({ err, uuid }, "S3 fallback fetch failed");
    }
  }

  res.status(404).json({ error: "File not found" });
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

/**
 * POST /admin/storage/sync
 *
 * One-time sync: reads every file in the local Allnart/ folder and uploads
 * any that are missing from S3. Already-present objects are skipped.
 * Requires S3 to be configured and admin role.
 *
 * Response: { synced: number; skipped: number; errors: string[] }
 */
router.post("/admin/storage/sync", requireRole("admin"), async (req: Request, res: Response) => {
  if (!isS3Configured()) {
    res.status(400).json({ error: "S3 is not configured. Set FILE_ACCESS_KEY_ID, FILE_SECRET_ACCESS_KEY, FILE_ENDPOINT_URL, FILE_REGION, and FILE_BUCKET first." });
    return;
  }

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    ensureUploadsDir();

    const files = fs.readdirSync(LOCAL_UPLOADS_DIR);
    req.log.info({ total: files.length }, "Starting local→S3 sync");

    for (const filename of files) {
      // Only process UUID-named files (the format used by this app).
      if (!isSafeUuid(filename)) {
        skipped++;
        continue;
      }

      try {
        const alreadyExists = await fileExistsInS3(filename);
        if (alreadyExists) {
          skipped++;
          continue;
        }

        const diskPath = path.join(LOCAL_UPLOADS_DIR, filename);
        const buffer = fs.readFileSync(diskPath);

        // Detect content type from the file's magic bytes (first 12 bytes).
        const magic = buffer.slice(0, 12);
        let contentType = "application/octet-stream";
        if (magic[0] === 0xff && magic[1] === 0xd8) contentType = "image/jpeg";
        else if (magic[0] === 0x89 && magic[1] === 0x50) contentType = "image/png";
        else if (magic[0] === 0x47 && magic[1] === 0x49) contentType = "image/gif";
        else if (magic[0] === 0x52 && magic[1] === 0x49) contentType = "image/webp";

        await uploadToS3(filename, buffer, contentType);
        synced++;
        req.log.info({ filename }, "Synced file to S3");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${filename}: ${msg}`);
        req.log.error({ filename, err }, "Failed to sync file to S3");
      }
    }

    req.log.info({ synced, skipped, errors: errors.length }, "Sync complete");
    res.json({ synced, skipped, errors });
  } catch (err) {
    req.log.error({ err }, "Storage sync failed");
    res.status(500).json({ error: "Sync failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
