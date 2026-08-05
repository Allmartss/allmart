function parseOrigin(value: string): string | null {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

export function trustedOrigins(): Set<string> {
  const values = [
    ...(process.env["APP_URL"] ?? "").split(","),
    ...(process.env["STOREFRONT_URL"] ?? "").split(","),
    ...(process.env["REPLIT_DOMAINS"] ?? "").split(",").map((domain) =>
      domain.trim() ? `https://${domain.trim()}` : "",
    ),
    process.env["REPLIT_DEV_DOMAIN"]
      ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
      : "",
    "http://localhost:3000",
    "http://localhost:5000",
  ];

  return new Set(
    values
      .map((value) => parseOrigin(value))
      .filter((origin): origin is string => origin !== null),
  );
}

export function isTrustedUrl(value: string): boolean {
  const origin = parseOrigin(value);
  return origin !== null && trustedOrigins().has(origin);
}

export function isAllowedRequestOrigin(origin: string): boolean {
  if (trustedOrigins().has(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (url.protocol === "http:" || url.protocol === "https:")
    );
  } catch {
    return false;
  }
}