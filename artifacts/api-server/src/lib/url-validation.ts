const LOCAL_MEDIA_PATH = /^\/(?:api\/)?storage\/(?:local|local-objects|objects\/local-objects|public-objects)(?:\/|$)/;

/**
 * User-supplied media must come from the app's upload endpoints.  Arbitrary
 * URLs allow javascript: payloads, tracking pixels, and third-party content
 * to be rendered in privileged storefront/admin views.
 */
export function isSafeMediaUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || !LOCAL_MEDIA_PATH.test(trimmed)) return false;
  try {
    const url = new URL(trimmed, "https://allmart.invalid");
    return url.protocol === "https:" && LOCAL_MEDIA_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}