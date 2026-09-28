"use client";

import { Fragment, useActionState, useEffect, useMemo, useState } from "react";

import {
  startTmsGatewayPayment,
  submitTmsPayment,
  type FormState,
  type GatewayFormState,
} from "@/app/(dashboard)/actions";
import { BankDetails } from "@/components/tms/BankDetails";
import { GatewayAttemptActions } from "@/components/tms/GatewayAttemptActions";
import { PaymentInstructions } from "@/components/tms/PaymentInstructions";
import { PaymentStatusBadge } from "@/components/tms/PaymentStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { formatDate, formatRMExact } from "@/lib/format";
import { isChargeOverdue } from "@/lib/metrics";
import type { TmsPayMethod, TmsRentCharge } from "@/lib/types";

/**
 * Room Rental — how a tenant pays.
 *
 * The Jodoo form this replaces opens by asking for an email and fills the
 * tenancy in from it. That step is gone rather than ported: the tenant is
 * already signed in, so the tenancy comes from row level security instead of
 * from a field anyone could type anyone else's address into.
 *
 * What is kept is the shape of the payment table — a row per month, split into
 * rental and parking, totalled across the selection — because that is how the
 * office and the tenant both talk about it.
 *
 * Two ways to pay, one selection. A bank transfer needs the slip and waits for
 * the office; an online payment goes to the gateway's page and waits for the
 * gateway. The months are held either way until the attempt is settled or
 * withdrawn, so the same month cannot be paid twice by picking both.
 *
 * `online` is whether the gateway is configured, decided on the server.
 * `returned` is the reference the checkout page sent the tenant back with;
 * what it says is read from the ledger, not from the URL.
 */
