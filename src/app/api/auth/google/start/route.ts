import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomToken, sign } from "@/lib/crypto";
import { googleAuthUrl, googleConfigured } from "@/lib/google";

const OAUTH_STATE_COOKIE = "opencal_oauth";

export async function GET(req: Request) {
  if (!googleConfigured()) return NextResponse.redirect(new URL("/admin/login?error=google-not-configured", req.url));
  const invite = new URL(req.url).searchParams.get("invite") ?? "";
  const state = randomToken(16);
  const value = `${state}:${invite}`;
  (await cookies()).set(OAUTH_STATE_COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthUrl(state));
}
