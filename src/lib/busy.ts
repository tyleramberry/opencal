import "server-only";
import ical from "node-ical";
import type { Interval } from "./slots";

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; busy: Interval[] }>();

/**
 * Busy times from "secret iCal address" feeds (Google, Outlook, iCloud all offer one).
 * No OAuth needed: paste the private .ics URL in admin settings.
 */
export async function busyFromFeeds(urls: string[], until: Date): Promise<Interval[]> {
  const results = await Promise.all(urls.map((url) => busyFromFeed(url, until)));
  return results.flat();
}

async function busyFromFeed(url: string, until: Date): Promise<Interval[]> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.busy;
  try {
    const data = await ical.async.fromURL(url);
    const from = new Date(Date.now() - 24 * 3600_000);
    const busy: Interval[] = [];
    for (const item of Object.values(data)) {
      if (!item || item.type !== "VEVENT") continue;
      const ev = item as ical.VEvent;
      if (ev.transparency === "TRANSPARENT" || ev.status === "CANCELLED") continue;
      const length = ev.end.getTime() - ev.start.getTime();
      if (ev.rrule) {
        const excluded = new Set(Object.values(ev.exdate ?? {}).map((d) => new Date(d as Date).getTime()));
        for (const start of ev.rrule.between(from, until, true)) {
          if (excluded.has(start.getTime())) continue;
          busy.push({ start, end: new Date(start.getTime() + length) });
        }
      } else if (ev.end > from && ev.start < until) {
        busy.push({ start: ev.start, end: ev.end });
      }
    }
    cache.set(url, { at: Date.now(), busy });
    return busy;
  } catch (err) {
    console.error(`[opencal] could not read calendar feed: ${(err as Error).message}`);
    return hit?.busy ?? [];
  }
}
