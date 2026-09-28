"use client";

import { useActionState, useEffect, useState } from "react";

import {
  Field,
  Footnote,
  INPUT,
  Notice,
  Problem,
  Submit,
} from "@/components/auth/parts";

import { requestCode, verifyCode, type CodeState } from "@/app/login/actions";

/**
 * Email, then a one-time code. No password anywhere on this screen.
 *
 * Not the email alone, which is what makes it safe to hand this link out. An
 * address is not a secret — it is on the tenancy agreement and in the
 * building's WhatsApp group — so an address by itself at the door would give
 * anyone who knows one somebody else's rent, meter and room, and the ability
 * to declare payments in their name. The code costs the tenant one screen.
 */
export function TenantCodeForm({ next }: { next: string }) {
  const [asked, askAction] = useActionState<CodeState, FormData>(
    requestCode,
    {},
  );
  const [checked, checkAction] = useActionState<CodeState, FormData>(
    verifyCode,
    {},
  );

  // Step two begins once a code has gone out. `checked.email` keeps it there
  // after a wrong code, which would otherwise drop the tenant back to step one
  // and send a second email for no reason.
  const address = checked.email ?? asked.email ?? "";
  const sent = Boolean(checked.sent || asked.sent);

  if (!sent) {
    return (
      <form action={askAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />

        <Field label="Your email address">
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
          We send a one-time code to your email. There is no password to
          remember.
        </Footnote>
      </form>
    );
  }

  return (
    <form action={checkAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="email" value={address} />

      <Notice>
        If we have an account for <strong>{address}</strong>, a code is on its
        way. It is good for one hour.
      </Notice>

      {/* No fixed length. How many digits Supabase sends is a project setting
          and this one sends eight, so a box capped at six would truncate the
          real code as it was typed — the most confusing failure available,
          because the tenant watches the last digits vanish. */}
      <Field label="Code from your email">
        <input
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={12}
          required
          autoFocus
          placeholder="••••••"
          className={`${INPUT} text-center font-mono text-lg tracking-[0.35em]`}
        />
      </Field>

      {checked.error ? <Problem>{checked.error}</Problem> : null}
      {asked.error ? <Problem>{asked.error}</Problem> : null}

      <Submit idle="Sign in" busy="Checking…" />

      {/* Same form, different action. The address is already in a hidden field
          here, so resending needs nothing typed — and formNoValidate is what
          stops the browser demanding the code box be filled before it will let
          somebody ask for the code. */}
      <Resend action={askAction} />

      <Footnote>
        Nothing arrived? Look in your spam folder, and check the address above
        is right — we answer the same way whether or not we have it. If you ask
        twice, use the code from the newest email.
      </Footnote>

      <a
        href="/tenantsearch/login"
        className="block w-full text-center text-xs font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 transition hover:text-amber-800"
      >
        Use a different email address
      </a>
    </form>
  );
}

/**
 * Ask for another code, without leaving the screen or retyping the address.
 *
 * Its own component so the wait starts itself: this mounts at the moment a
 * code goes out, so the deadline is the initial state rather than something an
 * effect has to set afterwards.
 *
 * There is a wait at all because Supabase rate limits OTP requests and answers
 * the whole project with an error once the hourly ceiling is hit. A tenant
 * pressing the button five times while the first email is still in flight
 * would spend an allowance that everybody shares.
 */
const COOLDOWN_SECONDS = 30;

function Resend({ action }: { action: (formData: FormData) => void }) {
  // Seconds, counted down by the interval rather than worked out from the
  // clock during render — reading Date.now() while rendering makes the
  // component impure, and React is right to object.
  const [left, setLeft] = useState(COOLDOWN_SECONDS);

  useEffect(() => {
    const id = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <button
      type="submit"
      // Same form, a different action. The address is already in a hidden
      // field, so this needs nothing typed — and formNoValidate is what stops
      // the browser demanding the code box be filled before it will let
      // somebody ask for the code.
      formAction={action}
      formNoValidate
      disabled={left > 0}
      onClick={() => setLeft(COOLDOWN_SECONDS)}
      className="block w-full text-center text-xs font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 transition hover:text-amber-800 disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
    >
      {left > 0 ? `Send another code in ${left}s` : "Send another code"}
    </button>
  );
}
