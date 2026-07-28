import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth";

const router: IRouter = Router();

router.patch("/admin/users/:id/tier", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { tier } = req.body as { tier?: number };
  if (typeof tier !== "number" || tier < 0 || tier > 5) {
    res.status(400).json({ error: "tier must be 0–5" });
    return;
  }
  const [updated] = await db.update(usersTable).set({ tier }).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: updated.id, tier: updated.tier });
});

/** Manually verify a user's email address from the admin panel. */
router.patch("/admin/users/:id/verify-email", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [updated] = await db
    .update(usersTable)
    .set({ emailVerified: true, emailVerificationCode: null, emailVerificationExpiry: null })
    .where(eq(usersTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: updated.id, emailVerified: updated.emailVerified });
});

/** Ban or unban a user. Cannot ban yourself. */
router.patch("/admin/users/:id/ban", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const authUser = (req as Request & { authUser: { id: number } }).authUser;
  if (authUser.id === id) { res.status(400).json({ error: "You can't ban yourself" }); return; }
  const { banned } = req.body as { banned?: boolean };
  if (typeof banned !== "boolean") { res.status(400).json({ error: "banned must be a boolean" }); return; }
  const [updated] = await db.update(usersTable).set({ banned }).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: updated.id, banned: updated.banned });
});

export default router;
