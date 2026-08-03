import { Router, type IRouter, type Request, type Response } from "express";
import { db, emailCampaignsTable, usersTable, DEFAULT_FOOTER, type EmailBlock, type CampaignFooter } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireRole } from "../lib/auth";
import { sendEmail } from "./email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── HTML renderer ──────────────────────────────────────────────────────────

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "header": {
      const sizes: Record<string, string> = { h1: "28px", h2: "22px", h3: "18px" };
      const fw = block.size === "h3" ? "600" : "700";
      return `<div style="padding:8px 0;text-align:${block.align};"><span style="font-size:${sizes[block.size]};font-weight:${fw};color:${block.color};line-height:1.3;">${escHtml(block.text)}</span></div>`;
    }
    case "text":
      return `<div style="padding:8px 0;"><p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">${escHtml(block.text).replace(/\n/g, "<br>")}</p></div>`;
    case "image": {
      const img = `<img src="${escHtml(block.url)}" alt="${escHtml(block.alt)}" style="display:block;width:100%;max-width:100%;border-radius:6px;object-fit:cover;" />`;
      return `<div style="padding:8px 0;">${block.link ? `<a href="${escHtml(block.link)}" style="display:block;">${img}</a>` : img}</div>`;
    }
    case "button": {
      const align = block.align === "center" ? "center" : block.align === "right" ? "right" : "left";
      return `<div style="padding:12px 0;text-align:${align};"><a href="${escHtml(block.url)}" style="display:inline-block;background:${escHtml(block.bgColor)};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;">${escHtml(block.text)}</a></div>`;
    }
    case "divider":
      return `<div style="padding:8px 0;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></div>`;
    case "product": {
      // Support both new products[] and legacy single-product fields
      const pb = block as { type: "product"; products?: { productId: number; name: string; price: number; imageUrl: string }[]; productId?: number; name?: string; price?: number; imageUrl?: string };
      const items = pb.products && pb.products.length > 0
        ? pb.products
        : pb.productId ? [{ productId: pb.productId, name: pb.name ?? "", price: pb.price ?? 0, imageUrl: pb.imageUrl ?? "" }] : [];
      if (items.length === 0) return "";
      const shopUrl = process.env.STOREFRONT_URL ?? "https://allmarts.us";
      if (items.length === 1) {
        const p = items[0];
        return `<div style="padding:8px 0;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><tr><td style="padding:16px;vertical-align:middle;width:120px;"><img src="${escHtml(p.imageUrl)}" alt="${escHtml(p.name)}" style="width:100px;height:100px;object-fit:cover;border-radius:6px;display:block;" /></td><td style="padding:16px;vertical-align:middle;"><p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#111827;">${escHtml(p.name)}</p><p style="margin:0 0 12px;font-size:20px;font-weight:700;color:#7c3aed;">$${Number(p.price).toFixed(2)}</p><a href="${escHtml(shopUrl)}/products" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;">Shop Now</a></td></tr></table></div>`;
      }
      // Multi-product: 2-column grid
      const rows: string[] = [];
      for (let i = 0; i < items.length; i += 2) {
        const pair = items.slice(i, i + 2);
        const cells = pair.map(p => `<td style="width:50%;padding:8px;vertical-align:top;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><tr><td style="padding:12px;text-align:center;"><img src="${escHtml(p.imageUrl)}" alt="${escHtml(p.name)}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;display:inline-block;" /></td></tr><tr><td style="padding:0 12px 12px;text-align:center;"><p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#111827;">${escHtml(p.name)}</p><p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#7c3aed;">$${Number(p.price).toFixed(2)}</p><a href="${escHtml(shopUrl)}/products" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:6px 14px;border-radius:6px;font-size:11px;font-weight:600;">Shop Now</a></td></tr></table></td>`).join("");
        // Pad odd row with empty cell
        const padded = pair.length < 2 ? cells + `<td style="width:50%;padding:8px;"></td>` : cells;
        rows.push(`<tr>${padded}</tr>`);
      }
      return `<div style="padding:8px 0;"><table width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table></div>`;
    }
    default:
      return "";
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  twitter: "X / Twitter",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

