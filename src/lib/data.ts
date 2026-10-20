import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { z } from "zod";
import { busyFromFeeds } from "./busy";
import { encrypt, randomToken } from "./crypto";
import { getDb, schema, type Db } from "./db";
import type { Booking, BookingType, User, WeeklyHours } from "./db/schema";
import { sendMail } from "./email";
import { appUrl, createGoogleEvent, deleteGoogleEvent, googleBusy } from "./google";
import { buildIcs } from "./ics";
import { computeSlots, type Interval } from "./slots";

const { users, invites, bookingTypes, bookings } = schema;

export const RESERVED_USERNAMES = ["admin", "api", "booking", "invite", "_next"];

// ---------- people ----------

export async function getUserByUsername(username: string) {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
  return u?.active ? u : null;
}

export async function getOwner() {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.role, "owner")).orderBy(asc(users.id)).limit(1);
  return u ?? null;
}

export async function listMembers() {
  const db = await getDb();
  return db.select().from(users).orderBy(asc(users.id));
}

export async function setUserActive(id: number, active: boolean) {
  const db = await getDb();
  await db.update(users).set({ active }).where(and(eq(users.id, id), eq(users.role, "member")));
}

const DEFAULT_HOURS: WeeklyHours = Object.fromEntries(
  ["1", "2", "3", "4", "5"].map((d) => [d, [{ start: "09:00", end: "17:00" }]]),
);

async function availableUsername(db: Db, base: string) {
  const clean = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "user";
  for (let i = 0; ; i++) {
    const candidate = i ? `${clean}-${i + 1}` : clean;
    if (RESERVED_USERNAMES.includes(candidate)) continue;
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, candidate));
    if (!taken) return candidate;
  }
}

async function createUser(
  db: Db,
  data: { email: string; name: string; role: "owner" | "member"; usernameHint: string; googleSub?: string; refreshToken?: string },
) {
  const username = await availableUsername(db, data.usernameHint);
  const [user] = await db
    .insert(users)
    .values({
      username,
      name: data.name,
      email: data.email.toLowerCase(),
      role: data.role,
      timezone: process.env.OWNER_TIMEZONE ?? "America/Denver",
      weeklyHours: DEFAULT_HOURS,
      googleSub: data.googleSub,
      googleRefreshToken: data.refreshToken ? encrypt(data.refreshToken) : null,
    })
    .returning();
  await db.insert(bookingTypes).values([
    { userId: user.id, slug: "15-minute-meeting", title: "15 Minute Meeting", description: "A quick 15 minute call.", durationMinutes: 15, slotStepMinutes: 15 },
    { userId: user.id, slug: "30-minute-meeting", title: "30 Minute Meeting", description: "A 30 minute meeting.", durationMinutes: 30, slotStepMinutes: 30 },
  ]);
  return user;
}

/** Password fallback (no Google configured): sign in as the owner, creating them from OWNER_* settings. */
export async function ensureOwnerForPasswordLogin() {
  const existing = await getOwner();
  if (existing) return existing;
  const db = await getDb();
  return createUser(db, {
    email: process.env.OWNER_EMAIL ?? "owner@localhost",
    name: process.env.OWNER_NAME ?? "Your Name",
    role: "owner",
    usernameHint: process.env.OWNER_USERNAME ?? "me",
  });
}

export type GoogleSignIn =
  | { ok: true; user: User }
  | { ok: false; error: string };

/**
 * Who may sign in: an existing person (matched by Google account or email), the configured
 * OWNER_EMAIL when no owner exists yet, or anyone holding an unused invite link.
 */
