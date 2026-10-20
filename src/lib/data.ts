import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { z } from "zod";
import { busyFromFeeds } from "./busy";
import { getDb, schema } from "./db";
import type { Booking, BookingType, Profile } from "./db/schema";
import { sendMail } from "./email";
import { buildIcs } from "./ics";
import { computeSlots, type Interval } from "./slots";

const { profile, bookingTypes, bookings } = schema;

export async function getProfile(): Promise<Profile> {
  const db = await getDb();
  const [row] = await db.select().from(profile).where(eq(profile.id, 1));
  return row;
}

export async function getProfileByUsername(username: string) {
  const p = await getProfile();
  return p.username.toLowerCase() === username.toLowerCase() ? p : null;
}

export async function listBookingTypes(opts: { activeOnly?: boolean } = {}) {
  const db = await getDb();
  const rows = await db.select().from(bookingTypes).orderBy(asc(bookingTypes.durationMinutes), asc(bookingTypes.id));
  return opts.activeOnly ? rows.filter((t) => t.active) : rows;
}

export async function getBookingType(slug: string) {
  const db = await getDb();
  const [row] = await db.select().from(bookingTypes).where(eq(bookingTypes.slug, slug));
  return row ?? null;
}

type Db = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function confirmedBetween(db: Db | Tx, from: Date, to: Date): Promise<Interval[]> {
  const rows = await db
    .select({ start: bookings.startsAt, end: bookings.endsAt })
    .from(bookings)
    .where(and(eq(bookings.status, "confirmed"), lt(bookings.startsAt, to), gt(bookings.endsAt, from)));
  return rows;
}

function horizon(type: BookingType) {
  return DateTime.now().plus({ days: type.maxDaysAhead + 2 }).toJSDate();
}

export async function getSlots(p: Profile, type: BookingType) {
  const db = await getDb();
  const until = horizon(type);
  const [booked, feeds] = await Promise.all([
    confirmedBetween(db, new Date(Date.now() - 86_400_000), until),
    busyFromFeeds(p.calendarFeeds, until),
  ]);
  return computeSlots({ type, timezone: p.timezone, weeklyHours: p.weeklyHours, busy: [...booked, ...feeds] });
}

export const bookingInput = z.object({
  slug: z.string().min(1),
  start: z.string().datetime({ offset: true }),
  name: z.string().trim().min(1, "Please enter your name").max(120),
  email: z.string().trim().email("Please enter a valid email").max(200),
  notes: z.string().trim().max(2000).default(""),
  timezone: z.string().min(1).max(64),
});

export type CreateBookingResult = { ok: true; id: string; token: string } | { ok: false; error: string };

export async function createBooking(raw: z.input<typeof bookingInput>): Promise<CreateBookingResult> {
  const parsed = bookingInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const input = parsed.data;

  const [p, type] = await Promise.all([getProfile(), getBookingType(input.slug)]);
  if (!type || !type.active) return { ok: false, error: "This booking link is no longer available." };

  const start = new Date(input.start);
  const end = new Date(start.getTime() + type.durationMinutes * 60_000);
  const until = horizon(type);
  const feedBusy = await busyFromFeeds(p.calendarFeeds, until);

  const db = await getDb();
  const id = randomUUID();
  const token = randomBytes(24).toString("hex");

  const taken = await db.transaction(async (tx) => {
    // Serialize bookings so two people can't grab the same slot at once.
    await tx.execute(sql`select pg_advisory_xact_lock(7243001)`);
    const booked = await confirmedBetween(tx, new Date(Date.now() - 86_400_000), until);
    const open = computeSlots({ type, timezone: p.timezone, weeklyHours: p.weeklyHours, busy: [...booked, ...feedBusy] });
    if (!open.some((s) => new Date(s).getTime() === start.getTime())) return true;
    await tx.insert(bookings).values({
      id,
      bookingTypeId: type.id,
      startsAt: start,
      endsAt: end,
      name: input.name,
      email: input.email,
      notes: input.notes,
      timezone: input.timezone,
      manageToken: token,
    });
    return false;
  });
  if (taken) return { ok: false, error: "Sorry, that time was just taken. Please pick another." };

  await notify("confirmed", { p, type, booking: { id, startsAt: start, endsAt: end, ...input, manageToken: token } });
  return { ok: true, id, token };
}

export async function getBooking(id: string, token: string) {
  const db = await getDb();
  const [row] = await db
    .select({ booking: bookings, type: bookingTypes })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.bookingTypeId, bookingTypes.id))
    .where(eq(bookings.id, id));
  if (!row || row.booking.manageToken !== token) return null;
  return row;
}

export async function cancelBooking(id: string, by: { token: string } | { admin: true }) {
  const db = await getDb();
  const [row] = await db
    .select({ booking: bookings, type: bookingTypes })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.bookingTypeId, bookingTypes.id))
    .where(eq(bookings.id, id));
  if (!row || row.booking.status === "cancelled") return false;
  if ("token" in by && row.booking.manageToken !== by.token) return false;
  await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, id));
  await notify("cancelled", { p: await getProfile(), type: row.type, booking: row.booking });
  return true;
}

export async function listUpcomingBookings() {
  const db = await getDb();
  return db
    .select({ booking: bookings, type: bookingTypes })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.bookingTypeId, bookingTypes.id))
    .where(and(eq(bookings.status, "confirmed"), gt(bookings.endsAt, new Date())))
    .orderBy(asc(bookings.startsAt));
}

type NotifyBooking = Pick<Booking, "id" | "startsAt" | "endsAt" | "name" | "email" | "notes" | "timezone" | "manageToken">;

async function notify(kind: "confirmed" | "cancelled", { p, type, booking }: { p: Profile; type: BookingType; booking: NotifyBooking }) {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const manageUrl = `${base}/booking/${booking.id}?token=${booking.manageToken}`;
  const when = (tz: string) =>
    DateTime.fromJSDate(booking.startsAt).setZone(tz).toFormat("cccc, LLLL d, yyyy 'at' h:mm a ZZZZ");
  const ics = buildIcs({
    uid: booking.id,
    start: booking.startsAt,
    end: booking.endsAt,
    title: `${type.title} with ${p.name}`,
    description: `${booking.notes}\n\nManage: ${manageUrl}`.trim(),
    location: type.location,
    organizer: { name: p.name, email: p.email },
    attendee: { name: booking.name, email: booking.email },
    cancelled: kind === "cancelled",
  });
  const verb = kind === "confirmed" ? "Confirmed" : "Cancelled";

  await sendMail({
    to: booking.email,
    subject: `${verb}: ${type.title} with ${p.name}`,
    text: `Hi ${booking.name},\n\nYour ${type.title} with ${p.name} is ${kind}.\n\nWhen: ${when(booking.timezone)}\nDuration: ${type.durationMinutes} minutes${type.location ? `\nWhere: ${type.location}` : ""}\n\n${kind === "confirmed" ? `Need to cancel? ${manageUrl}` : ""}`,
    ics,
  });
  if (p.email) {
    await sendMail({
      to: p.email,
      subject: `${verb}: ${booking.name} — ${type.title}`,
      text: `${booking.name} <${booking.email}>\nWhen: ${when(p.timezone)}\n${booking.notes ? `\nNotes:\n${booking.notes}\n` : ""}`,
      ics,
    });
  }
}
