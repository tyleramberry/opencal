import { requireAdmin } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { AdminNav } from "../AdminNav";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function Settings() {
  await requireAdmin();
  const p = await getProfile();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <AdminNav username={p.username} />
      <SettingsForm profile={p} />
    </main>
  );
}
