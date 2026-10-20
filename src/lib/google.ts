import "server-only";
import { decrypt } from "./crypto";
import type { User } from "./db/schema";
import type { Interval } from "./slots";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

export const googleConfigured = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const redirectUri = () => `${appUrl()}/api/auth/google/callback`;

export function googleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${json.error_description ?? json.error ?? res.status}`);
  return json as { access_token: string; expires_in: number; refresh_token?: string; scope: string };
}

export async function exchangeCode(code: string) {
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!res.ok) throw new Error("Could not read your Google profile.");
  const profile = (await res.json()) as { sub: string; email: string; email_verified: boolean; name?: string };
  if (!profile.email_verified) throw new Error("Your Google email isn't verified.");
  return { tokens, profile };
}

const accessCache = new Map<number, { token: string; expiresAt: number }>();

async function accessToken(user: User) {
  if (!user.googleRefreshToken) return null;
  const hit = accessCache.get(user.id);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;
  const t = await tokenRequest({ refresh_token: decrypt(user.googleRefreshToken), grant_type: "refresh_token" });
  accessCache.set(user.id, { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 });
  return t.access_token;
}

async function calendarApi(user: User, path: string, init: RequestInit = {}) {
  const token = await accessToken(user);
  if (!token) return null;
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 204 || res.status === 410) return {};
  const json = await res.json();
  if (!res.ok) throw new Error(`Google Calendar error: ${json.error?.message ?? res.status}`);
  return json;
}

const busyCache = new Map<number, { at: number; busy: Interval[] }>();

/** Busy blocks on the user's primary Google Calendar. Cached for one minute. */
export async function googleBusy(user: User, until: Date): Promise<Interval[]> {
  if (!user.googleRefreshToken || !googleConfigured()) return [];
  const hit = busyCache.get(user.id);
  if (hit && Date.now() - hit.at < 60_000) return hit.busy;
  try {
    const json = await calendarApi(user, "/freeBusy", {
      method: "POST",
      body: JSON.stringify({ timeMin: new Date().toISOString(), timeMax: until.toISOString(), items: [{ id: "primary" }] }),
    });
    const busy = ((json?.calendars?.primary?.busy ?? []) as { start: string; end: string }[]).map((b) => ({
      start: new Date(b.start),
      end: new Date(b.end),
    }));
    busyCache.set(user.id, { at: Date.now(), busy });
    return busy;
  } catch (err) {
    console.error(`[opencal] Google free/busy failed for ${user.username}: ${(err as Error).message}`);
    return hit?.busy ?? [];
  }
}

export function clearBusyCache(userId: number) {
  busyCache.delete(userId);
}

/** Creates the event on the host's calendar; Google emails the invite to the guest. */
export async function createGoogleEvent(
  user: User,
  ev: { requestId: string; title: string; description: string; start: Date; end: Date; location: string; guest: { name: string; email: string }; addMeet: boolean },
): Promise<{ id: string; meetUrl: string | null } | null> {
  const body = {
    summary: ev.title,
    description: ev.description,
    location: ev.location || undefined,
    start: { dateTime: ev.start.toISOString() },
    end: { dateTime: ev.end.toISOString() },
    attendees: [{ email: ev.guest.email, displayName: ev.guest.name }],
    conferenceData: ev.addMeet
      ? { createRequest: { requestId: ev.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } }
      : undefined,
  };
  const json = await calendarApi(user, `/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!json) return null;
  clearBusyCache(user.id);
  return { id: json.id, meetUrl: json.hangoutLink ?? null };
}

export async function deleteGoogleEvent(user: User, eventId: string) {
  await calendarApi(user, `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: "DELETE" });
  clearBusyCache(user.id);
}
