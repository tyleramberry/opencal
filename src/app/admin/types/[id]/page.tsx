import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { getDb, schema } from "@/lib/db";
import { AdminNav } from "../../AdminNav";
import { TypeForm } from "./TypeForm";

export const dynamic = "force-dynamic";

export default async function EditType({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const p = await getProfile();
  let type = null;
  if (id !== "new") {
    const db = await getDb();
    [type] = await db.select().from(schema.bookingTypes).where(eq(schema.bookingTypes.id, Number(id)));
    if (!type) notFound();
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <AdminNav username={p.username} />
      <TypeForm type={type} username={p.username} />
    </main>
  );
}
