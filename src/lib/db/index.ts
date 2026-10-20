import "server-only";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzlePostgres<typeof schema>>;

const SETUP_SQL = `
create table if not exists users (
  id serial primary key,
  username text not null unique,
  name text not null,
  email text not null unique,
  heading text not null default 'Book a call with me:',
  timezone text not null,
  weekly_hours jsonb not null,
  calendar_feeds jsonb not null default '[]',
  role text not null default 'member',
  active boolean not null default true,
  google_sub text unique,
  google_refresh_token text,
  created_at timestamptz not null default now()
);
create table if not exists invites (
  token text primary key,
  email text not null,
  created_by integer not null references users(id),
  accepted_by integer references users(id),
  created_at timestamptz not null default now()
);
create table if not exists booking_types (
  id serial primary key,
  user_id integer not null references users(id),
  slug text not null,
  title text not null,
  description text not null default '',
  duration_minutes integer not null,
  slot_step_minutes integer not null default 15,
  buffer_minutes integer not null default 0,
  min_notice_hours integer not null default 4,
  max_days_ahead integer not null default 30,
  location text not null default '',
  add_meet boolean not null default true,
  active boolean not null default true,
  constraint booking_types_user_slug unique (user_id, slug)
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
  google_event_id text,
  meet_url text,
  created_at timestamptz not null default now()
);
create index if not exists bookings_starts_at_idx on bookings (starts_at);
`;

async function create(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { prepare: false });
    await client.unsafe(SETUP_SQL);
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

export type { Db };
export { schema };
