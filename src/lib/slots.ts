import { DateTime } from "luxon";
import type { BookingType, WeeklyHours } from "./db/schema";

export type Interval = { start: Date; end: Date };

const overlaps = (aStart: number, aEnd: number, b: Interval) =>
  aStart < b.end.getTime() && aEnd > b.start.getTime();

/**
 * Every bookable start time for a booking type, as UTC ISO strings.
 * Hours are interpreted in the owner's timezone; busy intervals are padded by the type's buffer.
 */
export function computeSlots(opts: {
  type: Pick<BookingType, "durationMinutes" | "slotStepMinutes" | "bufferMinutes" | "minNoticeHours" | "maxDaysAhead">;
  timezone: string;
  weeklyHours: WeeklyHours;
  busy: Interval[];
  now?: Date;
}): string[] {
  const { type, timezone, weeklyHours, busy } = opts;
  const now = DateTime.fromJSDate(opts.now ?? new Date());
  const earliest = now.plus({ hours: type.minNoticeHours }).toMillis();
  const durationMs = type.durationMinutes * 60_000;
  const bufferMs = type.bufferMinutes * 60_000;
  const step = Math.max(5, type.slotStepMinutes);
  const slots: string[] = [];

  const firstDay = now.setZone(timezone).startOf("day");
  for (let i = 0; i <= type.maxDaysAhead; i++) {
    const day = firstDay.plus({ days: i });
    for (const window of weeklyHours[String(day.weekday)] ?? []) {
      const [sh, sm] = window.start.split(":").map(Number);
      const [eh, em] = window.end.split(":").map(Number);
      const windowEnd = day.set({ hour: eh, minute: em }).toMillis();
      for (let t = day.set({ hour: sh, minute: sm }); t.toMillis() + durationMs <= windowEnd; t = t.plus({ minutes: step })) {
        const start = t.toMillis();
        if (start < earliest) continue;
        if (busy.some((b) => overlaps(start - bufferMs, start + durationMs + bufferMs, b))) continue;
        slots.push(t.toUTC().toISO()!);
      }
    }
  }
  return slots;
}
