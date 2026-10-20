import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfileByUsername, listBookingTypes } from "@/lib/data";
import { initials } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const p = await getProfileByUsername(username);
  if (!p) notFound();
  const types = await listBookingTypes({ activeOnly: true });

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-brand text-2xl font-bold text-white">
          {initials(p.name)}
        </div>
        <h1 className="text-2xl font-bold">{p.name}</h1>
        <p className="mt-2 text-gray-600">{p.heading}</p>
      </div>

      <ul className="space-y-3">
        {types.map((t) => (
          <li key={t.id}>
            <Link
              href={`/${p.username}/${t.slug}`}
              className="card flex items-center justify-between gap-4 p-5 transition hover:border-brand hover:shadow-md"
            >
              <div>
                <h2 className="font-semibold">{t.title}</h2>
                {t.description && <p className="mt-1 text-sm text-gray-600">{t.description}</p>}
                <p className="mt-2 text-xs font-medium text-gray-500">{t.durationMinutes} minutes</p>
              </div>
              <span className="text-sm font-semibold text-brand">Book →</span>
            </Link>
          </li>
        ))}
        {types.length === 0 && <p className="text-center text-gray-500">No booking links are open right now.</p>}
      </ul>

      <p className="mt-12 text-center text-xs text-gray-400">Powered by OpenCal · free &amp; open source</p>
    </main>
  );
}
