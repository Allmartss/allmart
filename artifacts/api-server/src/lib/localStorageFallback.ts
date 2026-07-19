/**
 * Local disk fallback for file uploads when S3 env vars are not configured.
 *
 * Files are stored in <project-root>/Allnart/ and served via
 * GET /api/storage/local/:uuid
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export const LOCAL_UPLOADS_DIR = path.resolve(process.cwd(), "Allnart");
export const LOCAL_OBJECT_PREFIX = "/local-objects/";

/** Returns true when object storage env vars are absent. */
export function isLocalMode(): boolean {
  return !process.env.PRIVATE_OBJECT_DIR && !process.env.PUBLIC_OBJECT_SEARCH_PATHS;
}

/** Ensure the uploads directory exists. */
export function ensureUploadsDir(): void {
  if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
    fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
  }
}

/** Generate a stable local object path for a new upload. */
export function newLocalObjectPath(): string {
  return `${LOCAL_OBJECT_PREFIX}${randomUUID()}`;
}

/** Derive the absolute disk path from a local object path. */
export function localObjectPathToDisk(objectPath: string): string {
  const uuid = objectPath.replace(LOCAL_OBJECT_PREFIX, "");
  return path.join(LOCAL_UPLOADS_DIR, uuid);
}

/** Resolve a local object path to its public-facing URL (relative to API base). */
export function localObjectUrl(objectPath: string, apiBase: string): string {
  const uuid = objectPath.replace(LOCAL_OBJECT_PREFIX, "");
  return `${apiBase}/storage/local/${uuid}`;
}