function renderFooterHtml(footer: CampaignFooter): string {
  const bg   = footer.bgColor  || "#f9fafb";
  const fg   = footer.textColor || "#9ca3af";

  // Social links
  const socialEntries = Object.entries(footer.social ?? {}).filter(([, v]) => v?.trim());
  const socialHtml = socialEntries.length
    ? `<p style="margin:0 0 10px;font-size:12px;">
        ${socialEntries.map(([k, v]) =>
          `<a href="${escHtml(v as string)}" style="display:inline-block;margin:2px 4px;padding:4px 10px;border-radius:20px;border:1px solid ${fg};color:${fg};text-decoration:none;font-size:11px;">${SOCIAL_LABELS[k] ?? k}</a>`
        ).join("")}
       </p>`
    : "";

  // Custom links
  const customLinks = (footer.links ?? []).filter(l => l.label?.trim() && l.url?.trim());
  const linksHtml = customLinks.length
    ? `<p style="margin:0 0 10px;font-size:11px;">
        ${customLinks.map((l, i) =>
          `${i > 0 ? ' <span style="color:' + fg + '">·</span> ' : ''}<a href="${escHtml(l.url)}" style="color:${fg};text-decoration:underline;">${escHtml(l.label)}</a>`
        ).join("")}
       </p>`
    : "";

  // Address
  const addressHtml = footer.address?.trim()
    ? `<p style="margin:0 0 8px;font-size:11px;color:${fg};">${escHtml(footer.address)}</p>`
    : "";

  // Message
  const messageHtml = footer.message?.trim()
    ? `<p style="margin:0 0 10px;font-size:12px;color:${fg};">${escHtml(footer.message)}</p>`
    : "";

  return `<tr><td style="padding:24px 32px;background:${bg};border-top:1px solid #e5e7eb;text-align:center;">
  ${socialHtml}
  ${linksHtml}
  ${addressHtml}
  ${messageHtml}
</td></tr>`;
}

