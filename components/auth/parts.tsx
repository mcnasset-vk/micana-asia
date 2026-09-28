"use client";

import { useFormStatus } from "react-dom";

/**
 * The pieces both sign-in screens are built from.
 *
 * There are two: /login for anyone with a password, and /tenantsearch/login
 * for a tenant signing in with a code. They are separate routes on purpose —
 * a tenant gets a link that only ever asks for their email — but they are one
 * design, and a field that looks different on one of them would read as a
 * different site rather than a different door.
 *
 * Colours are written out rather than taken from the theme tokens: both
 * sign-in screens are light whatever the device prefers. See the note on
 * SignInShell.
 */

export const INPUT =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 " +
  "placeholder:text-slate-400 transition focus:border-amber-400 focus:bg-white " +
  "focus:outline-none focus:ring-4 focus:ring-amber-400/20";

export function Field({
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

export function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-700"
    >
      {children}
    </p>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
      {children}
    </p>
  );
}

export function Footnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-1 text-center text-[0.6875rem] leading-relaxed text-slate-500">
      {children}
    </p>
  );
}

export function Submit({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-amber-500/25 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? busy : idle}
    </button>
  );
}
