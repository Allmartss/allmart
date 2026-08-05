/**
 * Simple in-memory rate limiter — no external dependencies.
 * Suitable for single-process deployments (e.g. Replit).
 *
 * Usage:
 *   const limiter = new RateLimiter({ windowMs: 60_000, max: 5 });
 *   if (!limiter.allow(key)) { res.status(429).json({ error: "Too many requests" }); return; }
 */

interface BucketEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, BucketEntry>();
  private windowMs: number;
  private max: number;

  constructor({ windowMs, max }: { windowMs: number; max: number }) {
    this.windowMs = windowMs;
    this.max = max;
  }

  /** Returns true if the request is allowed, false if rate-limited. */
  allow(key: string): boolean {
    const now = Date.now();
    let entry = this.buckets.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 1, resetAt: now + this.windowMs };
      this.buckets.set(key, entry);
      return true;
    }

    if (entry.count >= this.max) return false;

    entry.count++;
    return true;
  }

  /** Prune expired entries (call periodically to avoid memory growth). */
  prune() {
    const now = Date.now();
    for (const [key, entry] of this.buckets) {
      if (now >= entry.resetAt) this.buckets.delete(key);
    }
  }
}

// Shared limiters — instantiated once, reused across requests.
/** 5 resend attempts per email per 10 minutes */
export const verificationResendLimiter = new RateLimiter({ windowMs: 10 * 60_000, max: 5 });
/** 10 verify attempts per user per 30 minutes, then locked out */
export const verificationAttemptLimiter = new RateLimiter({ windowMs: 30 * 60_000, max: 10 });
/** 3 password-reset requests per email per 15 minutes */
export const passwordResetRequestLimiter = new RateLimiter({ windowMs: 15 * 60_000, max: 3 });
/** 5 combined sign-in/sign-up attempts per IP and email per 15 minutes */
export const authAttemptLimiter = new RateLimiter({ windowMs: 15 * 60_000, max: 5 });

// Prune stale buckets every 15 minutes
setInterval(() => {
  verificationResendLimiter.prune();
  verificationAttemptLimiter.prune();
  passwordResetRequestLimiter.prune();
  authAttemptLimiter.prune();
}, 15 * 60_000).unref();
