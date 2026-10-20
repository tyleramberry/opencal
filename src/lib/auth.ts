import "server-only";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sign, verifySigned } from "./crypto";
import { getDb, schema } from "./db";
import type { User } from "./db/schema";

const SESSION = "opencal_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export async function startSession(userId: number) {
  const value = `${userId}:${Date.now() + MAX_AGE * 1000}`;
  (await cookies()).set(SESSION, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION);
}

export async function getCurrentUser(): Promise<User | null> {
  const value = verifySigned((await cookies()).get(SESSION)?.value);
  if (!value) return null;
  const [id, expires] = value.split(":").map(Number);
  if (!id || expires < Date.now()) return null;
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  return user?.active ? user : null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requireOwner(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/admin");
  return user;
}

/** Local fallback when Google sign-in isn't configured: ADMIN_PASSWORD signs in as the owner. */
export function passwordMatches(input: string) {
  const expected = Buffer.from(process.env.ADMIN_PASSWORD ?? "");
  const given = Buffer.from(input);
  return expected.length > 0 && expected.length === given.length && timingSafeEqual(expected, given);
}