export async function signInWithGoogle(
  profile: { sub: string; email: string; name?: string },
  refreshToken: string | undefined,
  inviteToken: string | null,
): Promise<GoogleSignIn> {
  const db = await getDb();
  const email = profile.email.toLowerCase();
  const [existing] = await db
    .select()
    .from(users)
    .where(sql`${users.googleSub} = ${profile.sub} or ${users.email} = ${email}`);

  if (existing) {
    if (!existing.active) return { ok: false, error: "Your access to this OpenCal has been turned off." };
    const [user] = await db
      .update(users)
      .set({
        googleSub: profile.sub,
        ...(refreshToken ? { googleRefreshToken: encrypt(refreshToken) } : {}),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return { ok: true, user };
  }

  const name = profile.name || email.split("@")[0];
  const owner = await getOwner();
  if (!owner) {
    const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
    if (!ownerEmail || ownerEmail !== email) {
      return { ok: false, error: "This OpenCal isn't set up yet. Sign in with the owner's Google account first." };
    }
    const user = await createUser(db, { email, name, role: "owner", usernameHint: process.env.OWNER_USERNAME ?? name, googleSub: profile.sub, refreshToken });
    return { ok: true, user };
  }

  if (!inviteToken) return { ok: false, error: "You need an invite link to join this OpenCal." };
  const [invite] = await db.select().from(invites).where(and(eq(invites.token, inviteToken), isNull(invites.acceptedBy)));
  if (!invite) return { ok: false, error: "That invite link has already been used or was revoked." };
  const user = await createUser(db, { email, name, role: "member", usernameHint: name, googleSub: profile.sub, refreshToken });
  await db.update(invites).set({ acceptedBy: user.id }).where(eq(invites.token, inviteToken));
  return { ok: true, user };
}

// ---------- invites ----------

export async function createInvite(createdBy: number, email: string) {
  const db = await getDb();
  const token = randomToken(18);
  await db.insert(invites).values({ token, email: email.toLowerCase(), createdBy });
  return token;
}

export async function getOpenInvite(token: string) {
  const db = await getDb();
  const [row] = await db
    .select({ invite: invites, from: users })
    .from(invites)
    .innerJoin(users, eq(invites.createdBy, users.id))
    .where(and(eq(invites.token, token), isNull(invites.acceptedBy)));
  return row ?? null;
}

export async function listOpenInvites() {
  const db = await getDb();
  return db.select().from(invites).where(isNull(invites.acceptedBy)).orderBy(desc(invites.createdAt));
}

export async function revokeInvite(token: string) {
  const db = await getDb();
  await db.delete(invites).where(and(eq(invites.token, token), isNull(invites.acceptedBy)));
}

// ---------- booking types ----------

export async function listBookingTypes(userId: number, opts: { activeOnly?: boolean } = {}) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(bookingTypes)
    .where(eq(bookingTypes.userId, userId))
    .orderBy(asc(bookingTypes.durationMinutes), asc(bookingTypes.id));
  return opts.activeOnly ? rows.filter((t) => t.active) : rows;
}

export async function getBookingType(userId: number, slug: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(bookingTypes)
    .where(and(eq(bookingTypes.userId, userId), eq(bookingTypes.slug, slug)));
  return row ?? null;
}

// ---------- availability ----------

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function confirmedBetween(db: Db | Tx, userId: number, from: Date, to: Date): Promise<Interval[]> {
  return db
    .select({ start: bookings.startsAt, end: bookings.endsAt })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.bookingTypeId, bookingTypes.id))
    .where(
      and(
        eq(bookingTypes.userId, userId),
        eq(bookings.status, "confirmed"),
        lt(bookings.startsAt, to),
        gt(bookings.endsAt, from),
      ),
    );
}

const horizon = (type: BookingType) => DateTime.now().plus({ days: type.maxDaysAhead + 2 }).toJSDate();

async function externalBusy(user: User, until: Date) {
  const [feeds, google] = await Promise.all([busyFromFeeds(user.calendarFeeds, until), googleBusy(user, until)]);
  return [...feeds, ...google];
}

export async function getSlots(user: User, type: BookingType) {
  const db = await getDb();
  const until = horizon(type);
  const [booked, external] = await Promise.all([
    confirmedBetween(db, user.id, new Date(Date.now() - 86_400_000), until),
    externalBusy(user, until),
  ]);
  return computeSlots({ type, timezone: user.timezone, weeklyHours: user.weeklyHours, busy: [...booked, ...external] });
}

// ---------- bookings ----------

