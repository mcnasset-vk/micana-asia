"use client";

import { useState, useTransition } from "react";

import {
  checkTmsGatewayAttempt,
  withdrawTmsGatewayAttempt,
} from "@/app/(dashboard)/actions";
import type { TmsGatewayKind } from "@/lib/types";

/**
 * What can be done about an online attempt that is still open.
 *
 * Three things, and the same three for a tenant and for the office:
 * continue to the payment page, ask the gateway whether it has been paid,
 * or withdraw it so the months are free to pay another way. The office does
 * not get "continue" — it is not their money to pay.
 *
 * "Check status" exists because the gateway's own notice can be late. It
 * does not mark anything paid from here; it asks, through the same path the
 * notice would have taken.
 */
export function GatewayAttemptActions({
  kind,
  id,
  checkoutUrl,
  canResume,
}: {
  kind: TmsGatewayKind;
  id: string;
  checkoutUrl: string;
  canResume: boolean;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const check = () => {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const result = await checkTmsGatewayAttempt(kind, id);
      if (result.error) setError(result.error);
      else if (result.outcome === "pending") {
        setNote("The gateway has not recorded a payment yet.");
      }
    });
  };

  const withdraw = () => {
    if (
      !window.confirm(
        kind === "payment"
          ? "Withdraw this online payment? The months become payable again."
          : "Withdraw this online topup?",
      )
    ) {
      return;
    }
    setError(null);
    setNote(null);
    startTransition(async () => {
      const result = await withdrawTmsGatewayAttempt(kind, id);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {canResume && checkoutUrl ? (
        <a
          href={checkoutUrl}
          className="rounded-lg border border-accent-line bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent transition hover:bg-accent hover:text-white"
        >
          Continue paying
        </a>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={check}
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:border-accent-line hover:text-accent disabled:opacity-50"
      >
        {busy ? "Working…" : "Check status"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={withdraw}
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:border-stalled-line hover:text-stalled disabled:opacity-50"
      >
        Withdraw
      </button>
      {note ? <span className="text-xs text-ink-subtle">{note}</span> : null}
      {error ? (
        <span role="alert" className="text-xs text-stalled">
          {error}
        </span>
      ) : null}
    </div>
  );
}
