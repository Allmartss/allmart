import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";

export type Role = "buyer" | "admin" | "pm";

const COOKIE = "nb_session_v2";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function sign(payload: string): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("SESSION_SECRET is required");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function pack(uid: number, sid: string): string {
  const payload = `${uid}.${sid}`;
  return `${payload}.${sign(payload)}`;
}

function unpack(token: string | undefined): { uid: number; sid: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [uidStr, sid, signature] = parts;
  if (!uidStr || !sid || !signature) return null;

  const expected = sign(`${uidStr}.${sid}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  const uid = Number(uidStr);
  if (!Number.isSafeInteger(uid) || uid <= 0) return null;
  return { uid, sid };
}

function isSecureRequest(req: Request): boolean {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto?.split(",")[0]?.trim();
  return req.protocol === "https" || proto === "https" || req.secure;
}

export async function issueSession(req: Request, res: Response, userId: number) {
  const sid = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({ id: sid, userId, expiresAt });
  res.cookie(COOKIE, pack(userId, sid), {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
  res.clearCookie("nb_user", { path: "/" });
}

export async function getUserFromCookie(req: Request) {
  const token = unpack(req.cookies?.[COOKIE]);
  if (!token) return null;

  const [row] = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(
      and(
        eq(sessionsTable.id, token.sid),
        eq(sessionsTable.userId, token.uid),
        gt(sessionsTable.expiresAt, new Date()),
      ),
    );
  return row?.user ?? null;
}

export async function clearSession(req: Request, res: Response) {
  const token = unpack(req.cookies?.[COOKIE]);
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, token.sid));
  }
  res.clearCookie(COOKIE, { path: "/" });
  // Invalidate the old unsigned cookie if one is still present.
  res.clearCookie("nb_user", { path: "/" });
}

export function requireRole(...allowed: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await getUserFromCookie(req);
    if (!user) {
      res.status(401).json({ error: "Sign in required" });
      return;
    }
    if (!allowed.includes(user.role as Role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    (req as Request & { authUser: typeof user }).authUser = user;
    next();
  };
}
