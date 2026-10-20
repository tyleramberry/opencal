import Link from "next/link";
import { logoutAction } from "./actions";

export function AdminNav({ username }: { username: string }) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <Link href="/admin" className="text-xl font-bold">OpenCal</Link>
      <nav className="flex items-center gap-2 text-sm">
        <Link className="btn-ghost" href="/admin">Bookings</Link>
        <Link className="btn-ghost" href="/admin/settings">Hours &amp; profile</Link>
        <Link className="btn-ghost" href={`/${username}`} target="_blank">My page ↗</Link>
        <form action={logoutAction}><button className="btn-ghost">Sign out</button></form>
      </nav>
    </header>
  );
}
