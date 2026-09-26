"use client";

import { useState, useTransition } from "react";

import { verifyTmsPayment, verifyTmsTopup } from "@/app/(dashboard)/actions";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { formatDate, formatRMExact } from "@/lib/format";

/**
 * What tenants have claimed and nobody has checked yet.
 *
 * This is the only screen in TMS where the interface's job is to slow someone
 * down. Every other list is there to be scanned; this one asks the agent to
 * open a slip and compare two numbers before pressing anything, so the slip
 * link is the most prominent thing in each row and the confirm button says the
 * amount rather than "OK".
 *
 * Rejection demands a reason because the tenant reads it. tms_verify_payment
 * refuses an empty one, so the prompt below is a courtesy rather than the
 * enforcement.
 */
export function TmsVerificationQueue() {
  const { data, isTmsAgent } = useDashboard();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Slips only. An online attempt is the gateway's to confirm and sits in
  // TmsGatewayPanel instead; tms_verify_* refuses it anyway.
  const payments = data.submissions.filter(
    (s) => s.status === "submitted" && s.method === "bank",
  );
  const topups = data.topups.filter(
    (t) => t.status === "submitted" && t.method === "bank",
  );

  if (!isTmsAgent) return null;
  if (payments.length === 0 && topups.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Payments to confirm"
          hint="Tenant-submitted payments and meter topups land here"
        />
        <p className="px-5 py-8 text-sm text-ink-muted">
          Nothing waiting. Every submission has been dealt with.
        </p>
      </Card>
    );
  }

  const settle = (
    kind: "payment" | "topup",
    id: string,
    approve: boolean,
  ) => {
    let reason = "";
    if (!approve) {
      // A prompt is crude, but the alternative is a modal for a field the
      // agent fills in perhaps twice a month, and the function rejects an
      // empty reason anyway.
      reason = window.prompt("Why is this being turned down?")?.trim() ?? "";
      if (!reason) return;
    }
    setError(null);
    setBusy(id);
    startTransition(async () => {
      const result =
        kind === "payment"
          ? await verifyTmsPayment(id, approve, reason)
          : await verifyTmsTopup(id, approve, reason);
      setBusy(null);
      if (result.error) setError(result.error);
    });
  };

  return (
    <Card>
      <CardHeader
        title="Payments to confirm"
        hint={`${payments.length + topups.length} waiting — open the slip before confirming`}
      />

      {error ? (
        <p
          role="alert"
          className="border-b border-stalled-line bg-stalled-soft px-5 py-3 text-sm text-stalled"
        >
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-line">
        {payments.map((submission) => (
          <li key={submission.id} className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {submission.tenantName}
                  <span className="ml-2 text-sm font-normal text-ink-muted">
                    {submission.roomCode}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  <span className="font-mono">{submission.reference}</span> ·
                  submitted {formatDate(submission.submittedAt)} ·{" "}
                  {submission.chargeIds.length}{" "}
                  {submission.chargeIds.length === 1 ? "charge" : "charges"}
                </p>
                {submission.notes ? (
                  <p className="mt-1 max-w-prose text-xs italic text-ink-subtle">
                    “{submission.notes}”
                  </p>
                ) : null}
              </div>
              <span className="tnum shrink-0 font-display text-xl font-semibold text-ink">
                {formatRMExact(submission.amount)}
              </span>
            </div>

            <Actions
              slipUrl={submission.slipUrl}
              amount={submission.amount}
              busy={busy === submission.id}
              onApprove={() => settle("payment", submission.id, true)}
              onReject={() => settle("payment", submission.id, false)}
            />
          </li>
        ))}

        {topups.map((topup) => (
          <li key={topup.id} className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {topup.tenantName}
                  <span className="ml-2 text-sm font-normal text-ink-muted">
                    {topup.roomCode}
                  </span>
                  <Badge tone="accent" className="ml-2">
                    Meter topup
                  </Badge>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  <span className="font-mono">{topup.reference}</span> ·{" "}
                  {topup.meterLabel} · submitted {formatDate(topup.submittedAt)}
                </p>
              </div>
              <span className="tnum shrink-0 font-display text-xl font-semibold text-ink">
                {formatRMExact(topup.amount)}
              </span>
            </div>

            <Actions
              slipUrl={topup.slipUrl}
              amount={topup.amount}
              busy={busy === topup.id}
              onApprove={() => settle("topup", topup.id, true)}
              onReject={() => settle("topup", topup.id, false)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Actions({
  slipUrl,
  amount,
  busy,
  onApprove,
  onReject,
}: {
  slipUrl: string;
  amount: number;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {slipUrl ? (
        <a
          href={slipUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-accent-line bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent transition hover:bg-accent hover:text-white"
        >
          Open payment slip
        </a>
      ) : (
        // Storage refused the signed URL. Confirming without seeing the slip is
        // exactly what this screen exists to prevent, so say so rather than
        // rendering a link that goes nowhere.
        <span className="rounded-lg border border-stalled-line bg-stalled-soft px-3 py-1.5 text-xs text-stalled">
          Slip unavailable — do not confirm
        </span>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={onApprove}
        className="rounded-lg bg-received px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Working…" : `Confirm ${formatRMExact(amount)}`}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onReject}
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:border-stalled-line hover:text-stalled disabled:opacity-50"
      >
        Turn down
      </button>
    </div>
  );
}
