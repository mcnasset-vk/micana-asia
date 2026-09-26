"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardHeader } from "@/components/ui/Card";
import { IconChevronRight, IconWarning } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatPercent, formatRM, formatRMCompact } from "@/lib/format";
import type { TmsPaymentTracking } from "@/lib/metrics";
import type { TmsChargeKind, Tone } from "@/lib/types";

const BAR: Record<Tone, string> = {
  received: "bg-received",
  committed: "bg-committed",
  risk: "bg-risk",
  stalled: "bg-stalled",
  idle: "bg-idle",
  accent: "bg-accent",
};

/**
 * What was billed for the month and how much of it came in.
 *
 * The headline is money collected, not charges settled. Nineteen paid RM50
 * carpark fees beside one outstanding RM900 rent is 51% of the money and 95%
 * of the rows, and only one of those two figures is worth acting on.
 *
 * The counts are still shown, because "18 not paid" is what an agent chases.
 */
export function TmsPaymentPanel({
  tracking,
  onOpen,
  onOpenKind,
}: {
  tracking: TmsPaymentTracking;
  onOpen: (which: "paid" | "unpaid" | "overdue") => void;
  onOpenKind: (kind: TmsChargeKind) => void;
}) {
  const chartData = tracking.buckets.map((bucket) => ({
    // The axis gets the short form. "Awaiting Confirmation" at full length
    // squeezed its neighbour's tick off the chart entirely, leaving a bar
    // with no label under it.
    name: bucket.short,
    fullName: bucket.label,
    key: bucket.key,
    count: bucket.count,
    amount: bucket.amount,
    tone: bucket.tone,
  }));

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Monthly Payment Tracking"
        hint={
          tracking.month
            ? `Charges raised for ${tracking.monthLabel}, settled against outstanding`
            : "Every charge raised, settled against outstanding"
        }
      />

      {tracking.overdue.length > 0 ? (
        <button
          type="button"
          onClick={() => onOpen("overdue")}
          className="flex w-full items-center gap-2.5 border-b border-stalled-line bg-stalled-soft px-5 py-2.5 text-left transition hover:brightness-[0.98]"
        >
          <IconWarning className="size-4 shrink-0 text-stalled" />
          <span className="flex-1 text-xs text-stalled">
            <strong className="font-semibold">
              {formatRM(tracking.overdueAmount)}
            </strong>{" "}
            past its due date across {tracking.overdue.length}{" "}
            {tracking.overdue.length === 1 ? "charge" : "charges"}
          </span>
          <IconChevronRight className="size-4 shrink-0 text-stalled" />
        </button>
      ) : null}

      <div className="p-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="tnum font-display text-3xl font-bold tracking-tight text-ink">
            {tracking.nothingBilled
              ? "—"
              : formatPercent(tracking.collectedPct, 0)}
          </span>
          <span className="text-sm text-ink-muted">
            {tracking.nothingBilled ? (
              "nothing billed for this period"
            ) : (
              <>
                of{" "}
                <span className="tnum font-semibold text-ink">
                  {formatRM(tracking.billedAmount)}
                </span>{" "}
                billed has come in
              </>
            )}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          <span className="tnum font-medium text-ink">
            {tracking.paidCount}
          </span>{" "}
          paid ·{" "}
          <span className="tnum font-medium text-ink">
            {tracking.unpaidCount}
          </span>{" "}
          not paid ·{" "}
          <span className="tnum font-medium text-ink">
            {formatRM(tracking.unpaidAmount)}
          </span>{" "}
          still owed
        </p>

        {tracking.billedAmount === 0 && tracking.unpaidCount === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            Nothing has been billed for this month yet. Raise the month from the
            Agent Dashboard and the charges appear here.
          </p>
        ) : (
          <div className="mt-4 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 8, bottom: 4, left: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--line)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={{ stroke: "var(--line)" }}
                  tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                  tickFormatter={(v: number) => formatRMCompact(v)}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-3)" }}
                  content={<PaymentTooltip />}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={96}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={
                        entry.tone === "received"
                          ? "var(--received)"
                          : "var(--risk)"
                      }
                      className="cursor-pointer outline-none transition hover:brightness-110"
                      onClick={() =>
                        onOpen(entry.key === "paid" ? "paid" : "unpaid")
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* What the month is made of. Rent alone rarely explains the total. */}
      <ul className="divide-y divide-line border-t border-line">
        {tracking.byKind
          .filter((kind) => kind.count > 0)
          .map((kind) => (
            <li key={kind.key}>
              <button
                type="button"
                onClick={() => onOpenKind(kind.key)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-surface-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 shrink-0 rounded-sm",
                    BAR[
                      kind.paidAmount >= kind.amount && kind.amount > 0
                        ? "received"
                        : "risk"
                    ],
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{kind.label}</span>
                  <span className="block text-[0.6875rem] text-ink-subtle">
                    {kind.count} {kind.count === 1 ? "charge" : "charges"} ·{" "}
                    {formatRM(kind.paidAmount)} in
                  </span>
                </span>
                <span className="tnum shrink-0 text-sm font-medium text-ink">
                  {formatRM(kind.amount)}
                </span>
                <IconChevronRight className="size-4 shrink-0 text-ink-subtle" />
              </button>
            </li>
          ))}
      </ul>
    </Card>
  );
}

/**
 * A component rather than a `formatter` prop, matching CapitalTrend. Recharts
 * types the formatter's value as possibly undefined, and the cast needed to
 * satisfy it hides real mistakes; reading the payload here does not.
 */
function PaymentTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: { name?: string; count?: number; amount?: number } }[];
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-ink">{point.name}</p>
      <p className="tnum mt-0.5 text-ink-muted">
        {formatRM(point.amount ?? 0)} · {point.count ?? 0}{" "}
        {point.count === 1 ? "charge" : "charges"}
      </p>
    </div>
  );
}
