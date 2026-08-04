import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, referralsTable, settingsTable, adminBonusGiftsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getUserFromCookie } from "../lib/auth";

const router: IRouter = Router();

async function getSetting(key: string, fallback: string) {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? fallback;
}

router.get("/referral", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }

  const referrals = await db
    .select({
      id: referralsTable.id,
      referredId: referralsTable.referredId,
      referrerBonus: referralsTable.referrerBonus,
      referredBonus: referralsTable.referredBonus,
      referrerClaimed: referralsTable.referrerClaimed,
      createdAt: referralsTable.createdAt,
    })
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, user.id));

  const referredIds = referrals.map(r => r.referredId);
  let referred: { id: number; name: string; createdAt: Date }[] = [];
  if (referredIds.length > 0) {
    referred = await db
      .select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt })
      .from(usersTable)
      .where(eq(usersTable.id, referredIds[0]!));
    if (referredIds.length > 1) {
      for (const rid of referredIds.slice(1)) {
        const [r] = await db.select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt })
          .from(usersTable).where(eq(usersTable.id, rid));
        if (r) referred.push(r);
      }
    }
  }

  const referredMap = new Map(referred.map(r => [r.id, r]));

  const totalEarned = referrals.reduce((s, r) => s + r.referrerBonus, 0);
  const unclaimedTotal = referrals.filter(r => !r.referrerClaimed).reduce((s, r) => s + r.referrerBonus, 0);

  const note = await getSetting("referralNote", "Refer friends and earn bonus credits you can use on your next order!");

  const origin = req.headers.origin ?? `https://${req.headers.host}`;

  const adminGifts = await db
    .select()
    .from(adminBonusGiftsTable)
    .where(eq(adminBonusGiftsTable.userId, user.id));

  const now = new Date();

  res.json({
    referralCode: user.referralCode,
    referralLink: user.referralCode ? `${origin}/signup?ref=${user.referralCode}` : null,
    bonusBalance: user.bonusBalance,
    totalReferrals: referrals.length,
    totalEarned,
    unclaimedTotal,
    note,
    referrals: referrals.map(r => ({
      id: r.id,
      name: referredMap.get(r.referredId)?.name ?? "User",
      joinedAt: referredMap.get(r.referredId)?.createdAt?.toISOString() ?? r.createdAt.toISOString(),
      referrerBonus: r.referrerBonus,
      claimed: r.referrerClaimed,
    })),
    adminGifts: adminGifts.map(g => {
      const expired = g.expiresAt ? g.expiresAt < now : false;
      return {
        id: g.id,
        amount: g.amount,
        reason: g.reason,
        claimed: g.claimed,
        expired,
        expiresAt: g.expiresAt?.toISOString() ?? null,
        createdAt: g.createdAt.toISOString(),
      };
    }),
  });
});

router.post("/referral/claim", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }

  const unclaimed = await db
    .select()
    .from(referralsTable)
    .where(and(eq(referralsTable.referrerId, user.id), eq(referralsTable.referrerClaimed, false)));

  if (unclaimed.length === 0) {
    res.json({ bonusBalance: user.bonusBalance, claimed: 0 });
    return;
  }

  const total = unclaimed.reduce((s, r) => s + r.referrerBonus, 0);

  for (const r of unclaimed) {
    await db.update(referralsTable).set({ referrerClaimed: true }).where(eq(referralsTable.id, r.id));
  }

  const newBalance = Math.round((user.bonusBalance + total) * 100) / 100;
  const [updated] = await db.update(usersTable).set({ bonusBalance: newBalance }).where(eq(usersTable.id, user.id)).returning();

  res.json({ bonusBalance: updated!.bonusBalance, claimed: total });
});

router.post("/bonus/claim-admin/:giftId", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }

  const giftId = Number(req.params.giftId);
  if (!Number.isFinite(giftId)) { res.status(400).json({ error: "Invalid gift ID" }); return; }

  const [gift] = await db
    .select()
    .from(adminBonusGiftsTable)
    .where(and(eq(adminBonusGiftsTable.id, giftId), eq(adminBonusGiftsTable.userId, user.id)));

  if (!gift) { res.status(404).json({ error: "Gift not found" }); return; }
  if (gift.claimed) { res.status(400).json({ error: "Already claimed" }); return; }

  // Check expiry
  if (gift.expiresAt && gift.expiresAt < new Date()) {
    res.status(400).json({ error: "This gift has expired and can no longer be claimed." }); return;
  }

  await db.update(adminBonusGiftsTable).set({ claimed: true }).where(eq(adminBonusGiftsTable.id, giftId));

  const newBalance = Math.round((user.bonusBalance + gift.amount) * 100) / 100;
  const [updated] = await db
    .update(usersTable)
    .set({ bonusBalance: newBalance })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json({ bonusBalance: updated!.bonusBalance, claimed: gift.amount });
});

router.get("/bonus/validate", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }
  res.json({ bonusBalance: user.bonusBalance });
});

export default router;
