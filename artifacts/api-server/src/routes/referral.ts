import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, referralsTable, settingsTable } from "@workspace/db";
import { eq, and, sum } from "drizzle-orm";
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

  res.json({
    referralCode: user.referralCode,
    referralLink: user.referralCode ? `${origin}/signup?ref=${user.referralCode}` : null,
    bonusBalance: user.bonusBalance,
    pendingAdminBonus: user.pendingAdminBonus,
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

router.post("/bonus/claim-admin", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }

  if (!user.pendingAdminBonus || user.pendingAdminBonus <= 0) {
    res.json({ bonusBalance: user.bonusBalance, claimed: 0 });
    return;
  }

  const claimed = user.pendingAdminBonus;
  const newBalance = Math.round((user.bonusBalance + claimed) * 100) / 100;

  const [updated] = await db
    .update(usersTable)
    .set({ bonusBalance: newBalance, pendingAdminBonus: 0 })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json({ bonusBalance: updated!.bonusBalance, claimed });
});

router.get("/bonus/validate", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }
  res.json({ bonusBalance: user.bonusBalance });
});

export default router;
