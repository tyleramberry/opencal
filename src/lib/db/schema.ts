import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Weekly hours in the owner's timezone, keyed by ISO weekday (1 = Monday ... 7 = Sunday). */
export type WeeklyHours = Record<string, { start: string; end: string }[]>;

export const profile = pgTable("profile", {
  id: integer("id").primaryKey(),
  username: text("username").notNull(),
  name: text("name").notNull(),
  heading: text("heading").notNull().default("Book a call with me:"),
  email: text("email"),
  timezone: text("timezone").notNull(),
  weeklyHours: jsonb("weekly_hours").$type<WeeklyHours>().notNull(),
  calendarFeeds: jsonb("calendar_feeds").$type<string[]>().notNull().default([]),
});

export const bookingTypes = pgTable("booking_types", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  durationMinutes: integer("duration_minutes").notNull(),
  slotStepMinutes: integer("slot_step_minutes").notNull().default(15),
  bufferMinutes: integer("buffer_minutes").notNull().default(0),
  minNoticeHours: integer("min_notice_hours").notNull().default(4),
  maxDaysAhead: integer("max_days_ahead").notNull().default(30),
  location: text("location").notNull().default(""),
  active: boolean("active").notNull().default(true),
});

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Profile = typeof profile.$inferSelect;
export type BookingType = typeof bookingTypes.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
