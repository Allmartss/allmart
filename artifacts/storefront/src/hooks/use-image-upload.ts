import { useState } from "react";
import { requestUploadUrl } from "@workspace/api-client-react";

export type UploadResult = { objectPath: string; servingUrl: string };

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<UploadResult> {
    setError(null);
    setProgress(0);
    setIsUploading(true);
    try {
      const { uploadURL, objectPath } = await requestUploadUrl({
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadURL);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream",
        );
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Upload network error"));
        xhr.send(file);
      });

      // When S3 is configured the API returns a full https:// URL as objectPath.
      // Otherwise it's a local path like /local-objects/<uuid>.
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      const servingUrl = objectPath.startsWith("http")
        ? objectPath
        : `${base}/api/storage${objectPath}`;
      return { objectPath, servingUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }

  return { upload, isUploading, progress, error };
}
