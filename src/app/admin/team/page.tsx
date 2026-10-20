import { DateTime } from "luxon";
import { requireOwner } from "@/lib/auth";
import { listMembers, listOpenInvites } from "@/lib/data";
import { appUrl } from "@/lib/google";
import { revokeInviteAction, setMemberActiveAction } from "../actions";
import { AdminNav } from "../AdminNav";
import { CopyLink } from "../CopyLink";
import { InviteForm } from "./InviteForm";

export const dynamic = "force-dynamic";

export default async function Team() {
  const me = await requireOwner();
  const [members, invites] = await Promise.all([listMembers(), listOpenInvites()]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <AdminNav user={me} />

      <section className="mb-10">
        <h2 className="mb-1 text-lg font-bold">Invite someone</h2>
        <p className="mb-3 text-sm text-gray-500">
          They get their own booking page and sign in with their own Google account. Send them the link yourself.
        </p>
        <InviteForm />
      </section>

      {invites.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-bold">Waiting to join</h2>
          <div className="card divide-y divide-gray-100">
            {invites.map((inv) => (
              <div key={inv.token} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{inv.email}</p>
                  <p className="text-sm text-gray-500">Invited {DateTime.fromJSDate(inv.createdAt).toRelative()}</p>
                </div>
                <div className="flex gap-2">
                  <CopyLink path={`/invite/${inv.token}`} />
                  <form action={revokeInviteAction}>
                    <input type="hidden" name="token" value={inv.token} />
                    <button className="btn-ghost text-red-600">Revoke</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">People</h2>
        <div className="card divide-y divide-gray-100">
          {members.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">
                  {m.name}
                  {m.role === "owner" && <span className="ml-2 rounded bg-brand-soft px-2 py-0.5 text-xs text-brand">owner</span>}
                  {!m.active && <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">turned off</span>}
                </p>
                <p className="text-sm text-gray-500">
                  {m.email} · {appUrl().replace(/^https?:\/\//, "")}/{m.username} · Google {m.googleRefreshToken ? "connected" : "not connected"}
                </p>
              </div>
              {m.role === "member" && (
                <form action={setMemberActiveAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="active" value={m.active ? "false" : "true"} />
                  <button className={`btn-ghost ${m.active ? "text-red-600" : ""}`}>{m.active ? "Turn off" : "Turn back on"}</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
