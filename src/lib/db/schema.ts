import { boolean, integer, jsonb, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

/** Weekly hours in the user's timezone, keyed by ISO weekday (1 = Monday ... 7 = Sunday). */
export type WeeklyHours = Record<string, { start: string; end: string }[]>;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  heading: text("heading").notNull().default("Book a call with me:"),
  timezone: text("timezone").notNull(),
  weeklyHours: jsonb("weekly_hours").$type<WeeklyHours>().notNull(),
  calendarFeeds: jsonb("calendar_feeds").$type<string[]>().notNull().default([]),
  role: text("role").$type<"owner" | "member">().notNull().default("member"),
  active: boolean("active").notNull().default(true),
  googleSub: text("google_sub").unique(),
  /** Encrypted with AUTH_SECRET. */
  googleRefreshToken: text("google_refresh_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable("invites", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  acceptedBy: integer("accepted_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookingTypes = pgTable(
  "booking_types",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    durationMinutes: integer("duration_minutes").notNull(),
    slotStepMinutes: integer("slot_step_minutes").notNull().default(15),
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    minNoticeHours: integer("min_notice_hours").notNull().default(4),
    maxDaysAhead: integer("max_days_ahead").notNull().default(30),
    location: text("location").notNull().default(""),
    addMeet: boolean("add_meet").notNull().default(true),
    active: boolean("active").notNull().default(true),
  },
  (t) => [unique("booking_types_user_slug").on(t.userId, t.slug)],
);

export const bookings = pgTable("bookings", {
  id: text("id").primaryKey(),
  bookingTypeId: integer("booking_type_id")
    .notNull()
    .references(() => bookingTypes.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  notes: text("notes").notNull().default(""),
  timezone: text("timezone").notNull(),
  status: text("status").$type<"confirmed" | "cancelled">().notNull().default("confirmed"),
  manageToken: text("manage_token").notNull(),
  googleEventId: text("google_event_id"),
  meetUrl: text("meet_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type BookingType = typeof bookingTypes.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
