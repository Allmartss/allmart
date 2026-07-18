import { Router, type IRouter, type Request, type Response } from "express";
import { db, ordersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireRole } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const CSV_HEADERS = [
  "id",
  "trackingCode",
  "status",
  "total",
  "currency",
  "shippingAddress",
  "receiverName",
  "receiverEmail",
  "receiverPhone",
  "cashbackCode",
  "cashbackDiscount",
  "placedBy",
  "paymentVerified",
  "paymentNote",
  "createdAt",
  "items",
];

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = typeof val === "object" ? JSON.stringify(val) : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

router.get(
  "/admin/orders/export",
  requireRole("admin", "pm"),
  async (_req: Request, res: Response) => {
    try {
      const orders = await db
        .select()
        .from(ordersTable)
        .orderBy(desc(ordersTable.id));

      const rows = orders.map((o) =>
        CSV_HEADERS.map((h) => {
          if (h === "items") return escapeCsv(o.items);
          const val = o[h as keyof typeof o];
          return escapeCsv(val instanceof Date ? val.toISOString() : val);
        }).join(","),
      );

      const csv = [CSV_HEADERS.join(","), ...rows].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      logger.error({ err }, "export orders failed");
      res.status(500).json({ error: "Export failed" });
    }
  },
);

router.post(
  "/admin/orders/import",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { csv } = req.body as { csv?: string };
      if (!csv || typeof csv !== "string") {
        res.status(400).json({ error: "csv field required" });
        return;
      }

      const lines = csv.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        res.status(400).json({ error: "No data rows found" });
        return;
      }

      const headers = parseCsvLine(lines[0]);
      const required = ["trackingCode", "status", "total", "currency", "shippingAddress", "placedBy", "items"];
      for (const f of required) {
        if (!headers.includes(f)) {
          res.status(400).json({ error: `Missing required column: ${f}` });
          return;
        }
      }

      const col = (row: string[], name: string) => row[headers.indexOf(name)] ?? "";

      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      for (const line of lines.slice(1)) {
        const row = parseCsvLine(line);
        const trackingCode = col(row, "trackingCode");
        if (!trackingCode) { skipped++; continue; }

        const status = col(row, "status") || "placed";
        const total = Number(col(row, "total")) || 0;
        const currency = col(row, "currency") || "USD";
        const shippingAddress = col(row, "shippingAddress") || "";
        const placedBy = (col(row, "placedBy") || "user") as "user" | "ai";
        const createdAtRaw = col(row, "createdAt");
        const createdAt = createdAtRaw ? new Date(createdAtRaw) : new Date();
        const receiverName = col(row, "receiverName") || null;
        const receiverEmail = col(row, "receiverEmail") || null;
        const receiverPhone = col(row, "receiverPhone") || null;
        const cashbackCode = col(row, "cashbackCode") || null;
        const cashbackDiscountRaw = col(row, "cashbackDiscount");
        const cashbackDiscount = cashbackDiscountRaw ? Number(cashbackDiscountRaw) : null;
        const paymentVerified = col(row, "paymentVerified") || "pending";
        const paymentNote = col(row, "paymentNote") || null;

        let items: unknown[] = [];
        try {
          const raw = col(row, "items");
          if (raw) items = JSON.parse(raw);
        } catch { items = []; }

        const [existing] = await db
          .select({ id: ordersTable.id })
          .from(ordersTable)
          .where(eq(ordersTable.trackingCode, trackingCode));

        if (existing) {
          await db
            .update(ordersTable)
            .set({ status, total, shippingAddress, paymentVerified })
            .where(eq(ordersTable.trackingCode, trackingCode));
          updated++;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.insert(ordersTable).values({
            trackingCode,
            status,
            total,
            currency,
            shippingAddress,
            placedBy,
            receiverName,
            receiverEmail,
            receiverPhone,
            cashbackCode,
            cashbackDiscount,
            paymentVerified,
            paymentNote,
            items: items as any[],
            createdAt,
            sessionId: `imported-${trackingCode}`,
          } as any);
          inserted++;
        }
      }

      res.json({ inserted, updated, skipped });
    } catch (err) {
      logger.error({ err }, "import orders failed");
      res.status(500).json({ error: "Import failed" });
    }
  },
);

export default router;
