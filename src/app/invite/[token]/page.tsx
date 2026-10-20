import { getOpenInvite } from "@/lib/data";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await getOpenInvite(token);
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="card w-full space-y-4 p-8 text-center">
        {row ? (
          <>
            <h1 className="text-xl font-bold">{row.from.name} invited you to OpenCal</h1>
            <p className="text-sm text-gray-600">
              You&apos;ll get your own booking page to send to clients. Sign in with Google: that also lets OpenCal
              check your calendar so nobody books you when you&apos;re busy, and puts new bookings on it.
            </p>
            {googleConfigured() ? (
              <form action="/api/auth/google/start">
                <input type="hidden" name="invite" value={token} />
                <button className="btn-primary w-full">Continue with Google</button>
              </form>
            ) : (
              <p className="text-sm text-red-600">Google sign-in isn&apos;t set up on this OpenCal yet.</p>
            )}
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">This invite isn&apos;t valid</h1>
            <p className="text-sm text-gray-600">It may have been used already or revoked. Ask for a new link.</p>
          </>
        )}
      </div>
    </main>
  );
}
