"use client";

import { useActionState, useState } from "react";
import { inviteAction } from "../actions";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteAction, {});
  const [copied, setCopied] = useState(false);
  return (
    <div className="card space-y-3 p-4">
      <form action={action} className="flex flex-wrap gap-2">
        <label htmlFor="invite-email" className="sr-only">Email</label>
        <input id="invite-email" name="email" type="email" required placeholder="teammate@gmail.com" className="input min-w-0 flex-1" />
        <button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create invite link"}</button>
      </form>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.link && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft p-3 text-sm">
          <code className="min-w-0 flex-1 break-all">{state.link}</code>
          <button
            type="button"
            className="btn-ghost"
            onClick={async () => {
              await navigator.clipboard.writeText(state.link!);
              setCopied(true);
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
