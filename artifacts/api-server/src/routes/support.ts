import { Router, type IRouter, type Request, type Response } from "express";
import { db, supportTicketsTable, notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireRole, getUserFromCookie } from "../lib/auth";
import { sendEmail } from "./email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function escHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

router.post("/support-tickets", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  const { name, email, subject, message } = req.body as {
    name: string; email: string; subject: string; message: string;
  };
  if (!name || !email || !subject || !message) {
    res.status(400).json({ error: "All fields required" });
    return;
  }
  const [ticket] = await db
    .insert(supportTicketsTable)
    .values({ userId: user?.id ?? null, name, email, subject, message })
    .returning();

  // Forward ticket to support inbox (non-fatal)
  sendEmail({
    from: "AllMart Support <support@allmart.com>",
    to: "support@allmart.com",
    subject: `[Support] ${subject}`,
    html: `<p><strong>From:</strong> ${escHtml(name)} &lt;${escHtml(email)}&gt;</p><p><strong>Message:</strong></p><p>${escHtml(message).replace(/\n/g, "<br>")}</p>`,
  }).catch((err) => { logger.error({ err }, "Support ticket forward email failed"); });

  res.status(201).json(ticket);
});

router.get("/support-tickets/mine", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }
  const rows = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, user.id))
    .orderBy(desc(supportTicketsTable.createdAt));
  res.json(rows);
});

router.get("/admin/support-tickets", requireRole("admin"), async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(supportTicketsTable)
    .orderBy(desc(supportTicketsTable.createdAt));
  res.json(rows);
});

router.patch(
  "/admin/support-tickets/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { adminReply, status } = req.body as { adminReply?: string; status?: string };

    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, id));
    if (!ticket) { res.status(404).json({ error: "Not found" }); return; }

    const [updated] = await db
      .update(supportTicketsTable)
      .set({
        ...(adminReply !== undefined && { adminReply, repliedAt: new Date(), status: status ?? "replied" }),
        ...(status !== undefined && !adminReply && { status }),
      })
      .where(eq(supportTicketsTable.id, id))
      .returning();

    if (adminReply && ticket.userId) {
      await db.insert(notificationsTable).values({
        userId: ticket.userId,
        title: "Support reply",
        message: `Your ticket "${ticket.subject}" has been answered.`,
      });
    }

    if (adminReply && ticket.email) {
      sendEmail({
        from: "AllMart Support <support@allmart.com>",
        to: ticket.email,
        subject: `Re: ${ticket.subject}`,
        html: `<p>Hi ${escHtml(ticket.name)},</p><p>Here is our response to your support request:</p><blockquote>${escHtml(adminReply).replace(/\n/g, "<br>")}</blockquote><p>— AllMart Support Team</p>`,
      }).catch((err) => { logger.error({ err, to: ticket.email }, "Support reply email failed"); });
    }

    res.json(updated);
  },
);

export default router;
