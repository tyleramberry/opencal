# OpenCal

Free, open-source booking links: a TidyCal-style scheduler you host yourself.
Clients open your link, pick an open time in their own timezone, and book. You get a
calendar invite, they get a confirmation, and it never double-books.

Built after studying TidyCal's public booking flow with [REA](https://github.com/morluto/rea),
recording behavior only, no copied code. See [docs/tidycal-findings.md](docs/tidycal-findings.md).

## Features
- Profile page (`/your-name`) listing your booking types
- Booking page per type (`/your-name/intro-call`) with month calendar, slot list and visitor timezone
- Weekly hours, per-type duration, start-time step, buffer, minimum notice and booking window
- Conflict checking against your real calendar through its private iCal URL (Google, Outlook, iCloud), with no OAuth
- Confirmation page with "Add to calendar" (.ics) and self-serve cancel link
- Optional confirmation and cancellation emails with invite attached (Resend)
- Admin at `/admin`: copy share links, manage booking types and hours, see and cancel bookings
- Race-safe: bookings are serialized with a Postgres advisory lock

## Run it
```bash
cp .env.example .env.local   # set ADMIN_PASSWORD
npm install
npm run dev
```
Open http://localhost:3000, then http://localhost:3000/admin.

With no `DATABASE_URL`, OpenCal uses an embedded Postgres (PGlite) saved in `.data/`. That's fine for
a single server. For Vercel or other serverless hosts, set `DATABASE_URL` to a hosted
Postgres (Supabase, Neon). Tables are created automatically on first run.

## Deploy (Vercel + Supabase)
1. Create a Postgres database and copy its connection string (Supabase: use the pooler URL).
2. Import the repo in Vercel and set `ADMIN_PASSWORD`, `DATABASE_URL`, `APP_URL`, `OWNER_*`
   and optionally `RESEND_API_KEY` / `EMAIL_FROM`.
3. Share `https://your-domain/your-name`.

MIT licensed.
