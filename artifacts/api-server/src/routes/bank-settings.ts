import { Router, type IRouter, type Request, type Response } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth";
import { isSafeMediaUrl } from "../lib/url-validation";

const router: IRouter = Router();

router.get("/settings/bank", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "bank_details"));

  const defaultDetails = {
    bankName: "",
    accountName: "",
    accountNumber: "",
    routingNumber: "",
  };

  if (rows.length === 0) {
    res.json(defaultDetails);
    return;
  }

  try {
    res.json(JSON.parse(rows[0]!.value));
  } catch {
    res.json(defaultDetails);
  }
});

router.put("/settings/bank", requireRole("admin"), async (req: Request, res: Response) => {
  const { bankName, accountName, accountNumber, routingNumber, bankLogo, email } = req.body as {
    bankName: string;
    accountName: string;
    accountNumber: string;
    routingNumber?: string;
    bankLogo?: string;
    email?: string;
  };

  if (!bankName || !accountName || !accountNumber) {
    res.status(400).json({ error: "All fields required" });
    return;
  }
  if (bankLogo && !isSafeMediaUrl(bankLogo)) {
    res.status(400).json({ error: "Bank logo must be uploaded through the store" });
    return;
  }

  const payload = { bankName, accountName, accountNumber, routingNumber: routingNumber ?? "", bankLogo: bankLogo ?? "", email: email ?? "" };
  const value = JSON.stringify(payload);

  await db
    .insert(settingsTable)
    .values({ key: "bank_details", value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });

  res.json(payload);
});

router.get("/settings/bank-caution", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "bank_caution_note"));

  const defaultNote = "Always include your reference number in the transfer description so we can match your payment to your order. Upload your payment screenshot below to speed up verification. Transfers without a screenshot may take longer to confirm.";

  if (rows.length === 0) {
    res.json({ note: defaultNote });
    return;
  }
  res.json({ note: rows[0]!.value });
});

router.put("/settings/bank-caution", requireRole("admin"), async (req: Request, res: Response) => {
  const { note } = req.body as { note: string };
  if (typeof note !== "string") {
    res.status(400).json({ error: "note is required" });
    return;
  }
  await db
    .insert(settingsTable)
    .values({ key: "bank_caution_note", value: note })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: note, updatedAt: new Date() } });
  res.json({ note });
});

export default router;
