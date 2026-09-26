"use client";

import { useActionState, useEffect, useState } from "react";

import {
  startTmsGatewayTopup,
  submitTmsTopup,
  type FormState,
  type GatewayFormState,
} from "@/app/(dashboard)/actions";
import { BankDetails } from "@/components/tms/BankDetails";
import { GatewayAttemptActions } from "@/components/tms/GatewayAttemptActions";
import { PaymentInstructions } from "@/components/tms/PaymentInstructions";
import { PaymentStatusBadge } from "@/components/tms/PaymentStatusBadge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { formatDate, formatRMExact } from "@/lib/format";
import type { TmsPayMethod } from "@/lib/types";

/** The range the business accepts. Mirrored by a CHECK on tms_meter_topups. */
const MIN_TOPUP = 20;
const MAX_TOPUP = 100;

/** The amounts people actually pick, so most topups are one tap. */
const PRESETS = [20, 30, 50, 100];

/**
 * Smartmeter Topup — how a tenant credits a prepaid meter.
 *
 * Like Room Rental, the Jodoo version's email lookup is gone: the meters come
 * from tms_my_meters(), which returns only the caller's own and deliberately
 * omits key_hash — the credential the physical meter authenticates with. There
 * is no policy that could return the balance while withholding it, which is
 * why the function exists.
 *
 * The balance shown is the last verified one. A submitted topup is not in it,
 * and the pending line below says so, because a tenant who thinks their meter
 * has already been credited is a tenant whose lights go out. An online topup
 * is credited the moment the gateway confirms it; a bank transfer when the
 * office has seen the slip.
 */
