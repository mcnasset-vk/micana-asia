"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { IconLock } from "@/components/ui/icons";

import { changeOwnPassword, type PasswordState } from "./actions";

export function ChangePasswordForm() {
  const [state, action] = useActionState<PasswordState, FormData>(
    changeOwnPassword,
    {},
  );

  return (
    <form action={action} className="space-y-4" key={state.ok ? "done" : "edit"}>
      <Field
        label="Current password"
        name="current_password"
        autoComplete="current-password"
      />
      <Field
        label="New password"
        name="new_password"
        autoComplete="new-password"
        hint="At least 12 characters. A short phrase you can remember beats a short jumble you cannot."
      />
      <Field
        label="Confirm new password"
        name="confirm_password"
        autoComplete="new-password"
      />

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-stalled-line bg-stalled-soft px-3 py-2.5 text-xs text-stalled"
        >
          {state.error}
        </p>
      ) : null}

      {state.ok ? (
        <p
          role="status"
          className="rounded-lg border border-received-line bg-received-soft px-3 py-2.5 text-xs text-received"
        >
          Password changed. It applies the next time you sign in.
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function Field({
  label,
  name,
  autoComplete,
  hint,
}: {
  label: string;
  name: string;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
      </span>
      <input
        type="password"
        name={name}
        autoComplete={autoComplete}
        required
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
      />
      {hint ? (
        <span className="mt-1 block text-[0.6875rem] text-ink-subtle">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-2 pt-1">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Changing…" : "Change password"}
      </button>
      <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-subtle">
        <IconLock className="size-3.5" />
        Your current password is checked first
      </span>
    </div>
  );
}