export const bookingInput = z.object({
  username: z.string().min(1),
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

  const host = await getUserByUsername(input.username);
  const type = host && (await getBookingType(host.id, input.slug));
  if (!host || !type || !type.active) return { ok: false, error: "This booking link is no longer available." };

  const start = new Date(input.start);
  const end = new Date(start.getTime() + type.durationMinutes * 60_000);
  const until = horizon(type);
  const external = await externalBusy(host, until);

  const db = await getDb();
  const id = randomUUID();
  const token = randomToken();

  const taken = await db.transaction(async (tx) => {
    // One booking at a time per host, so two people can't grab the same slot.
    await tx.execute(sql`select pg_advisory_xact_lock(7243001, ${host.id})`);
    const booked = await confirmedBetween(tx, host.id, new Date(Date.now() - 86_400_000), until);
    const open = computeSlots({ type, timezone: host.timezone, weeklyHours: host.weeklyHours, busy: [...booked, ...external] });
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

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
  await afterConfirmed(host, type, booking);
  return { ok: true, id, token };
}

const manageUrl = (b: Pick<Booking, "id" | "manageToken">) => `${appUrl()}/booking/${b.id}?token=${b.manageToken}`;

async function afterConfirmed(host: User, type: BookingType, booking: Booking) {
  const db = await getDb();
  let onGoogle = false;
  if (host.googleRefreshToken) {
    try {
      const ev = await createGoogleEvent(host, {
        requestId: booking.id,
        title: `${type.title}: ${booking.name} & ${host.name}`,
        description: [booking.notes, `Booked with OpenCal. Reschedule or cancel: ${manageUrl(booking)}`].filter(Boolean).join("\n\n"),
        start: booking.startsAt,
        end: booking.endsAt,
        location: type.location,
        guest: { name: booking.name, email: booking.email },
        addMeet: type.addMeet && !type.location,
      });
      if (ev) {
        await db.update(bookings).set({ googleEventId: ev.id, meetUrl: ev.meetUrl }).where(eq(bookings.id, booking.id));
        booking = { ...booking, googleEventId: ev.id, meetUrl: ev.meetUrl };
        onGoogle = true;
      }
    } catch (err) {
      console.error(`[opencal] could not add booking to Google Calendar: ${(err as Error).message}`);
    }
  }
  // Google already emails the guest an invite; only send our own emails when it didn't.
  if (!onGoogle) await emailBoth("confirmed", host, type, booking);
}

export async function getBooking(id: string, token: string) {
  const row = await bookingWithHost(id);
  if (!row || row.booking.manageToken !== token) return null;
  return row;
}

async function bookingWithHost(id: string) {
  const db = await getDb();
  const [row] = await db
    .select({ booking: bookings, type: bookingTypes, host: users })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.bookingTypeId, bookingTypes.id))
    .innerJoin(users, eq(bookingTypes.userId, users.id))
    .where(eq(bookings.id, id));
  return row ?? null;
}

export async function cancelBooking(id: string, by: { token: string } | { hostId: number }) {
  const row = await bookingWithHost(id);
  if (!row || row.booking.status === "cancelled") return false;
  if ("token" in by && row.booking.manageToken !== by.token) return false;
  if ("hostId" in by && row.host.id !== by.hostId) return false;
  const db = await getDb();
  await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, id));
  let onGoogle = false;
  if (row.booking.googleEventId && row.host.googleRefreshToken) {
    try {
      await deleteGoogleEvent(row.host, row.booking.googleEventId);
      onGoogle = true;
    } catch (err) {
      console.error(`[opencal] could not remove Google event: ${(err as Error).message}`);
    }
  }
  if (!onGoogle) await emailBoth("cancelled", row.host, row.type, row.booking);
  return true;
}

export async function listUpcomingBookings(userId: number) {
  const db = await getDb();
  return db
    .select({ booking: bookings, type: bookingTypes })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.bookingTypeId, bookingTypes.id))
    .where(and(eq(bookingTypes.userId, userId), eq(bookings.status, "confirmed"), gt(bookings.endsAt, new Date())))
    .orderBy(asc(bookings.startsAt));
}

async function emailBoth(kind: "confirmed" | "cancelled", host: User, type: BookingType, booking: Booking) {
  const when = (tz: string) =>
    DateTime.fromJSDate(booking.startsAt).setZone(tz).toFormat("cccc, LLLL d, yyyy 'at' h:mm a ZZZZ");
  const ics = buildIcs({
    uid: booking.id,
    start: booking.startsAt,
    end: booking.endsAt,
    title: `${type.title} with ${host.name}`,
    description: `${booking.notes}\n\nManage: ${manageUrl(booking)}`.trim(),
    location: booking.meetUrl ?? type.location,
    organizer: { name: host.name, email: host.email },
    attendee: { name: booking.name, email: booking.email },
    cancelled: kind === "cancelled",
  });
  const verb = kind === "confirmed" ? "Confirmed" : "Cancelled";
  await sendMail({
    to: booking.email,
    subject: `${verb}: ${type.title} with ${host.name}`,
    text: `Hi ${booking.name},\n\nYour ${type.title} with ${host.name} is ${kind}.\n\nWhen: ${when(booking.timezone)}\nDuration: ${type.durationMinutes} minutes${type.location ? `\nWhere: ${type.location}` : ""}\n\n${kind === "confirmed" ? `Need to cancel? ${manageUrl(booking)}` : ""}`,
    ics,
  });
  await sendMail({
    to: host.email,
    subject: `${verb}: ${booking.name} — ${type.title}`,
    text: `${booking.name} <${booking.email}>\nWhen: ${when(host.timezone)}\n${booking.notes ? `\nNotes:\n${booking.notes}\n` : ""}`,
    ics,
  });
}
