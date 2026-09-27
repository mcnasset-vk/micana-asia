"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { IconLock } from "@/components/ui/icons";

import { signIn, type LoginState } from "./actions";

/**
 * Colours are written out rather than taken from the theme tokens, for the
 * reason given on the page this form sits on: the sign-in screen is light
 * whatever the device prefers. Tokens here would render a dark form inside a
 * light card on a phone set to dark.
 */
export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {notice ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
          {notice}
        </p>
      ) : null}

      <Field label="Email address">
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@example.com"
          className={INPUT}
        />
      </Field>

      <Field label="Password">
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={INPUT}
        />
      </Field>

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-700"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />

      <p className="flex items-start gap-2 pt-1 text-[0.6875rem] leading-relaxed text-slate-500">
        <IconLock className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
        <span>
          Accounts are set up by the office. Give them a call if you cannot sign
          in.
        </span>
      </p>
    </form>
  );
}

const INPUT =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 " +
  "placeholder:text-slate-400 transition focus:border-amber-400 focus:bg-white " +
  "focus:outline-none focus:ring-4 focus:ring-amber-400/20";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-amber-500/25 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}
