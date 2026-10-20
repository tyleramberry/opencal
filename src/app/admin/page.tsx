import { DateTime } from "luxon";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listBookingTypes, listUpcomingBookings } from "@/lib/data";
import { adminCancelAction } from "./actions";
import { AdminNav } from "./AdminNav";
import { CopyLink } from "./CopyLink";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const p = await requireUser();
  const [types, upcoming] = await Promise.all([listBookingTypes(p.id), listUpcomingBookings(p.id)]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <AdminNav user={p} />

      {!p.googleRefreshToken && (
        <Link href="/admin/settings" className="mb-8 block rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Your Google Calendar isn&apos;t connected, so busy times won&apos;t be blocked. <span className="font-semibold underline">Connect it →</span>
        </Link>
      )}

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Booking links</h2>
          <Link href="/admin/types/new" className="btn-primary">+ New booking type</Link>
        </div>
        <div className="card divide-y divide-gray-100">
          <div className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">Your booking page</p>
              <p className="text-sm text-gray-500">/{p.username}</p>
            </div>
            <CopyLink path={`/${p.username}`} />
          </div>
          {types.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">
                  {t.title} {!t.active && <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">off</span>}
                </p>
                <p className="text-sm text-gray-500">/{p.username}/{t.slug} · {t.durationMinutes} min</p>
              </div>
              <div className="flex gap-2">
                <CopyLink path={`/${p.username}/${t.slug}`} />
                <Link className="btn-ghost" href={`/admin/types/${t.id}`}>Edit</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Upcoming bookings</h2>
        <div className="card divide-y divide-gray-100">
          {upcoming.length === 0 && <p className="p-6 text-sm text-gray-500">No upcoming bookings yet. Share a link above!</p>}
          {upcoming.map(({ booking, type }) => (
            <div key={booking.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">
                  {DateTime.fromJSDate(booking.startsAt).setZone(p.timezone).toFormat("ccc, LLL d · h:mm a")} — {type.title}
                </p>
                <p className="text-sm text-gray-600">
                  {booking.name} · <a className="text-brand" href={`mailto:${booking.email}`}>{booking.email}</a>
                </p>
                {booking.notes && <p className="mt-1 text-sm whitespace-pre-line text-gray-500">“{booking.notes}”</p>}
                {booking.meetUrl && <a className="mt-1 block text-sm text-brand" href={booking.meetUrl} target="_blank" rel="noreferrer">Join Google Meet</a>}
              </div>
              <form action={adminCancelAction}>
                <input type="hidden" name="id" value={booking.id} />
                <button className="btn-ghost text-red-600">Cancel</button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
