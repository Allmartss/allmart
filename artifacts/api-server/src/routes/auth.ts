import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, referralsTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { SignUpBody, SignInBody } from "@workspace/api-zod";
import { clearSession, getUserFromCookie, issueSession } from "../lib/auth";
import { sendEmail } from "./email";
import { loadTemplate, renderTemplate } from "./email-templates";
import { logger } from "../lib/logger";
import { authAttemptLimiter } from "../lib/rate-limit";

const router: IRouter = Router();

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function uniqueReferralCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateReferralCode();
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.referralCode, code));
    if (!existing) return code;
  }
  return generateReferralCode() + Math.floor(Math.random() * 100);
}

async function getSetting(key: string, fallback: string) {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? fallback;
}

function publicUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    tier: u.tier,
    country: u.country ?? null,
    phone: u.phone ?? null,
    sex: u.sex ?? null,
    address: u.address ?? null,
    profileComplete: u.profileComplete,
    emailVerified: u.emailVerified,
    referralCode: u.referralCode ?? null,
    bonusBalance: u.bonusBalance,
    banned: u.banned ?? false,
  };
}

router.post("/auth/signup", async (req: Request, res: Response) => {
  const parsed = SignUpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { email, name, password } = parsed.data;
  const normalized = email.trim().toLowerCase();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (!authAttemptLimiter.allow(`${ip}:${normalized}`)) {
    res.status(429).json({ error: "Too many authentication attempts. Try again later." });
    return;
  }
  const refCode = (req.body as { referralCode?: string }).referralCode?.trim().toUpperCase() ?? null;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, normalized));
  if (existing) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const referralCode = await uniqueReferralCode();
  const passwordHash = await bcrypt.hash(password, 10);

  let signupBonus = 0;
  let referrer: typeof usersTable.$inferSelect | null = null;

  if (refCode) {
    const [ref] = await db.select().from(usersTable).where(eq(usersTable.referralCode, refCode));
    if (ref) {
      referrer = ref;
      signupBonus = Number(await getSetting("referralSignupBonus", "20"));
    }
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      email: normalized,
      name,
      passwordHash,
      role: "buyer",
      referralCode,
      bonusBalance: signupBonus,
    })
    .returning();

  if (referrer && user) {
    const referrerBonus = Number(await getSetting("referralReferrerBonus", "10"));
    await db.insert(referralsTable).values({
      referrerId: referrer.id,
      referredId: user.id,
      referrerBonus,
      referredBonus: signupBonus,
    }).onConflictDoNothing();
  }

  await issueSession(req, res, user!.id);
  res.json(publicUser(user!));

  // Welcome email — fire and forget
  loadTemplate("welcome").then(async (template) => {
    const bonusText = signupBonus > 0
      ? `🎁 You've received a <strong>${signupBonus} signup bonus</strong> credited to your account!`
      : "";
    const html = renderTemplate(template, { name: user!.name, signup_bonus_text: bonusText });
    const subject = template.subject;
    await sendEmail({ to: user!.email, subject, html });
  }).catch((err) => { logger.error({ err, to: user!.email }, "Welcome email failed"); });
});

router.post("/auth/signin", async (req: Request, res: Response) => {
  const parsed = SignInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { email, password } = parsed.data;
  const normalized = email.trim().toLowerCase();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (!authAttemptLimiter.allow(`${ip}:${normalized}`)) {
    res.status(429).json({ error: "Too many authentication attempts. Try again later." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalized));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await issueSession(req, res, user.id);
  res.json(publicUser(user));

  // Login notification — fire and forget
  const loginTime = new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "full", timeStyle: "short" });
  loadTemplate("login").then(async (template) => {
    const html = renderTemplate(template, { name: user.name, login_time: `${loginTime} (Lagos)` });
    await sendEmail({ to: user.email, subject: template.subject, html });
  }).catch((err) => { logger.error({ err, to: user.email }, "Login notification email failed"); });
});

router.post("/auth/signout", async (req: Request, res: Response) => {
  await clearSession(req, res);
  res.status(204).end();
});

router.get("/auth/me", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  res.json({ user: user ? publicUser(user) : null });
});

router.patch("/auth/password", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }

  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  res.json({ ok: true });
});

export default router;
