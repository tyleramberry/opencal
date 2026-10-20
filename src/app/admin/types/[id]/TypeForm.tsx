"use client";

import { useActionState } from "react";
import type { BookingType } from "@/lib/db/schema";
import { saveTypeAction } from "../../actions";

function Num({ name, label, value, hint }: { name: string; label: string; value: number; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type="number" min={0} defaultValue={value} className="input" />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function TypeForm({ type: t, username }: { type: BookingType | null; username: string }) {
  const [state, action, pending] = useActionState(saveTypeAction, {});
  return (
    <form action={action} className="card space-y-4 p-6">
      <h1 className="text-lg font-bold">{t ? "Edit booking type" : "New booking type"}</h1>
      <input type="hidden" name="id" value={t?.id ?? "new"} />
      <div>
        <label className="label" htmlFor="title">Title</label>
        <input id="title" name="title" defaultValue={t?.title ?? ""} className="input" required placeholder="Intro call" />
      </div>
      <div>
        <label className="label" htmlFor="slug">Link name</label>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <span>/{username}/</span>
          <input id="slug" name="slug" defaultValue={t?.slug ?? ""} className="input" required placeholder="intro-call" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3} defaultValue={t?.description ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="location">Location / meeting link</label>
        <input id="location" name="location" defaultValue={t?.location ?? ""} className="input" placeholder="https://meet.google.com/... or a phone number" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Num name="durationMinutes" label="Duration (minutes)" value={t?.durationMinutes ?? 30} />
        <Num name="slotStepMinutes" label="Start times every (minutes)" value={t?.slotStepMinutes ?? 30} />
        <Num name="bufferMinutes" label="Buffer around meetings (minutes)" value={t?.bufferMinutes ?? 0} />
        <Num name="minNoticeHours" label="Minimum notice (hours)" value={t?.minNoticeHours ?? 4} />
        <Num name="maxDaysAhead" label="Bookable up to (days ahead)" value={t?.maxDaysAhead ?? 30} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="addMeet" defaultChecked={t?.addMeet ?? true} /> Add a Google Meet link (when no location is set)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={t?.active ?? true} /> Accepting bookings
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}
