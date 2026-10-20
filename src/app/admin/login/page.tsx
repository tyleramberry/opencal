"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export default function Login() {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-4">
      <form action={action} className="card w-full space-y-4 p-8">
        <h1 className="text-xl font-bold">OpenCal admin</h1>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" className="input" required autoFocus />
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>Sign in</button>
      </form>
    </main>
  );
}
