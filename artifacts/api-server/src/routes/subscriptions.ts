import { Router, type IRouter, type Request, type Response } from "express";
import { db, emailSubscriptionsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireRole } from "../lib/auth";

const router: IRouter = Router();

// POST /subscribe — public, no auth required
router.post("/subscribe", async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }
  try {
    await db
      .insert(emailSubscriptionsTable)
      .values({ email: email.toLowerCase().trim() })
      .onConflictDoNothing();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not save subscription" });
  }
});

// GET /admin/subscribers — admin only
router.get("/admin/subscribers", requireRole("admin"), async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(emailSubscriptionsTable)
    .orderBy(desc(emailSubscriptionsTable.subscribedAt));
  res.json(rows);
});

export default router;