export function TmsTopupView({
  online = false,
  returned = "",
}: {
  online?: boolean;
  returned?: string;
}) {
  const { data } = useDashboard();
  const [state, action, pending] = useActionState<FormState, FormData>(
    submitTmsTopup,
    {},
  );
  const [gateway, gatewayAction, gatewayPending] = useActionState<
    GatewayFormState,
    FormData
  >(startTmsGatewayTopup, {});
  const [method, setMethod] = useState<TmsPayMethod>("bank");

  useEffect(() => {
    if (gateway.ok && gateway.checkoutUrl) {
      window.location.assign(gateway.checkoutUrl);
    }
  }, [gateway.ok, gateway.checkoutUrl]);

  const meters = data.meters.filter((m) => m.billingMode === "prepaid");
  const [selected, setSelected] = useState(meters[0]?.id ?? "");
  const [amount, setAmount] = useState<number | "">(PRESETS[2]);

  const meter = meters.find((m) => m.id === selected) ?? meters[0];
  const topups = data.topups;
  const awaiting = topups.filter((t) => t.status === "submitted");
  const returnedTopup = returned
    ? topups.find((t) => t.reference === returned)
    : undefined;

  const busy = pending || gatewayPending || Boolean(gateway.ok && gateway.checkoutUrl);
  const amountValid = amount !== "" && amount >= MIN_TOPUP && amount <= MAX_TOPUP;

  if (meters.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Tenant Management System"
          title="Smartmeter Topup"
          description="No prepaid meter is registered to your room."
        />
        <Card>
          <div className="px-5 py-8 text-sm text-ink-muted">
            <p className="mb-2 font-medium text-ink">Nothing to top up.</p>
            <p className="max-w-prose">
              Your room either has no smart meter, or its electricity is billed
              monthly from a meter reading rather than paid for in advance. If
              you think that is wrong, the office can check.
            </p>
          </div>
        </Card>
      </>
    );
  }

  const low = meter && meter.balance <= meter.lowBalanceThreshold;

  return (
    <>
      <PageHeader
        eyebrow="Tenant Management System"
        title="Smartmeter Topup"
        description="Credit your prepaid meter — pay online, or transfer the amount and attach the slip."
      />

      {returnedTopup ? (
        <Card
          className={
            returnedTopup.status === "verified"
              ? "mt-4 border-received-line bg-received-soft"
              : "mt-4"
          }
        >
          <div className="px-5 py-4 text-sm">
            {returnedTopup.status === "verified" ? (
              <>
                <p className="font-semibold text-received">Meter credited.</p>
                <p className="mt-1 text-ink">
                  <span className="font-mono font-semibold">{returnedTopup.reference}</span>{" "}
                  went through
                  {returnedTopup.balanceAfter == null
                    ? "."
                    : ` — the balance is now ${formatRMExact(returnedTopup.balanceAfter)}.`}
                </p>
              </>
            ) : returnedTopup.status === "submitted" ? (
              <>
                <p className="font-semibold text-ink">Still waiting on the gateway.</p>
                <p className="mt-1 text-ink-muted">
                  If you completed the payment it is usually confirmed within a
                  minute. Use <em>Check status</em> below.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-ink">That online topup was not completed.</p>
                <p className="mt-1 text-ink-muted">Nothing was charged. Try again below.</p>
              </>
            )}
          </div>
        </Card>
      ) : null}

      {state.ok && state.reference ? (
        <Card className="mt-4 border-received-line bg-received-soft">
          <div className="px-5 py-4 text-sm">
            <p className="font-semibold text-received">Topup submitted.</p>
            <p className="mt-1 text-ink">
              Quote{" "}
              <span className="font-mono font-semibold">{state.reference}</span>{" "}
              on the transfer. Your balance goes up once the office has checked
              the slip — not before, so leave enough on the meter to last.
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

      <Card className="mt-4">
        <CardHeader
          title="Your meter"
          hint={
            meters.length > 1
              ? "Pick which meter you are topping up"
              : meter.label || meter.deviceId
          }
        />
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <div className="bg-surface px-5 py-4">
            <p className="text-xs font-medium text-ink-muted">Current balance</p>
            <p
              className={
                low
                  ? "tnum mt-1 font-display text-2xl font-bold text-stalled"
                  : "tnum mt-1 font-display text-2xl font-bold text-ink"
              }
            >
              {formatRMExact(meter.balance)}
            </p>
            <p className="mt-0.5 text-[0.6875rem] text-ink-subtle">
              {low ? "running low — top up soon" : "as last confirmed"}
            </p>
          </div>
          <div className="bg-surface px-5 py-4">
            <p className="text-xs font-medium text-ink-muted">Smart meter ID</p>
            <p className="mt-1 font-mono text-lg font-semibold text-ink">
              {meter.deviceId}
            </p>
            <p className="mt-0.5 text-[0.6875rem] text-ink-subtle">
              {meter.label || meter.utility}
            </p>
          </div>
          <div className="bg-surface px-5 py-4">
            <p className="text-xs font-medium text-ink-muted">Awaiting confirmation</p>
            <p className="tnum mt-1 font-display text-xl font-semibold text-ink">
              {formatRMExact(
                awaiting.reduce((sum, t) => sum + Math.round(t.amount * 100), 0) / 100,
              )}
            </p>
            <p className="mt-0.5 text-[0.6875rem] text-ink-subtle">
              {awaiting.length === 0
                ? "nothing pending"
                : `${awaiting.length} not yet credited`}
            </p>
          </div>
        </div>

        {meters.length > 1 ? (
          <div className="border-t border-line px-5 py-4">
            <label className="block">
              <span className="mb-1 block text-[0.6875rem] font-medium text-ink-muted">
                Meter
              </span>
              <select
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
                className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                {meters.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label || option.utility} — {option.deviceId} (
                    {formatRMExact(option.balance)})
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </Card>

      {awaiting.length > 0 ? (
        <Card className="mt-4">
          <CardHeader
            title="Awaiting confirmation"
            hint="Not yet on the meter. A bank transfer waits for the office; an online topup waits for the gateway."
          />
          <ul className="divide-y divide-line">
            {awaiting.map((topup) => (
              <li key={topup.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-ink">{topup.reference}</p>
                    <p className="text-xs text-ink-muted">
                      {topup.meterLabel} ·{" "}
                      {topup.method === "gateway" ? "started" : "submitted"}{" "}
                      {formatDate(topup.submittedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-3">
                    <span className="tnum font-medium text-ink">
                      {formatRMExact(topup.amount)}
                    </span>
                    <PaymentStatusBadge
                      status={topup.status}
                      method={topup.method}
                      kind="topup"
                    />
                  </div>
                </div>
                {topup.method === "gateway" ? (
                  <GatewayAttemptActions
                    kind="topup"
                    id={topup.id}
                    checkoutUrl={topup.checkoutUrl}
                    canResume
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <form action={action}>
        <input type="hidden" name="device_id" value={meter.id} />
        <input type="hidden" name="method" value="bank" />

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Top up amount"
              hint={`RM${MIN_TOPUP} to RM${MAX_TOPUP} only`}
            />
            <div className="space-y-4 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className={
                      amount === preset
                        ? "rounded-lg border border-accent bg-accent-soft px-4 py-2 text-sm font-semibold text-accent"
                        : "rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted transition hover:border-accent-line hover:text-accent"
                    }
                  >
                    RM{preset}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="mb-1 block text-[0.6875rem] font-medium text-ink-muted">
                  Or enter an amount
                </span>
                <input
                  type="number"
                  name="amount"
                  min={MIN_TOPUP}
                  max={MAX_TOPUP}
                  step="1"
                  required
                  value={amount}
                  onChange={(event) =>
                    setAmount(
                      event.target.value === ""
                        ? ""
                        : Number(event.target.value),
                    )
                  }
                  className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </label>

              {online ? (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How to pay">
                  <MethodButton
                    active={method === "gateway"}
                    onClick={() => setMethod("gateway")}
                    title="Pay online"
                    hint="Credited as soon as the gateway confirms"
                  />
                  <MethodButton
                    active={method === "bank"}
                    onClick={() => setMethod("bank")}
                    title="Bank transfer"
                    hint="Attach the slip; the office confirms"
                  />
                </div>
              ) : null}

              {online && method === "gateway" ? (
                <>
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
                    disabled={busy || !amountValid}
                    className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy
                      ? "Opening the payment page…"
                      : !amountValid
                        ? `Enter RM${MIN_TOPUP}–RM${MAX_TOPUP}`
                        : `Pay ${formatRMExact(Number(amount))} online`}
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
                    disabled={busy || !amountValid}
                    className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending
                      ? "Submitting…"
                      : !amountValid
                        ? `Enter RM${MIN_TOPUP}–RM${MAX_TOPUP}`
                        : `Top up ${formatRMExact(Number(amount))}`}
                  </button>
                </>
              )}
            </div>
          </Card>

          <div className="grid gap-4">
            <PaymentInstructions
              method={online && method === "gateway" ? "gateway" : "bank"}
              kind="topup"
            />
            {online && method === "gateway" ? null : <BankDetails />}
          </div>
        </div>
      </form>

      {topups.length > 0 ? (
        <Card className="mt-4">
          <CardHeader title="Your topups" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-ink-subtle">
                  <th className="px-5 py-2 font-medium">Reference</th>
                  <th className="px-5 py-2 font-medium">Submitted</th>
                  <th className="px-5 py-2 font-medium">How</th>
                  <th className="px-5 py-2 text-right font-medium">Amount</th>
                  <th className="px-5 py-2 text-right font-medium">
                    Balance after
                  </th>
                  <th className="px-5 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {topups.map((topup) => (
                  <tr
                    key={topup.id}
                    className="border-b border-line last:border-0"
                  >
                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-ink">
                      {topup.reference}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">
                      {formatDate(topup.submittedAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">
                      {topup.method === "gateway" ? "Online" : "Bank transfer"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right">
                      {formatRMExact(topup.amount)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right text-ink-muted">
                      {topup.balanceAfter == null
                        ? "—"
                        : formatRMExact(topup.balanceAfter)}
                    </td>
                    <td className="px-5 py-2.5">
                      <PaymentStatusBadge
                        status={topup.status}
                        method={topup.method}
                        kind="topup"
                      />
                      {topup.rejectReason ? (
                        <p className="mt-1 max-w-prose text-xs text-ink-muted">
                          {topup.rejectReason}
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
