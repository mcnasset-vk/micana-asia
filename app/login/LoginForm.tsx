"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { IconLock } from "@/components/ui/icons";

import {
  requestCode,
  signIn,
  verifyCode,
  type CodeState,
  type LoginState,
} from "./actions";

/**
 * Two ways in, and the order matters.
 *
 * A tenant signs in with their email address and a six-digit code: nothing to
 * remember, nothing to reset, and no password for the office to be phoned
 * about. The code is what makes that safe — an email address is not a secret,
 * it is on the tenancy agreement and in the building's WhatsApp group, so
 * letting an address alone through the door would hand anyone who knows it
 * somebody else's rent, meter and the ability to declare payments as them.
 *
 * The password form is still here, one link away, because staff have passwords
 * and because an evening when the mail provider is struggling should not be an
 * evening nobody can get in.
 *
 * Colours are written out rather than taken from the theme tokens, for the
 * reason given on the page this sits on: the sign-in screen is light whatever
 * the device prefers.
 */
export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [mode, setMode] = useState<"code" | "password">("code");

  return (
    <div className="space-y-4">
      {notice ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
          {notice}
        </p>
      ) : null}

      {mode === "code" ? (
        <CodeSignIn next={next} onUsePassword={() => setMode("password")} />
      ) : (
        <PasswordSignIn next={next} onUseCode={() => setMode("code")} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Email + code                                                                */
/* -------------------------------------------------------------------------- */

function CodeSignIn({
  next,
  onUsePassword,
}: {
  next: string;
  onUsePassword: () => void;
}) {
  const [asked, askAction] = useActionState<CodeState, FormData>(
    requestCode,
    {},
  );
  const [checked, checkAction] = useActionState<CodeState, FormData>(
    verifyCode,
    {},
  );

  // Step two begins the moment a code has gone out. `checked.email` keeps it
  // there after a wrong code, which would otherwise reset the whole form and
  // send a second email for no reason.
  const address = checked.email ?? asked.email ?? "";
  const sent = Boolean(checked.sent || asked.sent);

  if (!sent) {
    return (
      <form action={askAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />

        <Field label="Email address">
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            placeholder="you@example.com"
            className={INPUT}
          />
        </Field>

        {asked.error ? <Problem>{asked.error}</Problem> : null}

        <Submit idle="Email me a code" busy="Sending…" />

        <Footnote>
          We send a six-digit code to your email. There is no password to
          remember.
        </Footnote>

        <Switcher onClick={onUsePassword}>I have a password instead</Switcher>
      </form>
    );
  }

  return (
    <form action={checkAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="email" value={address} />

      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs leading-relaxed text-emerald-900">
        If we have an account for <strong>{address}</strong>, a code is on its
        way. It is good for one hour.
      </p>

      <Field label="Six-digit code">
        <input
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          autoFocus
          placeholder="000000"
          className={`${INPUT} text-center font-mono text-lg tracking-[0.4em]`}
        />
      </Field>

      {checked.error ? <Problem>{checked.error}</Problem> : null}

      <Submit idle="Sign in" busy="Checking…" />

      <Footnote>
        Nothing arrived? Check the address is right — we answer the same way
        whether or not we have it — then ask again, or call the office.
      </Footnote>

      <Switcher onClick={() => window.location.reload()}>
        Use a different email address
      </Switcher>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Email + password                                                            */
/* -------------------------------------------------------------------------- */

function PasswordSignIn({
  next,
  onUseCode,
}: {
  next: string;
  onUseCode: () => void;
}) {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

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

      {state.error ? <Problem>{state.error}</Problem> : null}

      <Submit idle="Sign in" busy="Signing in…" />

      <p className="flex items-start gap-2 pt-1 text-[0.6875rem] leading-relaxed text-slate-500">
        <IconLock className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
        <span>
          Accounts are set up by the office. Give them a call if you cannot sign
          in.
        </span>
      </p>

      <Switcher onClick={onUseCode}>Email me a code instead</Switcher>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                      */
/* -------------------------------------------------------------------------- */

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

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-700"
    >
      {children}
    </p>
  );
}

function Footnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-1 text-center text-[0.6875rem] leading-relaxed text-slate-500">
      {children}
    </p>
  );
}

function Switcher({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-center text-xs font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 transition hover:text-amber-800"
    >
      {children}
    </button>
  );
}

function Submit({ idle, busy }: { idle: string; busy: string }) {
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
