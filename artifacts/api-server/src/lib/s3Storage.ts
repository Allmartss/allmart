/**
 * S3-compatible storage (Supabase / R2 / AWS S3).
 *
 * Activated when the FILE_* env vars are present.
 * Files are stored under the "Allnart/" prefix inside the configured bucket.
 *
 * Env vars:
 *   FILE_ACCESS_KEY_ID       — S3 access key id
 *   FILE_SECRET_ACCESS_KEY   — S3 secret access key
 *   FILE_ENDPOINT_URL        — full endpoint URL (e.g. https://<ref>.supabase.co/storage/v1/s3)
 *   FILE_REGION              — AWS / Supabase region (e.g. us-east-1 or ap-southeast-1)
 */
import { S3Client, PutObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { logger } from "./logger";

const S3_FOLDER = "Allnart";

export function isS3Configured(): boolean {
  return !!(
    process.env.FILE_ACCESS_KEY_ID &&
    process.env.FILE_SECRET_ACCESS_KEY &&
    process.env.FILE_ENDPOINT_URL &&
    process.env.FILE_REGION
  );
}

function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.FILE_REGION!,
    endpoint: process.env.FILE_ENDPOINT_URL!,
    credentials: {
      accessKeyId: process.env.FILE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.FILE_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
}

/**
 * Derive the S3 bucket name from FILE_BUCKET env var.
 * Throws if not set so misconfiguration is caught at upload time.
 */
function getBucketName(): string {
  const bucket = process.env.FILE_BUCKET;
  if (!bucket) throw new Error("FILE_BUCKET env var is required but not set.");
  return bucket;
}

/**
 * Build the public URL for an object.
 * For Supabase: https://<ref>.supabase.co/storage/v1/object/public/<bucket>/Allnart/<uuid>
 * For generic S3 / R2 with path-style: <endpoint>/<bucket>/Allnart/<uuid>
 */
export function getS3PublicUrl(uuid: string): string {
  const endpoint = process.env.FILE_ENDPOINT_URL!.replace(/\/$/, "");
  const bucket = getBucketName();

  // Supabase storage pattern
  if (endpoint.includes("supabase.co/storage/v1/s3")) {
    const base = endpoint.replace("/storage/v1/s3", "/storage/v1/object/public");
    return `${base}/${bucket}/${S3_FOLDER}/${uuid}`;
  }

  // Generic path-style S3 (R2, MinIO, etc.)
  return `${endpoint}/${bucket}/${S3_FOLDER}/${uuid}`;
}

/**
 * Upload a file to S3 under the Allnart/<uuid> key.
 * Returns the public URL of the uploaded file.
 */
export async function uploadToS3(
  uuid: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();
  const key = `${S3_FOLDER}/${uuid}`;

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(cmd);
  logger.info({ bucket, key }, "S3 upload complete");

  return getS3PublicUrl(uuid);
}
