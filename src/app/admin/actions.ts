"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, passwordMatches, requireAdmin, startSession } from "@/lib/auth";
import { cancelBooking } from "@/lib/data";
import { getDb, schema } from "@/lib/db";
import type { WeeklyHours } from "@/lib/db/schema";

export type FormState = { error?: string; ok?: boolean };

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (!passwordMatches(String(form.get("password") ?? ""))) return { error: "Wrong password." };
  await startSession();
  redirect("/admin");
}

export async function logoutAction() {
  await endSession();
  redirect("/admin/login");
}

export async function adminCancelAction(form: FormData) {
  await requireAdmin();
  await cancelBooking(String(form.get("id")), { admin: true });
  revalidatePath("/admin");
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "09:00-12:00, 13:00-17:00" -> [{start,end}, ...] */
function parseRanges(text: string) {
  const ranges = [];
  for (const part of text.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [start, end] = part.split("-").map((s) => s.trim().padStart(5, "0"));
    if (!TIME.test(start ?? "") || !TIME.test(end ?? "") || start >= end) {
      throw new Error(`"${part}" isn't a valid range. Use 24-hour times like 09:00-17:00.`);
    }
    ranges.push({ start, end });
  }
  return ranges;
}

export async function saveSettingsAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const timezone = String(form.get("timezone"));
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    const weeklyHours: WeeklyHours = {};
    for (let d = 1; d <= 7; d++) {
      const ranges = parseRanges(String(form.get(`day${d}`) ?? ""));
      if (ranges.length) weeklyHours[String(d)] = ranges;
    }
    const username = String(form.get("username")).trim().toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(username) || ["admin", "booking", "api"].includes(username)) {
      throw new Error("Username can use lowercase letters, numbers and dashes.");
    }
    const feeds = String(form.get("calendarFeeds") ?? "")
      .split("\n")
      .map((s) => s.trim().replace(/^webcal:/, "https:"))
      .filter(Boolean);
    for (const f of feeds) if (!/^https:\/\//.test(f)) throw new Error(`Calendar feed must be an https URL: ${f}`);

    const db = await getDb();
    await db
      .update(schema.profile)
      .set({
        username,
        name: String(form.get("name")).trim() || "Your Name",
        heading: String(form.get("heading")).trim(),
        email: String(form.get("email")).trim() || null,
        timezone,
        weeklyHours,
        calendarFeeds: feeds,
      })
      .where(eq(schema.profile.id, 1));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof RangeError ? "Unknown timezone." : (err as Error).message };
  }
}

const typeInput = z.object({
  title: z.string().trim().min(1, "Title is required"),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,60}$/, "Link name can use lowercase letters, numbers and dashes"),
  description: z.string().trim().default(""),
  location: z.string().trim().default(""),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  slotStepMinutes: z.coerce.number().int().min(5).max(480),
  bufferMinutes: z.coerce.number().int().min(0).max(240),
  minNoticeHours: z.coerce.number().int().min(0).max(720),
  maxDaysAhead: z.coerce.number().int().min(1).max(365),
  active: z.boolean(),
});

export async function saveTypeAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = typeInput.safeParse({ ...Object.fromEntries(form), active: form.get("active") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = String(form.get("id"));
  const db = await getDb();
  try {
    if (id === "new") await db.insert(schema.bookingTypes).values(parsed.data);
    else await db.update(schema.bookingTypes).set(parsed.data).where(eq(schema.bookingTypes.id, Number(id)));
  } catch {
    return { error: "That link name is already used by another booking type." };
  }
  revalidatePath("/", "layout");
  redirect("/admin");
}
