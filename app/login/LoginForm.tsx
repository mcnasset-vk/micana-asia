"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { IconLock } from "@/components/ui/icons";

import { signIn, type LoginState } from "./actions";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {notice ? (
        <p className="rounded-lg border border-risk-line bg-risk-soft px-3 py-2.5 text-xs text-risk">
          {notice}
        </p>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">
          Email address
        </span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@example.com"
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">
          Password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
        />
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-stalled-line bg-stalled-soft px-3 py-2.5 text-xs text-stalled"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />

      <p className="flex items-start gap-2 pt-1 text-[0.6875rem] leading-relaxed text-ink-subtle">
        <IconLock className="mt-0.5 size-3.5 shrink-0" />
        Accounts are created by the super admin. Contact them if you cannot sign
        in.
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}
