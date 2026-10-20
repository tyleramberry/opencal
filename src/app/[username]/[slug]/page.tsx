import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingType, getProfileByUsername, getSlots } from "@/lib/data";
import { BookingWidget } from "./BookingWidget";

export const dynamic = "force-dynamic";

export default async function BookingPage({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const p = await getProfileByUsername(username);
  const type = await getBookingType(slug);
  if (!p || !type || !type.active) notFound();
  // Like TidyCal, open times are computed on the server and shipped with the page.
  const slots = await getSlots(p, type);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="card grid overflow-hidden md:grid-cols-[300px_1fr]">
        <aside className="border-b border-gray-200 p-6 md:border-r md:border-b-0">
          <Link href={`/${p.username}`} className="text-sm text-gray-500 hover:text-brand">
            ← {p.name}
          </Link>
          <h1 className="mt-4 text-xl font-bold">{type.title}</h1>
          <p className="mt-2 text-sm font-medium text-gray-700">⏱ {type.durationMinutes} minutes</p>
          {type.location && <p className="mt-1 text-sm text-gray-700">📍 {type.location}</p>}
          {type.description && <p className="mt-4 text-sm whitespace-pre-line text-gray-600">{type.description}</p>}
        </aside>
        <BookingWidget
          slug={type.slug}
          slots={slots}
          durationMinutes={type.durationMinutes}
          ownerName={p.name}
          title={type.title}
        />
      </div>
      <p className="mt-6 text-center text-xs text-gray-400">Powered by OpenCal · free &amp; open source</p>
    </main>
  );
}
