import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, passwordResetCodesTable } from "@workspace/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { RedeemResetCodeBody } from "@workspace/api-zod";
import { issueSession, requireRole } from "../lib/auth";
import { sendEmail } from "./email";
import { logger } from "../lib/logger";
import { passwordResetRequestLimiter } from "../lib/rate-limit";

const router: IRouter = Router();

const TTL_MS = 30 * 60 * 1000;

function generateCode() {
  const buf = randomBytes(6).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const padded = (buf + "ABCDEFGH").slice(0, 8);
  return `${padded.slice(0, 4)}-${padded.slice(4, 8)}`;
}

async function issueCode(userId: number, scope: "user" | "admin") {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db
    .insert(passwordResetCodesTable)
    .values({ userId, code, scope, expiresAt });
  return { code, expiresAt };
}

router.post(
  "/admin/users/:id/reset-code",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const scope: "user" | "admin" = user.role === "admin" ? "admin" : "user";
    const { code, expiresAt } = await issueCode(user.id, scope);
    res.json({
      code,
      scope,
      userEmail: user.email,
      expiresAt: expiresAt.toISOString(),
    });
  },
);

router.post(
  "/admin/self-reset-code",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const me = (req as Request & { authUser: { id: number; email: string } }).authUser;
    const { code, expiresAt } = await issueCode(me.id, "admin");
    res.json({
      code,
      scope: "admin",
      userEmail: me.email,
      expiresAt: expiresAt.toISOString(),
    });
  },
);

/** Self-service forgot-password: find account and email a reset code. */
router.post("/auth/request-reset", async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) { res.status(400).json({ error: "Email required" }); return; }
  const normalized = email.trim().toLowerCase();

  // Rate limit: 3 requests per email per 15 minutes
  if (!passwordResetRequestLimiter.allow(normalized)) {
    // Still return ok to avoid enumeration; just don't send
    res.json({ ok: true });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalized));

  // Always respond OK to avoid email enumeration
  if (!user) { res.json({ ok: true }); return; }

  const scope: "user" | "admin" = user.role === "admin" ? "admin" : "user";
  const { code, expiresAt } = await issueCode(user.id, scope);

  const resetLink = `${process.env.APP_URL ?? ""}/reset-password?email=${encodeURIComponent(user.email)}&code=${encodeURIComponent(code)}`;

  sendEmail({
    to: user.email,
    subject: "Reset your AllMart password",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#e07b39;margin-bottom:8px">Password reset request</h2>
        <p>Hi <strong>${user.name}</strong>, we received a request to reset your AllMart password.</p>
        <div style="margin:24px 0;padding:20px;background:#f9f5f1;border-radius:12px;text-align:center">
          <p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#e07b39;margin:0 0 8px">${code}</p>
          <p style="font-size:12px;color:#888;margin:0">Expires ${expiresAt.toLocaleTimeString()} (30 minutes)</p>
        </div>
        <a href="${resetLink}" style="display:inline-block;background:#e07b39;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:16px">
          Reset password →
        </a>
        <p style="color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
      </div>`,
  }).catch((err) => { logger.error({ err, to: user.email }, "Password reset email failed"); });

  res.json({ ok: true });
});

router.post("/auth/redeem-reset-code", async (req: Request, res: Response) => {
  const parsed = RedeemResetCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { email, code, newPassword } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim().toUpperCase();

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail));
  if (!user) {
    res.status(400).json({ error: "Invalid email or code" });
    return;
  }

  const [resetRow] = await db
    .select()
    .from(passwordResetCodesTable)
    .where(
      and(
        eq(passwordResetCodesTable.code, normalizedCode),
        eq(passwordResetCodesTable.userId, user.id),
        isNull(passwordResetCodesTable.usedAt),
        gt(passwordResetCodesTable.expiresAt, new Date()),
      ),
    );
  if (!resetRow) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  if (resetRow.scope === "admin" && user.role !== "admin") {
    res.status(400).json({ error: "Code is not valid for this account" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  await db
    .update(passwordResetCodesTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetCodesTable.id, resetRow.id));

  await issueSession(res, user.id);
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

export default router;
