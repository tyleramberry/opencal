import Link from "next/link";
import type { User } from "@/lib/db/schema";
import { logoutAction } from "./actions";

export function AdminNav({ user }: { user: User }) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <div>
        <Link href="/admin" className="text-xl font-bold">OpenCal</Link>
        <p className="text-xs text-gray-500">Signed in as {user.email}</p>
      </div>
      <nav className="flex flex-wrap items-center gap-2 text-sm">
        <Link className="btn-ghost" href="/admin">Bookings</Link>
        <Link className="btn-ghost" href="/admin/settings">Hours &amp; calendar</Link>
        {user.role === "owner" && <Link className="btn-ghost" href="/admin/team">Team</Link>}
        <Link className="btn-ghost" href={`/${user.username}`} target="_blank">My page ↗</Link>
        <form action={logoutAction}><button className="btn-ghost">Sign out</button></form>
      </nav>
    </header>
  );
}
