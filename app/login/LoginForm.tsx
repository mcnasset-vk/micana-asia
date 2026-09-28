"use client";

import { useActionState } from "react";

import {
  Field,
  INPUT,
  Notice,
  Problem,
  Submit,
} from "@/components/auth/parts";
import { IconLock } from "@/components/ui/icons";

import { signIn, type LoginState } from "./actions";

/**
 * Email and password, which is how staff sign in.
 *
 * Tenants have their own door at /tenantsearch/login, where an emailed code
 * stands in for a password. The link below points there rather than leaving
 * somebody who has never been given a password guessing at this form.
 */
export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {notice ? <Notice>{notice}</Notice> : null}

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

      <a
        href="/tenantsearch/login"
        className="block w-full text-center text-xs font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 transition hover:text-amber-800"
      >
        I&rsquo;m a tenant — email me a code instead
      </a>
    </form>
  );
}
