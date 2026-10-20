# What we learned from TidyCal (via REA)

Captured 2026-10-19 with REA 6.7.0 (`inspect-web-page`, `observe-web-session`) against
public booking pages on tidycal.com. Behavior and page structure only — no TidyCal source
code or assets were copied.

## Public flow
1. **Profile page** `tidycal.com/<user>` — avatar, name, heading "Book a call with me:",
   list of booking types (title, description, duration, "View details").
2. **Booking page** `tidycal.com/<user>/<slug>` — left: owner, title, duration, description,
   visitor timezone ("(-06:00) MDT - Denver"). Right: month calendar, then the time slots for
   the selected day (15-min steps for a 15-min meeting, gaps where busy).
3. **Confirm step** (same page, no navigation) — summary (type, with, when, timezone,
   duration) + **Your name\*** and **Your email\***, "Book event" / "Cancel".
4. Submit → confirmation.

## Architecture evidence
- Server-rendered (Laravel: hidden `_token` CSRF input, `timezone` hidden input).
- REA's session timeline showed **no API calls while choosing a date/time** — slots ship
  with the page. Only the final submit hits the server (guarded by reCAPTCHA).

## What OpenCal implements
| TidyCal | OpenCal |
|---|---|
| Profile page with booking types | `/[username]` |
| Calendar + slots, visitor timezone | `/[username]/[slug]`, slots computed server-side |
| Confirm form (name, email) | same + optional notes, honeypot instead of reCAPTCHA |
| Confirmation + calendar invite | `/booking/[id]` with .ics download + cancel link |
| Calendar conflict checking | Google/Outlook/iCloud "secret iCal address" feeds (no OAuth) |
| Email confirmations | Resend, if `RESEND_API_KEY` is set |
| Paid bookings, teams, polls | not built (yet) |
