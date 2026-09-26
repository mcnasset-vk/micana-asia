"use client";

import { GatewayAttemptActions } from "@/components/tms/GatewayAttemptActions";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { formatDate, formatRMExact } from "@/lib/format";
import type { TmsGatewayEvent, TmsGatewayKind } from "@/lib/types";

/**
 * Online payments, as the office sees them.
 *
 * Nothing here is confirmed by hand — that is the point of a gateway. What
 * the office can do is ask ("Check status", for a webhook that has not
 * come), withdraw an attempt a tenant has abandoned so the months come
 * free, and look at the two outcomes a machine cannot settle:
 *
 *   mismatch   the gateway reported a payment whose reference or amount
 *              disagrees with the row it points at. Not applied.
 *   late_paid  money arrived for an attempt that was already closed —
 *              withdrawn, expired, or turned down. Not applied. The tenant
 *              has paid and the ledger does not say so; somebody has to.
 *
 * Both are rare and both are recorded rather than guessed at, which is why
 * they are listed here instead of resolved in code.
 */
export function TmsGatewayPanel() {
  const { data, isTmsAgent } = useDashboard();
  if (!isTmsAgent) return null;

  const open = [
    ...data.submissions
      .filter((s) => s.status === "submitted" && s.method === "gateway")
      .map((s) => ({
        kind: "payment" as TmsGatewayKind,
        id: s.id,
        who: s.tenantName,
        room: s.roomCode,
        detail: `${s.chargeIds.length} ${s.chargeIds.length === 1 ? "charge" : "charges"}`,
        reference: s.reference,
        amount: s.amount,
        startedAt: s.submittedAt,
        expiresAt: s.checkoutExpiresAt,
      })),
    ...data.topups
      .filter((t) => t.status === "submitted" && t.method === "gateway")
      .map((t) => ({
        kind: "topup" as TmsGatewayKind,
        id: t.id,
        who: t.tenantName,
        room: t.roomCode,
        detail: `Meter topup · ${t.meterLabel}`,
        reference: t.reference,
        amount: t.amount,
        startedAt: t.submittedAt,
        expiresAt: t.checkoutExpiresAt,
      })),
  ].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const attention = data.gatewayEvents.filter(
    (e) => e.outcome === "mismatch" || e.outcome === "late_paid",
  );

  if (open.length === 0 && attention.length === 0) return null;

  const referenceFor = (event: TmsGatewayEvent) =>
    data.submissions.find((s) => s.id === event.submissionId)?.reference ??
    data.topups.find((t) => t.id === event.topupId)?.reference ??
    event.eventId;

  return (
    <Card>
      <CardHeader
        title="Online payments"
        hint={
          attention.length > 0
            ? `${attention.length} need${attention.length === 1 ? "s" : ""} a person — see below`
            : `${open.length} started and not yet confirmed by the gateway`
        }
      />

      {attention.length > 0 ? (
        <ul className="divide-y divide-line border-b border-line bg-stalled-soft">
          {attention.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="text-ink">
                  <span className="font-mono">{referenceFor(event)}</span>
                  <Badge tone="stalled" className="ml-2">
                    {event.outcome === "late_paid"
                      ? "Paid after closing"
                      : "Amount or reference mismatch"}
                  </Badge>
                </p>
                <p className="mt-0.5 max-w-prose text-xs text-ink-muted">
                  {event.outcome === "late_paid"
                    ? "The gateway reports this as paid, but the attempt had already been withdrawn or had expired. The ledger was not changed — check the gateway dashboard and settle it by hand."
                    : "The gateway's report does not agree with what was recorded here. The ledger was not changed — compare both before doing anything."}
                </p>
              </div>
              <span className="shrink-0 text-xs text-ink-subtle">
                {event.provider} · {event.source} · {formatDate(event.receivedAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {open.length > 0 ? (
        <ul className="divide-y divide-line">
          {open.map((attempt) => (
            <li key={attempt.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {attempt.who}
                    <span className="ml-2 text-sm font-normal text-ink-muted">
                      {attempt.room}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    <span className="font-mono">{attempt.reference}</span> ·{" "}
                    {attempt.detail} · started {formatDate(attempt.startedAt)}
                    {attempt.expiresAt
                      ? ` · link valid until ${formatDate(attempt.expiresAt)}`
                      : ""}
                  </p>
                </div>
                <span className="tnum shrink-0 font-display text-xl font-semibold text-ink">
                  {formatRMExact(attempt.amount)}
                </span>
              </div>
              <GatewayAttemptActions
                kind={attempt.kind}
                id={attempt.id}
                checkoutUrl=""
                canResume={false}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-ink-muted">
          No online payment is waiting on the gateway.
        </p>
      )}
    </Card>
  );
}
