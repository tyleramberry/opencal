import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { startSession } from "@/lib/auth";
import { verifySigned } from "@/lib/crypto";
import { signInWithGoogle } from "@/lib/data";
import { exchangeCode } from "@/lib/google";

const fail = (req: Request, message: string) =>
  NextResponse.redirect(new URL(`/admin/login?error=${encodeURIComponent(message)}`, req.url));

export async function GET(req: Request) {
  const url = new URL(req.url);
  const store = await cookies();
  const saved = verifySigned(store.get("opencal_oauth")?.value);
  store.delete("opencal_oauth");

  if (url.searchParams.get("error")) return fail(req, "Google sign-in was cancelled.");
  const code = url.searchParams.get("code");
  const [state, invite] = (saved ?? "").split(":");
  if (!code || !saved || state !== url.searchParams.get("state")) return fail(req, "Sign-in expired. Please try again.");

  try {
    const { tokens, profile } = await exchangeCode(code);
    const result = await signInWithGoogle(profile, tokens.refresh_token, invite || null);
    if (!result.ok) return fail(req, result.error);
    await startSession(result.user.id);
    return NextResponse.redirect(new URL("/admin", req.url));
  } catch (err) {
    console.error(`[opencal] Google sign-in failed: ${(err as Error).message}`);
    return fail(req, "Google sign-in failed. Please try again.");
  }
}