export function renderCampaignHtml(subject: string, blocks: EmailBlock[], footer?: CampaignFooter | null, headerLogoUrl?: string): string {
  const bodyContent = blocks.map(renderBlock).join("\n");
  const footerData  = { ...DEFAULT_FOOTER, ...(footer ?? {}) };
  const logoHtml = headerLogoUrl?.trim()
    ? `<td align="right" style="padding:16px 32px;vertical-align:middle;">
        <img src="${escHtml(headerLogoUrl)}" alt="Logo" style="display:inline-block;max-height:40px;max-width:140px;object-fit:contain;" />
      </td>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
      <!-- Header bar -->
      <tr style="background:#7c3aed;">
        <td style="padding:16px 32px;vertical-align:middle;">
          <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">AllMart</span>
        </td>
        ${logoHtml}
      </tr>
      <!-- Body -->
      <tr><td style="padding:32px;">
        ${bodyContent}
      </td></tr>
      <!-- Footer -->
      ${renderFooterHtml(footerData)}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/** List all campaigns */
router.get("/admin/email-campaigns", requireRole("admin"), async (_req: Request, res: Response) => {
  const campaigns = await db
    .select()
    .from(emailCampaignsTable)
    .orderBy(emailCampaignsTable.createdAt);
  res.json(campaigns.reverse());
});

/** Create a new campaign */
router.post("/admin/email-campaigns", requireRole("admin"), async (req: Request, res: Response) => {
  const { title, subject, headerLogoUrl, blocks, footer, recipientType, recipientIds } = req.body as {
    title?: string;
    subject?: string;
    headerLogoUrl?: string;
    blocks?: EmailBlock[];
    footer?: CampaignFooter;
    recipientType?: "all" | "selected";
    recipientIds?: number[];
  };
  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
  if (!subject?.trim()) { res.status(400).json({ error: "subject is required" }); return; }

  const [campaign] = await db
    .insert(emailCampaignsTable)
    .values({
      title: title.trim(),
      subject: subject.trim(),
      headerLogoUrl: headerLogoUrl ?? "",
      blocks: blocks ?? [],
      footer: footer ?? DEFAULT_FOOTER,
      recipientType: recipientType ?? "all",
      recipientIds: recipientIds ?? [],
      status: "draft",
    })
    .returning();
  res.status(201).json(campaign);
});

/** Update a campaign (draft only) */
router.put("/admin/email-campaigns/:id", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(emailCampaignsTable).where(eq(emailCampaignsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "sent") { res.status(400).json({ error: "Cannot edit a sent campaign" }); return; }

  const { title, subject, headerLogoUrl, blocks, footer, recipientType, recipientIds } = req.body as {
    title?: string;
    subject?: string;
    headerLogoUrl?: string;
    blocks?: EmailBlock[];
    footer?: CampaignFooter;
    recipientType?: "all" | "selected";
    recipientIds?: number[];
  };

  const [updated] = await db
    .update(emailCampaignsTable)
    .set({
      title: title?.trim() ?? existing.title,
      subject: subject?.trim() ?? existing.subject,
      headerLogoUrl: headerLogoUrl ?? existing.headerLogoUrl ?? "",
      blocks: blocks ?? existing.blocks,
      footer: footer ?? existing.footer ?? DEFAULT_FOOTER,
      recipientType: recipientType ?? existing.recipientType,
      recipientIds: recipientIds ?? existing.recipientIds,
    })
    .where(eq(emailCampaignsTable.id, id))
    .returning();
  res.json(updated);
});

/** Delete a campaign */
router.delete("/admin/email-campaigns/:id", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(emailCampaignsTable).where(eq(emailCampaignsTable.id, id));
  res.json({ ok: true });
});

/** Preview rendered HTML (returns HTML string) */
router.get("/admin/email-campaigns/:id/preview", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [campaign] = await db.select().from(emailCampaignsTable).where(eq(emailCampaignsTable.id, id));
  if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
  const html = renderCampaignHtml(campaign.subject, campaign.blocks, campaign.footer, campaign.headerLogoUrl);
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

/** Reopen a sent campaign as draft */
router.post("/admin/email-campaigns/:id/reopen", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(emailCampaignsTable).where(eq(emailCampaignsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db
    .update(emailCampaignsTable)
    .set({ status: "draft" })
    .where(eq(emailCampaignsTable.id, id))
    .returning();
  res.json(updated);
});

/** Resend a campaign (even if already sent) */
router.post("/admin/email-campaigns/:id/resend", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [campaign] = await db.select().from(emailCampaignsTable).where(eq(emailCampaignsTable.id, id));
  if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
  if (!campaign.blocks || campaign.blocks.length === 0) {
    res.status(400).json({ error: "Campaign has no content blocks" });
    return;
  }

  let recipients: { id: number; email: string; name: string }[];
  if (campaign.recipientType === "selected" && campaign.recipientIds.length > 0) {
    recipients = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(inArray(usersTable.id, campaign.recipientIds));
  } else {
    recipients = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
      .from(usersTable);
  }
  if (recipients.length === 0) { res.status(400).json({ error: "No recipients found" }); return; }

  const html = renderCampaignHtml(campaign.subject, campaign.blocks, campaign.footer, campaign.headerLogoUrl);
  logger.info({ campaignId: id, recipients: recipients.length }, "Resending email campaign");

  let successCount = 0;
  let failCount = 0;
  for (let i = 0; i < recipients.length; i += 10) {
    const batch = recipients.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(r => sendEmail({ to: r.email, subject: campaign.subject, html }))
    );
    successCount += results.filter(r => r.status === "fulfilled").length;
    failCount += results.filter(r => r.status === "rejected").length;
  }

  const [updated] = await db
    .update(emailCampaignsTable)
    .set({ status: "sent", sentAt: new Date(), recipientCount: successCount })
    .where(eq(emailCampaignsTable.id, id))
    .returning();

  logger.info({ campaignId: id, successCount, failCount }, "Email campaign resent");
  res.json({ ok: true, successCount, failCount, campaign: updated });
});

/** Send a campaign */
router.post("/admin/email-campaigns/:id/send", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [campaign] = await db.select().from(emailCampaignsTable).where(eq(emailCampaignsTable.id, id));
  if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
  if (campaign.status === "sent") { res.status(400).json({ error: "Campaign already sent" }); return; }
  if (!campaign.blocks || campaign.blocks.length === 0) {
    res.status(400).json({ error: "Campaign has no content blocks" });
    return;
  }

  // Resolve recipients
  let recipients: { id: number; email: string; name: string }[];
  if (campaign.recipientType === "selected" && campaign.recipientIds.length > 0) {
    recipients = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(inArray(usersTable.id, campaign.recipientIds));
  } else {
    recipients = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
      .from(usersTable);
  }

  if (recipients.length === 0) {
    res.status(400).json({ error: "No recipients found" });
    return;
  }

  const html = renderCampaignHtml(campaign.subject, campaign.blocks, campaign.footer, campaign.headerLogoUrl);

  logger.info({ campaignId: id, recipients: recipients.length }, "Sending email campaign");

  // Send in batches of 10 to avoid overwhelming providers
  let successCount = 0;
  let failCount = 0;
  for (let i = 0; i < recipients.length; i += 10) {
    const batch = recipients.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(r => sendEmail({ to: r.email, subject: campaign.subject, html }))
    );
    successCount += results.filter(r => r.status === "fulfilled").length;
    failCount += results.filter(r => r.status === "rejected").length;
  }

  // Mark campaign as sent
  const [updated] = await db
    .update(emailCampaignsTable)
    .set({
      status: "sent",
      sentAt: new Date(),
      recipientCount: successCount,
    })
    .where(eq(emailCampaignsTable.id, id))
    .returning();

  logger.info({ campaignId: id, successCount, failCount }, "Email campaign sent");
  res.json({ ok: true, successCount, failCount, campaign: updated });
});

export default router;
