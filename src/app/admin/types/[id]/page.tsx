import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { AdminNav } from "../../AdminNav";
import { TypeForm } from "./TypeForm";

export const dynamic = "force-dynamic";

export default async function EditType({ params }: { params: Promise<{ id: string }> }) {
  const p = await requireUser();
  const { id } = await params;
  let type = null;
  if (id !== "new") {
    const db = await getDb();
    [type] = await db.select().from(schema.bookingTypes).where(and(eq(schema.bookingTypes.id, Number(id)), eq(schema.bookingTypes.userId, p.id)));
    if (!type) notFound();
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <AdminNav user={p} />
      <TypeForm type={type} username={p.username} />
    </main>
  );
}
