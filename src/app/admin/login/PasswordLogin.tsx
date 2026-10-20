"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export function PasswordLogin() {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" required autoFocus />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>Sign in</button>
    </form>
  );
}
