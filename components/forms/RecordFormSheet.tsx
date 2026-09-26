"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Sheet } from "@/components/ui/Sheet";
import { IconClose } from "@/components/ui/icons";

import type { FormState } from "@/app/(dashboard)/actions";

/**
 * Shared shell for the add/edit forms: a slide-over on desktop, a bottom sheet
 * on mobile, so a CIO can update a deal from their phone in the field.
 */
export function RecordFormSheet({
  open,
  onClose,
  title,
  subtitle,
  action,
  state,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  action: (formData: FormData) => void;
  state: FormState;
  children: ReactNode;
}) {
  const titleId = useId();

  // Close once the server action reports success — but only on the SUBMISSION
  // that succeeded, not on every render while `ok` happens to still be true.
  //
  // `onClose` is an inline arrow at every call site, so it is a new identity on
  // each parent render and this effect re-runs constantly. Depending on
  // `state.ok` alone therefore meant that after one successful save the sheet
  // slammed itself shut the instant it was reopened: clicking Add a second time
  // set the parent's state, re-rendered, ran the effect, saw `ok` still true and
  // called onClose again. One record per form per page load, then a reload.
  //
  // useActionState hands back a NEW state object per submission, so remembering
  // the object we already closed for distinguishes "this save just succeeded"
  // from "a save succeeded a while ago".
  const closedFor = useRef<FormState | null>(null);
  useEffect(() => {
    if (state.ok && closedFor.current !== state) {
      closedFor.current = state;
      onClose();
    }
  }, [state, onClose]);

  return (
    <Sheet open={open} onClose={onClose} labelledBy={titleId} width="max-w-xl">
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close form"
          className="shrink-0 rounded-lg border border-line p-1.5 text-ink-muted transition hover:bg-surface-3 hover:text-ink"
        >
          <IconClose className="size-4" />
        </button>
      </header>

      <form
        action={action}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="scrollbar-slim min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {children}

          {state.error ? (
            <p
              role="alert"
              className="rounded-lg border border-stalled-line bg-stalled-soft px-3 py-2.5 text-xs text-stalled"
            >
              {state.error}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-3 hover:text-ink"
          >
            Cancel
          </button>
          <SaveButton />
        </footer>
      </form>
    </Sheet>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}
