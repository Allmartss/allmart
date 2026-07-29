import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, ordersTable, adminBonusGiftsTable } from "@workspace/db";
import { eq, sum } from "drizzle-orm";
import { getUserFromCookie } from "../lib/auth";

const router: IRouter = Router();

function publicProfile(u: typeof usersTable.$inferSelect) {
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
    referralCode: u.referralCode ?? null,
    bonusBalance: u.bonusBalance,
  };
}

router.get("/me/stats", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }

  const [spendRow] = await db
    .select({ total: sum(ordersTable.total) })
    .from(ordersTable)
    .where(eq(ordersTable.userId, user.id));

  const [pendingRow] = await db
    .select({ total: sum(adminBonusGiftsTable.amount) })
    .from(adminBonusGiftsTable)
    .where(eq(adminBonusGiftsTable.userId, user.id));

  res.json({
    totalSpend: Math.round(Number(spendRow?.total ?? 0) * 100) / 100,
    bonusBalance: user.bonusBalance,
    pendingAdminBonus: Math.round(Number(pendingRow?.total ?? 0) * 100) / 100,
  });
});

router.get("/profile", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }
  res.json(publicProfile(user));
});

router.patch("/profile", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }

  const { name, email, country, phone, sex, address, profileComplete } = req.body as {
    name?: string; email?: string; country?: string; phone?: string;
    sex?: string; address?: string; profileComplete?: boolean;
  };

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name.trim();
  if (email !== undefined) {
    const normalized = email.trim().toLowerCase();
    const [existing] = await db.select().from(usersTable)
      .where(eq(usersTable.email, normalized));
    if (existing && existing.id !== user.id) {
      res.status(409).json({ error: "That email is already taken" });
      return;
    }
    updates.email = normalized;
  }
  if (country !== undefined) updates.country = country || null;
  if (phone !== undefined) updates.phone = phone || null;
  if (sex !== undefined) updates.sex = sex || null;
  if (address !== undefined) updates.address = address || null;
  if (profileComplete !== undefined) updates.profileComplete = profileComplete;

  if (Object.keys(updates).length === 0) {
    res.json(publicProfile(user));
    return;
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
  res.json(publicProfile(updated!));
});

export default router;
