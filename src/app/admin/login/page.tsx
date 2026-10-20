import { googleConfigured } from "@/lib/google";
import { PasswordLogin } from "./PasswordLogin";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const google = googleConfigured();
  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-4">
      <div className="card w-full space-y-4 p-8">
        <h1 className="text-xl font-bold">Sign in to OpenCal</h1>
        {error && error !== "google-not-configured" && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {google ? (
          <>
            <form action="/api/auth/google/start"><button className="btn-primary w-full">Continue with Google</button></form>
            <p className="text-xs text-gray-500">Signing in also connects your Google Calendar, so busy times are blocked and bookings land on your calendar.</p>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500">Google sign-in isn&apos;t configured, so the owner signs in with the admin password.</p>
            <PasswordLogin />
          </>
        )}
      </div>
    </main>
  );
}
