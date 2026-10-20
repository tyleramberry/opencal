"use client";

import { useActionState } from "react";
import type { User } from "@/lib/db/schema";
import { saveSettingsAction } from "../actions";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function SettingsForm({ profile: p }: { profile: User }) {
  const [state, action, pending] = useActionState(saveSettingsAction, {});
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [p.timezone];

  return (
    <form action={action} className="space-y-8">
      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" name="name" defaultValue={p.name} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="username">Username (your link)</label>
            <input id="username" name="username" defaultValue={p.username} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="heading">Page heading</label>
            <input id="heading" name="heading" defaultValue={p.heading} className="input" />
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="text-lg font-bold">Weekly hours</h2>
          <p className="text-sm text-gray-500">24-hour times. Split a day with commas, e.g. <code>09:00-12:00, 13:00-17:00</code>. Leave blank for a day off.</p>
        </div>
        <div>
          <label className="label" htmlFor="timezone">Your timezone</label>
          <select id="timezone" name="timezone" defaultValue={p.timezone} className="input">
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          {DAYS.map((name, i) => (
            <div key={name} className="grid grid-cols-[110px_1fr] items-center gap-3">
              <label htmlFor={`day${i + 1}`} className="text-sm font-medium">{name}</label>
              <input
                id={`day${i + 1}`}
                name={`day${i + 1}`}
                className="input"
                placeholder="Unavailable"
                defaultValue={(p.weeklyHours[String(i + 1)] ?? []).map((r) => `${r.start}-${r.end}`).join(", ")}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-6">
        <div>
          <h2 className="text-lg font-bold">Other calendars (optional)</h2>
          <p className="text-sm text-gray-500">
            Block busy times from calendars that aren&apos;t your main Google Calendar (Outlook, iCloud, a second Google
            account): paste each one&apos;s private iCal address, one per line.
          </p>
        </div>
        <textarea name="calendarFeeds" rows={3} className="input font-mono text-xs" defaultValue={p.calendarFeeds.join("\n")} placeholder="https://calendar.google.com/calendar/ical/.../basic.ics" />
      </section>

      <div className="flex items-center gap-4">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {state.ok && <span className="text-sm text-green-700">Saved.</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
