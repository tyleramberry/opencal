import { getBooking, getProfile } from "@/lib/data";
import { buildIcs } from "@/lib/ics";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const row = await getBooking(id, token);
  if (!row) return new Response("Not found", { status: 404 });
  const p = await getProfile();
  const ics = buildIcs({
    uid: row.booking.id,
    start: row.booking.startsAt,
    end: row.booking.endsAt,
    title: `${row.type.title} with ${p.name}`,
    description: row.booking.notes,
    location: row.type.location,
    organizer: { name: p.name, email: p.email },
    attendee: { name: row.booking.name, email: row.booking.email },
    cancelled: row.booking.status === "cancelled",
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${row.type.slug}.ics"`,
    },
  });
}
