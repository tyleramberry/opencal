import { DateTime } from "luxon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBooking, getProfile } from "@/lib/data";
import { cancelAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function BookingDetails({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; new?: string }>;
}) {
  const { id } = await params;
  const { token = "", new: isNew } = await searchParams;
  const row = await getBooking(id, token);
  if (!row) notFound();
  const p = await getProfile();
  const { booking, type } = row;
  const start = DateTime.fromJSDate(booking.startsAt).setZone(booking.timezone);
  const cancelled = booking.status === "cancelled";
  const past = booking.endsAt.getTime() < Date.now();

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <div className="card p-8 text-center">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${cancelled ? "bg-gray-100" : "bg-green-100"}`}>
          {cancelled ? "✕" : "✓"}
        </div>
        <h1 className="text-2xl font-bold">
          {cancelled ? "This booking is cancelled" : isNew ? "You're booked!" : "Your booking"}
        </h1>
        {!cancelled && isNew && (
          <p className="mt-2 text-sm text-gray-600">
            {process.env.RESEND_API_KEY
              ? `A calendar invite is on its way to ${booking.email}.`
              : "Save this page — use “Add to calendar” below to get the invite."}
          </p>
        )}

        <dl className="mt-6 grid grid-cols-[90px_1fr] gap-y-2 rounded-xl bg-gray-50 p-4 text-left text-sm">
          <dt className="text-gray-500">What</dt>
          <dd className="font-medium">{type.title}</dd>
          <dt className="text-gray-500">With</dt>
          <dd className="font-medium">{p.name}</dd>
          <dt className="text-gray-500">When</dt>
          <dd className="font-medium">{start.toFormat("cccc, LLLL d, yyyy 'at' h:mm a")}</dd>
          <dt className="text-gray-500">Timezone</dt>
          <dd className="font-medium">{booking.timezone}</dd>
          <dt className="text-gray-500">Duration</dt>
          <dd className="font-medium">{type.durationMinutes} minutes</dd>
          {type.location && (
            <>
              <dt className="text-gray-500">Where</dt>
              <dd className="font-medium">{type.location}</dd>
            </>
          )}
        </dl>

        {!cancelled && !past && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a className="btn-primary" href={`/booking/${booking.id}/ics?token=${token}`}>
              Add to calendar
            </a>
            <form action={cancelAction}>
              <input type="hidden" name="id" value={booking.id} />
              <input type="hidden" name="token" value={token} />
              <button className="btn-ghost text-red-600">Cancel booking</button>
            </form>
          </div>
        )}
        {cancelled && (
          <Link href={`/${p.username}/${type.slug}`} className="btn-primary mt-6">
            Pick a new time
          </Link>
        )}
      </div>
    </main>
  );
}
