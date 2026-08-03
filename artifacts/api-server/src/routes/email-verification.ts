import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomInt } from "crypto";
import { sendEmail } from "./email";
import { loadTemplate, renderTemplate, buildVerificationCodeHtml } from "./email-templates";
import { logger } from "../lib/logger";
import { getUserFromCookie } from "../lib/auth";
import { verificationResendLimiter, verificationAttemptLimiter } from "../lib/rate-limit";

const router: IRouter = Router();

const CODE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function generateCode() {
  return String(randomInt(100000, 999999));
}

/** Send (or resend) verification code to the current user. */
router.post("/auth/send-verification", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }
  if (user.emailVerified) { res.json({ ok: true, alreadyVerified: true }); return; }

  // Rate limit: 5 resends per email per 10 minutes
  if (!verificationResendLimiter.allow(user.email)) {
    res.status(429).json({ error: "Too many requests. Please wait before requesting another code." });
    return;
  }

  const code = generateCode();
  const expiry = new Date(Date.now() + CODE_TTL_MS);

  await db.update(usersTable).set({
    emailVerificationCode: code,
    emailVerificationExpiry: expiry,
  }).where(eq(usersTable.id, user.id));

  loadTemplate("verification").then(async (template) => {
    const html = renderTemplate(
      template,
      { name: user.name, code },
      buildVerificationCodeHtml(code),
    );
    await sendEmail({ to: user.email, subject: template.subject, html });
  }).catch((err) => { logger.error({ err, to: user.email }, "Verification email failed"); });

  res.json({ ok: true });
});

/** Verify email with submitted code. */
router.post("/auth/verify-email", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }
  if (user.emailVerified) { res.json({ ok: true }); return; }

  // Rate limit: 10 attempts per user per 30 minutes
  if (!verificationAttemptLimiter.allow(String(user.id))) {
    res.status(429).json({ error: "Too many attempts. Please request a new code and try again later." });
    return;
  }

  const { code } = req.body as { code?: string };
  if (!code) { res.status(400).json({ error: "Code required" }); return; }

  if (
    user.emailVerificationCode !== code.trim() ||
    !user.emailVerificationExpiry ||
    user.emailVerificationExpiry < new Date()
  ) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  await db.update(usersTable).set({
    emailVerified: true,
    emailVerificationCode: null,
    emailVerificationExpiry: null,
  }).where(eq(usersTable.id, user.id));

  res.json({ ok: true });
});

export default router;
