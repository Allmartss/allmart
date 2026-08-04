import { Router, type IRouter, type Request, type Response } from "express";
import { db, referralsTable, usersTable, settingsTable, adminBonusGiftsTable } from "@workspace/db";
import { eq, sql as sqlExpr } from "drizzle-orm";
import { requireRole } from "../lib/auth";

const router: IRouter = Router();

async function getSetting(key: string, fallback: string) {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? fallback;
}

async function setSetting(key: string, value: string) {
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (existing) {
    await db.update(settingsTable).set({ value, updatedAt: new Date() }).where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({ key, value });
  }
}

router.get("/admin/referral-settings", requireRole("admin"), async (_req: Request, res: Response) => {
  const [referrerBonus, signupBonus, note] = await Promise.all([
    getSetting("referralReferrerBonus", "10"),
    getSetting("referralSignupBonus", "20"),
    getSetting("referralNote", "Refer friends and earn bonus credits you can use on your next order!"),
  ]);
  res.json({
    referralReferrerBonus: Number(referrerBonus),
    referralSignupBonus: Number(signupBonus),
    referralNote: note,
  });
});

router.patch("/admin/referral-settings", requireRole("admin"), async (req: Request, res: Response) => {
  const { referralReferrerBonus, referralSignupBonus, referralNote } = req.body as {
    referralReferrerBonus?: number; referralSignupBonus?: number; referralNote?: string;
  };
  if (referralReferrerBonus !== undefined) await setSetting("referralReferrerBonus", String(referralReferrerBonus));
  if (referralSignupBonus !== undefined) await setSetting("referralSignupBonus", String(referralSignupBonus));
  if (referralNote !== undefined) await setSetting("referralNote", referralNote);
  res.json({ ok: true });
});

router.get("/admin/referrals", requireRole("admin"), async (_req: Request, res: Response) => {
  const all = await db.select().from(referralsTable).orderBy(referralsTable.createdAt);

  const userIds = [...new Set([...all.map(r => r.referrerId), ...all.map(r => r.referredId)])];
  const users: { id: number; name: string; email: string }[] = [];
  for (const uid of userIds) {
    const [u] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, uid));
    if (u) users.push(u);
  }
  const userMap = new Map(users.map(u => [u.id, u]));

  res.json(all.map(r => ({
    id: r.id,
    referrer: userMap.get(r.referrerId) ?? { id: r.referrerId, name: "Unknown", email: "" },
    referred: userMap.get(r.referredId) ?? { id: r.referredId, name: "Unknown", email: "" },
    referrerBonus: r.referrerBonus,
    referredBonus: r.referredBonus,
    referrerClaimed: r.referrerClaimed,
    createdAt: r.createdAt.toISOString(),
  })));
});

/** Grant a manual bonus to a specific user — adds to their bonusBalance */
router.post("/admin/grant-bonus", requireRole("admin"), async (req: Request, res: Response) => {
  const { userId, amount, reason } = req.body as { userId?: number; amount?: number; reason?: string };
  if (!userId || !Number.isFinite(userId)) {
    res.status(400).json({ error: "userId is required" }); return;
  }
  if (!amount || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" }); return;
  }
  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, bonusBalance: usersTable.bonusBalance })
    .from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Insert gift record — mark claimed=true immediately since balance is credited right away
  const [gift] = await db.insert(adminBonusGiftsTable)
    .values({ userId, amount, reason: reason ?? null, claimed: true })
    .returning();

  // Credit the bonus to the user's spendable balance
  const [updated] = await db.update(usersTable)
    .set({ bonusBalance: sqlExpr`bonus_balance + ${amount}` })
    .where(eq(usersTable.id, userId))
    .returning({ bonusBalance: usersTable.bonusBalance });

  res.json({
    ok: true,
    userId: user.id,
    name: user.name,
    giftId: gift!.id,
    granted: amount,
    reason: reason ?? null,
    newBalance: updated!.bonusBalance,
  });
});

/** List all admin-granted bonuses with each user's current bonus balance */
router.get("/admin/bonus-grants", requireRole("admin"), async (_req: Request, res: Response) => {
  const gifts = await db
    .select({
      id: adminBonusGiftsTable.id,
      userId: adminBonusGiftsTable.userId,
      amount: adminBonusGiftsTable.amount,
      reason: adminBonusGiftsTable.reason,
      claimed: adminBonusGiftsTable.claimed,
      createdAt: adminBonusGiftsTable.createdAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      currentBalance: usersTable.bonusBalance,
    })
    .from(adminBonusGiftsTable)
    .leftJoin(usersTable, eq(adminBonusGiftsTable.userId, usersTable.id))
    .orderBy(adminBonusGiftsTable.createdAt);

  res.json(gifts.map(g => ({
    id: g.id,
    userId: g.userId,
    userName: g.userName ?? "Unknown",
    userEmail: g.userEmail ?? "",
    amount: g.amount,
    reason: g.reason,
    claimed: g.claimed,
    createdAt: g.createdAt.toISOString(),
    currentBalance: g.currentBalance ?? 0,
  })));
});

export default router;
