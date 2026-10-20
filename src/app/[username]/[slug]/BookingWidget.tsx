"use client";

import { DateTime } from "luxon";
import { useActionState, useEffect, useMemo, useState } from "react";
import { bookAction, type BookState } from "./actions";

type Props = { username: string; slug: string; slots: string[]; durationMinutes: number; ownerName: string; title: string };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BookingWidget({ username, slug, slots, durationMinutes, ownerName, title }: Props) {
  const [tz, setTz] = useState<string | null>(null);
  const [month, setMonth] = useState<DateTime | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<BookState, FormData>(bookAction, {});

  // The visitor's timezone is only known in the browser, so render after mount.
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  const byDay = useMemo(() => {
    const map = new Map<string, DateTime[]>();
    if (!tz) return map;
    for (const s of slots) {
      const t = DateTime.fromISO(s).setZone(tz);
      const key = t.toISODate()!;
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [slots, tz]);

  useEffect(() => {
    if (!tz) return;
    const first = [...byDay.keys()][0];
    setDay(first ?? null);
    setMonth((first ? DateTime.fromISO(first, { zone: tz }) : DateTime.now().setZone(tz)).startOf("month"));
    setSlot(null);
  }, [byDay, tz]);

  const zones = useMemo(() => (typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []), []);

  if (!tz || !month) return <div className="p-6 text-sm text-gray-500">Loading availability…</div>;

  if (slot) {
    const t = DateTime.fromISO(slot).setZone(tz);
    return (
      <section className="p-6">
        <h2 className="text-lg font-bold">Confirm booking</h2>
        <dl className="mt-4 grid grid-cols-[90px_1fr] gap-y-1 rounded-xl bg-brand-soft p-4 text-sm">
          <dt className="text-gray-500">What</dt>
          <dd className="font-medium">{title}</dd>
          <dt className="text-gray-500">With</dt>
          <dd className="font-medium">{ownerName}</dd>
          <dt className="text-gray-500">When</dt>
          <dd className="font-medium">{t.toFormat("cccc, LLLL d, yyyy 'at' h:mm a")}</dd>
          <dt className="text-gray-500">Timezone</dt>
          <dd className="font-medium">{tz}</dd>
          <dt className="text-gray-500">Duration</dt>
          <dd className="font-medium">{durationMinutes} minutes</dd>
        </dl>
        <form action={formAction} className="mt-5 space-y-4">
          <input type="hidden" name="username" value={username} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="start" value={slot} />
          <input type="hidden" name="timezone" value={tz} />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <div>
            <label className="label" htmlFor="name">Your name *</label>
            <input id="name" name="name" required className="input" autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="email">Your email *</label>
            <input id="email" name="email" type="email" required className="input" autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="notes">Anything to share before we meet?</label>
            <textarea id="notes" name="notes" rows={3} className="input" />
          </div>
          {state.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Booking…" : "Book event"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setSlot(null)}>
              Back
            </button>
          </div>
        </form>
      </section>
    );
  }

  const gridStart = month.minus({ days: month.weekday % 7 });
  const cells = Array.from({ length: 42 }, (_, i) => gridStart.plus({ days: i }));
  const daySlots = day ? byDay.get(day) ?? [] : [];

  return (
    <section className="grid gap-6 p-6 lg:grid-cols-[1fr_220px]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{month.toFormat("LLLL yyyy")}</h2>
          <div className="flex gap-1">
            <button className="btn-ghost px-3" aria-label="Previous month" onClick={() => setMonth(month.minus({ months: 1 }))}>‹</button>
            <button className="btn-ghost px-3" aria-label="Next month" onClick={() => setMonth(month.plus({ months: 1 }))}>›</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c) => {
            const key = c.toISODate()!;
            const open = byDay.has(key);
            const selected = key === day;
            const inMonth = c.month === month.month;
            return (
              <button
                key={key}
                disabled={!open}
                onClick={() => setDay(key)}
                className={[
                  "aspect-square rounded-lg text-sm transition",
                  !inMonth && "opacity-40",
                  selected ? "bg-brand font-bold text-white" : open ? "bg-brand-soft font-semibold text-brand hover:bg-indigo-100" : "text-gray-300",
                ].filter(Boolean).join(" ")}
              >
                {c.day}
              </button>
            );
          })}
        </div>
        <label className="mt-5 block text-xs text-gray-500">
          Timezone
          <select className="input mt-1" value={tz} onChange={(e) => setTz(e.target.value)}>
            {(zones.includes(tz) ? zones : [tz, ...zones]).map((z) => (
              <option key={z} value={z}>{z.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          {day ? DateTime.fromISO(day).toFormat("cccc, LLL d") : "No open times"}
        </h3>
        <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
          {daySlots.map((t) => (
            <button key={t.toISO()} className="btn-ghost border-brand/40 text-brand hover:bg-brand-soft" onClick={() => setSlot(t.toUTC().toISO())}>
              {t.toFormat("h:mm a")}
            </button>
          ))}
          {day && daySlots.length === 0 && <p className="text-sm text-gray-500">Nothing open this day.</p>}
          {!day && <p className="text-sm text-gray-500">No times are open in the next few weeks.</p>}
        </div>
      </div>
    </section>
  );
}
