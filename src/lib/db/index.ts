import "server-only";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzlePostgres<typeof schema>>;

const SETUP_SQL = `
create table if not exists profile (
  id integer primary key,
  username text not null,
  name text not null,
  heading text not null default 'Book a call with me:',
  email text,
  timezone text not null,
  weekly_hours jsonb not null,
  calendar_feeds jsonb not null default '[]'
);
create table if not exists booking_types (
  id serial primary key,
  slug text not null unique,
  title text not null,
  description text not null default '',
  duration_minutes integer not null,
  slot_step_minutes integer not null default 15,
  buffer_minutes integer not null default 0,
  min_notice_hours integer not null default 4,
  max_days_ahead integer not null default 30,
  location text not null default '',
  active boolean not null default true
);
create table if not exists bookings (
  id text primary key,
  booking_type_id integer not null references booking_types(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  name text not null,
  email text not null,
  notes text not null default '',
  timezone text not null,
  status text not null default 'confirmed',
  manage_token text not null,
  created_at timestamptz not null default now()
);
create index if not exists bookings_starts_at_idx on bookings (starts_at);
`;

const DEFAULT_HOURS = JSON.stringify(
  Object.fromEntries(["1", "2", "3", "4", "5"].map((d) => [d, [{ start: "09:00", end: "17:00" }]])),
);

async function seed(exec: (sql: string, params?: unknown[]) => Promise<unknown>) {
  await exec(
    `insert into profile (id, username, name, email, timezone, weekly_hours)
     values (1, $1, $2, $3, $4, $5::jsonb) on conflict (id) do nothing`,
    [
      process.env.OWNER_USERNAME ?? "me",
      process.env.OWNER_NAME ?? "Your Name",
      process.env.OWNER_EMAIL ?? null,
      process.env.OWNER_TIMEZONE ?? "America/Denver",
      DEFAULT_HOURS,
    ],
  );
  await exec(
    `insert into booking_types (slug, title, description, duration_minutes, slot_step_minutes)
     values ('15-minute-meeting', '15 Minute Meeting', 'Book a meeting with me for 15 minutes!', 15, 15),
            ('30-minute-meeting', '30 Minute Meeting', 'Book a meeting with me for 30 minutes!', 30, 30)
     on conflict (slug) do nothing`,
  );
}

async function create(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { prepare: false });
    await client.unsafe(SETUP_SQL);
    await seed((sql, params) => client.unsafe(sql, params as never[]));
    return drizzlePostgres(client, { schema });
  }
  // No DATABASE_URL: embedded Postgres stored on disk, for local use and single-server self-hosting.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await client.exec(SETUP_SQL);
  await seed((sql, params) => client.query(sql, params));
  return drizzlePglite(client, { schema }) as unknown as Db;
}

const globalForDb = globalThis as unknown as { opencalDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  globalForDb.opencalDb ??= create().catch((err) => {
    globalForDb.opencalDb = undefined;
    throw err;
  });
  return globalForDb.opencalDb;
}

export { schema };
