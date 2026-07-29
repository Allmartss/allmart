import { Router, type IRouter, type Request, type Response } from "express";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireRole, getUserFromCookie } from "../lib/auth";

const router: IRouter = Router();

router.get("/notifications", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(rows);
});

router.post("/notifications/:id/read", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }
  const id = Number(req.params.id);
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, user.id)));
  res.status(204).end();
});

router.post("/notifications/read-all", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, user.id));
  res.status(204).end();
});

router.post(
  "/admin/notifications/push",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const { title, message, userIds } = req.body as {
      title: string;
      message: string;
      userIds?: number[];
    };
    if (!title || !message) {
      res.status(400).json({ error: "title and message required" });
      return;
    }

    let targets: { id: number }[];

    if (Array.isArray(userIds) && userIds.length > 0) {
      // Validate all ids are finite numbers
      const ids = userIds.filter((id) => Number.isFinite(id));
      if (ids.length === 0) {
        res.status(400).json({ error: "No valid user IDs provided" });
        return;
      }
      targets = ids.map((id) => ({ id }));
    } else {
      // Send to all users
      targets = await db.select({ id: usersTable.id }).from(usersTable);
    }

    if (targets.length === 0) { res.json({ sent: 0 }); return; }
    await db.insert(notificationsTable).values(
      targets.map((u) => ({ userId: u.id, title, message })),
    );
    res.json({ sent: targets.length });
  },
);

export default router;