export function TmsRoomRentalView({
  online = false,
  returned = "",
}: {
  online?: boolean;
  returned?: string;
}) {
  const { data, now } = useDashboard();
  const [state, action, pending] = useActionState<FormState, FormData>(
    submitTmsPayment,
    {},
  );
  const [gateway, gatewayAction, gatewayPending] = useActionState<
    GatewayFormState,
    FormData
  >(startTmsGatewayPayment, {});
  const [method, setMethod] = useState<TmsPayMethod>("bank");

  // The gateway page is another origin, so the browser goes, not the router.
  useEffect(() => {
    if (gateway.ok && gateway.checkoutUrl) {
      window.location.assign(gateway.checkoutUrl);
    }
  }, [gateway.ok, gateway.checkoutUrl]);

  const tenancy = data.tenancies[0];

  /**
   * One row per month, rent and carpark folded together — the two columns the
   * Jodoo table has. Anything else raised against the room (a utility
   * recharge, a repair) rides in the same row's total rather than getting a
   * column of its own, and the breakdown lists it.
   */
  const months = useMemo(() => {
    const byMonth = new Map<
      string,
      { month: string; charges: TmsRentCharge[]; rent: number; parking: number; other: number }
    >();

    // 'submitted' charges are deliberately absent: they are already claimed,
    // and offering them again is how a tenant pays twice.
    for (const charge of data.charges.filter((c) => c.status === "unpaid")) {
      const entry = byMonth.get(charge.periodMonth) ?? {
        month: charge.periodMonth,
        charges: [],
        rent: 0,
        parking: 0,
        other: 0,
      };
      entry.charges.push(charge);
      if (charge.kind === "rent") entry.rent += charge.amount;
      else if (charge.kind === "carpark") entry.parking += charge.amount;
      else entry.other += charge.amount;
      byMonth.set(charge.periodMonth, entry);
    }

    // Oldest first. The month you owe for longest is the one to settle first,
    // and it should not be at the bottom of the list. Months not yet due sort
    // to the end by the same rule, which is where they belong: what is owed
    // now comes before what a tenant may choose to pay early.
    return [...byMonth.values()]
      .map((entry) => {
        const due = entry.charges.map((c) => c.dueAt).sort()[0];
        return { ...entry, due, upcoming: Boolean(due) && due > now };
      })
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [data.charges, now]);

  // What is actually owed today, which is not the same as what is listed.
  // A month raised in advance is payable but not outstanding, and counting it
  // as a debt would tell a tenant who is up to date that they are behind.
  const dueNow = months.filter((m) => !m.upcoming);
  const upcoming = months.filter((m) => m.upcoming);

  const [picked, setPicked] = useState<string[]>([]);

  // Summed in sen and divided back, so 0.1 + 0.2 shows as RM 0.30 and the
  // figure a tenant transfers is the figure the ledger holds.
  const total =
    months
      .filter((m) => picked.includes(m.month))
      .reduce((sum, m) => sum + Math.round((m.rent + m.parking + m.other) * 100), 0) /
    100;

  const chargeIds = months
    .filter((m) => picked.includes(m.month))
    .flatMap((m) => m.charges.map((c) => c.id));

  // Newest first — a tenant checking on a submission just made.
  const submissions = data.submissions;
  const awaiting = submissions.filter((s) => s.status === "submitted");
  const returnedSubmission = returned
    ? submissions.find((s) => s.reference === returned)
    : undefined;

  const busy = pending || gatewayPending || Boolean(gateway.ok && gateway.checkoutUrl);

  if (!tenancy) {
    return (
      <>
        <PageHeader
          eyebrow="Tenant Management System"
          title="Room Rental"
          description="This account is not linked to a tenancy yet."
        />
        <Card>
          <p className="px-5 py-8 text-sm text-ink-muted">
            Your sign-in works, but it has not been connected to a room. The
            office can link it — until then there is nothing to pay here.
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Tenant Management System"
        title="Room Rental"
        description={`${tenancy.roomCode || tenancy.roomLabel}${
          tenancy.propertyName ? ` at ${tenancy.propertyName}` : ""
        }. Pick the months you are paying for, then pay online or by bank transfer.`}
      />

      {returnedSubmission ? (
        <Card
          className={
            returnedSubmission.status === "verified"
              ? "mt-4 border-received-line bg-received-soft"
              : "mt-4"
          }
        >
          <div className="px-5 py-4 text-sm">
            {returnedSubmission.status === "verified" ? (
              <>
                <p className="font-semibold text-received">Payment received.</p>
                <p className="mt-1 text-ink">
                  <span className="font-mono font-semibold">{returnedSubmission.reference}</span>{" "}
                  is settled and the months are marked paid. Thank you.
                </p>
              </>
            ) : returnedSubmission.status === "submitted" ? (
              <>
                <p className="font-semibold text-ink">Still waiting on the gateway.</p>
                <p className="mt-1 text-ink-muted">
                  If you completed the payment it is usually confirmed within a
                  minute. Use <em>Check status</em> below — the months stay held
                  for you until then.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-ink">That online payment was not completed.</p>
                <p className="mt-1 text-ink-muted">
                  Nothing was charged. The months are listed again below and can
                  be paid either way.
                </p>
              </>
            )}
          </div>
        </Card>
      ) : null}

      {state.ok && state.reference ? (
        <Card className="mt-4 border-received-line bg-received-soft">
          <div className="px-5 py-4 text-sm">
            <p className="font-semibold text-received">Payment submitted.</p>
            {/* Not "quote this on the transfer": the slip field is required,
                so the money has already moved by the time this reference
                exists. It identifies the submission, and that is what it is
                good for. */}
            <p className="mt-1 text-ink">
              Your reference is{" "}
              <span className="font-mono font-semibold">{state.reference}</span>
              . Keep it — quote it if you need to ask the office about this
              payment. The office will confirm it once the slip has been
              checked; the months stay listed as awaiting confirmation until
              then.
            </p>
          </div>
        </Card>
      ) : null}

      {gateway.ok && gateway.checkoutUrl ? (
        <Card className="mt-4 border-accent-line bg-accent-soft">
          <div className="px-5 py-4 text-sm">
            <p className="font-semibold text-accent">Taking you to the payment page…</p>
            <p className="mt-1 text-ink">
              Reference{" "}
              <span className="font-mono font-semibold">{gateway.reference}</span>.
              If nothing happens,{" "}
              <a href={gateway.checkoutUrl} className="font-medium underline">
                open the payment page
              </a>
              .
            </p>
          </div>
        </Card>
      ) : null}

      {awaiting.length > 0 ? (
        <Card className="mt-4">
          <CardHeader
            title="Awaiting confirmation"
            hint="Held for you. A bank transfer waits for the office; an online payment waits for the gateway."
          />
          <ul className="divide-y divide-line">
            {awaiting.map((submission) => (
              <li key={submission.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-ink">{submission.reference}</p>
                    <p className="text-xs text-ink-muted">
                      {submission.method === "gateway" ? "Started" : "Submitted"}{" "}
                      {formatDate(submission.submittedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-3">
                    <span className="tnum font-medium text-ink">
                      {formatRMExact(submission.amount)}
                    </span>
                    <PaymentStatusBadge
                      status={submission.status}
                      method={submission.method}
                      kind="payment"
                    />
                  </div>
                </div>
                {submission.method === "gateway" ? (
                  <GatewayAttemptActions
                    kind="payment"
                    id={submission.id}
                    checkoutUrl={submission.checkoutUrl}
                    canResume
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <form action={action}>
        <Card className="mt-4">
          <CardHeader
            title="What you owe"
            hint={
              months.length === 0
                ? "Nothing outstanding — you are up to date"
                : dueNow.length === 0
                  ? "Nothing due — the months below are open early if you want to pay ahead"
                  : upcoming.length > 0
                    ? "Tick the months you are paying for. The later ones are not due yet — pay them early if you like"
                    : "Tick the months you are paying for"
            }
          />

          {months.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-muted">
              Every month raised against your room has been paid or submitted.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-ink-subtle">
                    <th className="px-5 py-2 font-medium">Pay</th>
                    <th className="px-5 py-2 font-medium">Payment Month</th>
                    <th className="px-5 py-2 text-right font-medium">Rental</th>
                    <th className="px-5 py-2 text-right font-medium">Parking</th>
                    <th className="px-5 py-2 text-right font-medium">Other</th>
                    <th className="px-5 py-2 text-right font-medium">Total</th>
                    <th className="px-5 py-2 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {months.map((month, index) => {
                    const monthTotal = month.rent + month.parking + month.other;
                    const late = month.charges.some((c) =>
                      isChargeOverdue(c, now),
                    );
                    const due = month.due;
                    // A heading rather than a second table: the columns are the
                    // same and the sums add up across both, so splitting them
                    // apart would only make the total harder to follow.
                    const startsAdvance =
                      month.upcoming && !months[index - 1]?.upcoming;
                    return (
                      <Fragment key={month.month}>
                        {startsAdvance ? (
                          <tr className="border-b border-line bg-surface-2">
                            <td
                              colSpan={7}
                              className="px-5 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-subtle"
                            >
                              Pay in advance — not due yet
                            </td>
                          </tr>
                        ) : null}
                      <tr
                        className="border-b border-line last:border-0"
                      >
                        <td className="px-5 py-2.5">
                          <input
                            type="checkbox"
                            checked={picked.includes(month.month)}
                            onChange={(event) =>
                              setPicked((prev) =>
                                event.target.checked
                                  ? [...prev, month.month]
                                  : prev.filter((m) => m !== month.month),
                              )
                            }
                            className="size-4 rounded border-line text-accent focus:ring-accent"
                            aria-label={`Pay ${formatDate(month.month)}`}
                          />
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 font-medium text-ink">
                          {formatDate(month.month)}
                        </td>
                        <td className="px-5 py-2.5 text-right text-ink-muted">
                          {month.rent > 0 ? formatRMExact(month.rent) : "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right text-ink-muted">
                          {month.parking > 0 ? formatRMExact(month.parking) : "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right text-ink-muted">
                          {month.other > 0 ? formatRMExact(month.other) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-right font-medium text-ink">
                          {formatRMExact(monthTotal)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5">
                          {late ? (
                            <Badge tone="stalled">Overdue</Badge>
                          ) : month.upcoming ? (
                            <span className="whitespace-nowrap text-ink-subtle">
                              {formatDate(due)} · early
                            </span>
                          ) : (
                            <span className="text-ink-muted">
                              {formatDate(due)}
                            </span>
                          )}
                        </td>
                      </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* What the selection adds up to, restated where the eye lands
              before the upload — the figure to transfer. */}
          {picked.length > 0 ? (
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-line bg-surface-2 px-5 py-4">
              <span className="text-sm text-ink-muted">
                {picked.length} {picked.length === 1 ? "month" : "months"}{" "}
                selected
              </span>
              <span className="tnum font-display text-2xl font-bold text-ink">
                {formatRMExact(total)}
              </span>
            </div>
          ) : null}
        </Card>

        {chargeIds.map((id) => (
          <input key={id} type="hidden" name="charge_ids" value={id} />
        ))}
        <input type="hidden" name="method" value="bank" />

        {/* Same shape as the topup screen: the controls on the left, what to
            do with them on the right. The two pages are the same errand and
            should not need learning twice. */}
        <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="How to pay"
              hint={
                picked.length === 0
                  ? "Tick a month above first"
                  : `Paying ${formatRMExact(total)}`
              }
            />
            <div className="space-y-4 px-5 py-4">
              {online ? (
                <div
                  className="flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label="How to pay"
                >
                  <MethodButton
                    active={method === "gateway"}
                    onClick={() => setMethod("gateway")}
                    title="Pay online"
                    hint="Card, online banking or e-wallet"
                  />
                  <MethodButton
                    active={method === "bank"}
                    onClick={() => setMethod("bank")}
                    title="Bank transfer"
                    hint="Transfer yourself and attach the slip"
                  />
                </div>
              ) : null}

              {online && method === "gateway" ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[0.6875rem] font-medium text-ink-muted">
                      Anything the office should know (optional)
                    </span>
                    <input
                      type="text"
                      name="notes"
                      className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                    />
                  </label>

                  {gateway.error ? (
                    <p
                      role="alert"
                      className="rounded-lg border border-stalled-line bg-stalled-soft px-4 py-3 text-sm text-stalled"
                    >
                      {gateway.error}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    formAction={gatewayAction}
                    formNoValidate
                    disabled={busy || picked.length === 0}
                    className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy
                      ? "Opening the payment page…"
                      : picked.length === 0
                        ? "Choose a month above"
                        : `Pay ${formatRMExact(total)} online`}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <span className="mb-1 block text-[0.6875rem] font-medium text-ink-muted">
                      Payment slip
                    </span>
                    <input
                      type="file"
                      name="slip"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      required
                      className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-accent-hover"
                    />
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-[0.6875rem] font-medium text-ink-muted">
                      Anything the office should know (optional)
                    </span>
                    <input
                      type="text"
                      name="notes"
                      className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                    />
                  </label>

                  {state.error ? (
                    <p
                      role="alert"
                      className="rounded-lg border border-stalled-line bg-stalled-soft px-4 py-3 text-sm text-stalled"
                    >
                      {state.error}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={busy || picked.length === 0}
                    className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending
                      ? "Submitting…"
                      : picked.length === 0
                        ? "Choose a month above"
                        : `Submit payment of ${formatRMExact(total)}`}
                  </button>
                </>
              )}
            </div>
          </Card>

          <div className="grid gap-4">
            <PaymentInstructions
              method={online && method === "gateway" ? "gateway" : "bank"}
              kind="payment"
            />
            {online && method === "gateway" ? null : <BankDetails />}
          </div>
        </div>
      </form>

      {submissions.length > 0 ? (
        <Card className="mt-4">
          <CardHeader title="Your payment history" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-ink-subtle">
                  <th className="px-5 py-2 font-medium">Reference</th>
                  <th className="px-5 py-2 font-medium">Submitted</th>
                  <th className="px-5 py-2 font-medium">How</th>
                  <th className="px-5 py-2 text-right font-medium">Amount</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {submissions.map((submission) => (
                  <tr
                    key={submission.id}
                    className="border-b border-line last:border-0"
                  >
                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-ink">
                      {submission.reference}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">
                      {formatDate(submission.submittedAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">
                      {submission.method === "gateway" ? "Online" : "Bank transfer"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right">
                      {formatRMExact(submission.amount)}
                    </td>
                    <td className="px-5 py-2.5">
                      <PaymentStatusBadge
                        status={submission.status}
                        method={submission.method}
                        kind="payment"
                      />
                      {/* The reason is the whole point of a rejection — a
                          tenant who cannot see why cannot fix it. */}
                      {submission.rejectReason ? (
                        <p className="mt-1 max-w-prose text-xs text-ink-muted">
                          {submission.rejectReason}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </>
  );
}

function MethodButton({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={
        active
          ? "flex-1 rounded-lg border border-accent bg-accent-soft px-4 py-3 text-left"
          : "flex-1 rounded-lg border border-line px-4 py-3 text-left transition hover:border-accent-line"
      }
    >
      <span className={active ? "block text-sm font-semibold text-accent" : "block text-sm font-semibold text-ink"}>
        {title}
      </span>
      <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>
    </button>
  );
}
