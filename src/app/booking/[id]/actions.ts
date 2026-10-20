"use server";

import { redirect } from "next/navigation";
import { cancelBooking } from "@/lib/data";

export async function cancelAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  const token = String(form.get("token") ?? "");
  await cancelBooking(id, { token });
  redirect(`/booking/${id}?token=${token}`);
}
