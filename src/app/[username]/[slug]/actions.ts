"use server";

import { redirect } from "next/navigation";
import { createBooking } from "@/lib/data";

export type BookState = { error?: string };

export async function bookAction(_prev: BookState, form: FormData): Promise<BookState> {
  // Honeypot: real people never see or fill this field.
  if (form.get("website")) return { error: "Something went wrong. Please try again." };

  const result = await createBooking({
    slug: String(form.get("slug") ?? ""),
    start: String(form.get("start") ?? ""),
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    notes: String(form.get("notes") ?? ""),
    timezone: String(form.get("timezone") ?? "UTC"),
  });
  if (!result.ok) return { error: result.error };
  redirect(`/booking/${result.id}?token=${result.token}&new=1`);
}
