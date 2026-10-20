# OpenCal

Free, open-source booking links: a TidyCal-style scheduler you host yourself.
Clients open your link, pick an open time in their own timezone, and book. You get a
calendar invite, they get a confirmation, and it never double-books.

Built after studying TidyCal's public booking flow with [REA](https://github.com/morluto/rea),
recording behavior only, no copied code. See [docs/tidycal-findings.md](docs/tidycal-findings.md).

## Features
- A small team: the owner invites people by link; each gets their own page and signs in with Google
- Google Calendar: busy times block slots in real time, and bookings land on the host's calendar
  with a Google Meet link (Google emails the client the invite)
- Profile page (`/your-name`) listing your booking types
- Booking page per type (`/your-name/intro-call`) with month calendar, slot list and visitor timezone
- Weekly hours, per-type duration, start-time step, buffer, minimum notice and booking window
- Extra conflict checking from any other calendar's private iCal URL (Outlook, iCloud)
- Confirmation page with "Add to calendar" (.ics) and self-serve cancel link
- Optional confirmation and cancellation emails with invite attached (Resend)
- Admin at `/admin`: copy share links, manage booking types and hours, see and cancel bookings
- Race-safe: bookings are serialized with a Postgres advisory lock

## Google setup (one time)
1. In Google Cloud, create a project and enable the **Google Calendar API**.
2. Set up the OAuth consent screen (External) with scopes `openid`, `email`, `profile`,
   `calendar.events` and `calendar.freebusy`, then **Publish app**. In Testing mode, Google expires
   calendar access after 7 days.
3. Create an OAuth client ID (Web application) with redirect URI
   `<APP_URL>/api/auth/google/callback` (e.g. `http://localhost:3000/api/auth/google/callback`).
4. Put the ID and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, and set `OWNER_EMAIL`
   to your Google address. The first sign-in with that address becomes the owner.

Without Google configured, the owner signs in with `ADMIN_PASSWORD` instead.

## Run it
```bash
cp .env.example .env.local   # set AUTH_SECRET, OWNER_EMAIL, Google keys
npm install
npm run dev
```
Open http://localhost:3000, then http://localhost:3000/admin.

With no `DATABASE_URL`, OpenCal uses an embedded Postgres (PGlite) saved in `.data/`. That's fine for
a single server. For Vercel or other serverless hosts, set `DATABASE_URL` to a hosted
Postgres (Supabase, Neon). Tables are created automatically on first run.

## Deploy (Vercel + Supabase)
1. Create a Postgres database and copy its connection string (Supabase: use the pooler URL).
2. Import the repo in Vercel and set `AUTH_SECRET`, `DATABASE_URL`, `APP_URL`, `OWNER_EMAIL`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `RESEND_API_KEY` / `EMAIL_FROM`.
3. Add `<APP_URL>/api/auth/google/callback` as a redirect URI on your Google OAuth client.
4. Sign in at `/admin`, then share `https://your-domain/your-name`.

MIT licensed.
