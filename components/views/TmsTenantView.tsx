"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDashboard } from "@/components/providers/DashboardProvider";
import {
  CFG_PAY_ACCOUNT,
  CFG_PAY_BANK,
  CFG_PAY_CONTACT,
  CFG_PAY_TO_NAME,
} from "@/lib/config";
import { formatDate, formatRMExact } from "@/lib/format";
import { TMS_CHARGE_KINDS, TMS_TENANCY_STATUSES } from "@/lib/constants";
import { isChargeOverdue } from "@/lib/metrics";

/**
 * What a TMS tenant sees. Deliberately not the agent dashboard with the other
 * rows filtered out: a tenant has two questions — what do I owe, and where do
 * I send it — and everything here answers one of them.
 *
 * Row level security already limits the data to their own tenancy; this view
 * decides what is worth showing of it. Master rent, landlord bank details and
 * anything about the other rooms never appear, and the policies would not
 * return them anyway.
 */
export function TmsTenantView() {
  const { data, now } = useDashboard();

  // RLS returns exactly one tenancy for a tenant. Taking the first is safe,
  // and the empty case below covers a profile that was never linked.
  const tenancy = data.tenancies[0];

  if (!tenancy) {
    return (
      <>
        <PageHeader
          eyebrow="Tenant Management System"
          title="Your tenancy"
          description="This account is not linked to a tenancy yet."
        />
        <Card>
          <div className="px-5 py-8 text-sm text-ink-muted">
            <p className="mb-2 font-medium text-ink">Nothing to show yet.</p>
            <p className="max-w-prose">
              Your sign-in works, but it has not been connected to a room. The
              office can link it — until then there is nothing to pay here.
            </p>
          </div>
        </Card>
      </>
    );
  }

  const status = TMS_TENANCY_STATUSES.find((s) => s.key === tenancy.status)!;

  // Newest first: this month is what a tenant came to look at.
  const charges = [...data.charges].sort((a, b) =>
    b.periodMonth.localeCompare(a.periodMonth),
  );
  const outstanding = charges.filter((c) => c.status === "unpaid");
  const owed = outstanding.reduce((sum, c) => sum + c.amount, 0);
  const overdue = outstanding.filter((c) => isChargeOverdue(c, now));

  const havePaymentDetails = Boolean(
    CFG_PAY_TO_NAME || CFG_PAY_BANK || CFG_PAY_ACCOUNT,
  );

  return (
    <>
      <PageHeader
        eyebrow="Tenant Management System"
        title="Your tenancy"
        description={`${tenancy.roomCode || tenancy.roomLabel}${
          tenancy.propertyName ? ` at ${tenancy.propertyName}` : ""
        }.`}
      />

      {/* The headline is what is owed, because that is the question. */}
      <Card className="mt-4">
        <CardHeader
          title="Outstanding"
          hint={
            outstanding.length === 0
              ? "Nothing owed — you are up to date"
              : `${outstanding.length} ${outstanding.length === 1 ? "charge" : "charges"} not yet settled`
          }
        />
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <Figure label="Total owed" value={formatRMExact(owed)} emphasis />
          <Figure label="Monthly rent" value={formatRMExact(tenancy.monthlyRent)} />
          <div className="bg-surface px-5 py-4">
            <p className="text-xs font-medium text-ink-muted">Overdue</p>
            <p className="tnum mt-1 font-display text-xl font-semibold text-ink">
              {formatRMExact(overdue.reduce((sum, c) => sum + c.amount, 0))}
            </p>
            <p className="mt-0.5 text-[0.6875rem] text-ink-subtle">
              {overdue.length === 0
                ? "nothing past its due date"
                : `${overdue.length} past due`}
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="How to pay"
            hint="Rent and any extras are settled together"
          />
          <div className="px-5 py-4 text-sm">
            {havePaymentDetails ? (
              <>
                <dl className="space-y-3">
                  {CFG_PAY_TO_NAME ? (
                    <Line term="Pay to" value={CFG_PAY_TO_NAME} />
                  ) : null}
                  {CFG_PAY_BANK ? (
                    <Line term="Bank" value={CFG_PAY_BANK} />
                  ) : null}
                  {CFG_PAY_ACCOUNT ? (
                    <Line term="Account" value={CFG_PAY_ACCOUNT} mono />
                  ) : null}
                  <Line
                    term="Reference"
                    value={`${tenancy.roomCode || tenancy.roomLabel} · ${tenancy.tenantName}`}
                    mono
                  />
                </dl>
                <p className="mt-4 max-w-prose text-xs leading-relaxed text-ink-subtle">
                  Use the reference exactly as shown — it is how a payment is
                  matched to your room. Keep the receipt until the amount above
                  drops to zero.
                </p>
              </>
            ) : (
              <p className="max-w-prose text-ink-muted">
                Payment details have not been published yet. Contact the office
                for where to send this month&apos;s rent.
              </p>
            )}
            {CFG_PAY_CONTACT ? (
              <p className="mt-4 text-xs text-ink-subtle">
                Questions: {CFG_PAY_CONTACT}
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Your tenancy" />
          <div className="grid gap-px bg-line sm:grid-cols-2">
            <Figure
              label="Deposit held"
              value={formatRMExact(tenancy.deposit)}
              note={
                tenancy.advanceRent > 0
                  ? `plus ${formatRMExact(tenancy.advanceRent)} advance rent`
                  : undefined
              }
            />
            <Figure
              label="Rent due on"
              value={`Day ${tenancy.rentDueDay}`}
              note="of each month"
            />
            <Figure label="Moved in" value={formatDate(tenancy.movedInAt)} />
            <div className="bg-surface px-5 py-4">
              <p className="text-xs font-medium text-ink-muted">Status</p>
              <div className="mt-1.5">
                <Badge
                  tone={tenancy.status === "active" ? "received" : "idle"}
                >
                  {status.label}
                </Badge>
              </div>
              {tenancy.movedOutAt ? (
                <p className="mt-1.5 text-[0.6875rem] text-ink-subtle">
                  Moving out {formatDate(tenancy.movedOutAt)}
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Your charges"
          hint="Everything raised against your room, newest first"
        />
        {charges.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">
            Nothing has been charged to your room yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-ink-subtle">
                  <th className="px-5 py-2 font-medium">Month</th>
                  <th className="px-5 py-2 font-medium">What for</th>
                  <th className="px-5 py-2 text-right font-medium">Amount</th>
                  <th className="px-5 py-2 font-medium">Due</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {charges.map((charge) => {
                  const kind = TMS_CHARGE_KINDS.find(
                    (k) => k.key === charge.kind,
                  )!;
                  const late = isChargeOverdue(charge, now);
                  return (
                    <tr
                      key={charge.id}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-5 py-2.5">
                        {formatDate(charge.periodMonth)}
                      </td>
                      <td className="px-5 py-2.5 text-ink-muted">
                        {charge.description || kind.label}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {formatRMExact(charge.amount)}
                      </td>
                      <td className="px-5 py-2.5 text-ink-muted">
                        {formatDate(charge.dueAt)}
                      </td>
                      <td className="px-5 py-2.5">
                        <Badge
                          tone={
                            charge.status === "paid"
                              ? "received"
                              : late
                                ? "stalled"
                                : "risk"
                          }
                        >
                          {charge.status === "paid"
                            ? "Paid"
                            : late
                              ? "Overdue"
                              : "Not paid"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Figure({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p
        className={
          emphasis
            ? "tnum mt-1 font-display text-2xl font-bold text-ink"
            : "tnum mt-1 font-display text-xl font-semibold text-ink"
        }
      >
        {value}
      </p>
      {note ? (
        <p className="mt-0.5 text-[0.6875rem] text-ink-subtle">{note}</p>
      ) : null}
    </div>
  );
}

function Line({
  term,
  value,
  mono,
}: {
  term: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-ink-muted">{term}</dt>
      <dd className={mono ? "font-mono text-ink" : "font-medium text-ink"}>
        {value}
      </dd>
    </div>
  );
}
