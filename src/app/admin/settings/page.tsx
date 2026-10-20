import { requireUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";
import { AdminNav } from "../AdminNav";
import { disconnectGoogleAction } from "../actions";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const p = await requireUser();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <AdminNav user={p} />
      <GoogleCard connected={!!p.googleRefreshToken} configured={googleConfigured()} />
      <SettingsForm profile={p} />
    </main>
  );
}

function GoogleCard({ connected, configured }: { connected: boolean; configured: boolean }) {
  return (
    <section className="card mb-8 flex flex-wrap items-center justify-between gap-4 p-6">
      <div>
        <h2 className="text-lg font-bold">Google Calendar</h2>
        <p className="text-sm text-gray-500">
          {connected
            ? "Connected. Busy times are blocked, and new bookings are added to your calendar with a Meet link."
            : configured
              ? "Not connected. Connect to block busy times and add bookings to your calendar."
              : "Google sign-in isn't configured on this OpenCal yet."}
        </p>
      </div>
      {connected ? (
        <form action={disconnectGoogleAction}><button className="btn-ghost">Disconnect</button></form>
      ) : (
        configured && (
          <form action="/api/auth/google/start"><button className="btn-primary">Connect Google Calendar</button></form>
        )
      )}
    </section>
  );
}
