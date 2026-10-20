import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "opencal_admin";

function secret() {
  const s = process.env.AUTH_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("Set ADMIN_PASSWORD in .env.local to use the admin area.");
  return s;
}

const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("hex");

export function passwordMatches(input: string) {
  const expected = Buffer.from(process.env.ADMIN_PASSWORD ?? "");
  const given = Buffer.from(input);
  return expected.length > 0 && expected.length === given.length && timingSafeEqual(expected, given);
}

export async function startSession() {
  const store = await cookies();
  store.set(COOKIE, sign("admin"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  const value = (await cookies()).get(COOKIE)?.value;
  return !!value && !!process.env.ADMIN_PASSWORD && value === sign("admin");
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
