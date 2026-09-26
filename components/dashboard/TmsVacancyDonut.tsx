"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";
import type { Tone } from "@/lib/types";

const FILL: Record<Tone, string> = {
  received: "var(--received)",
  committed: "var(--committed)",
  risk: "var(--risk)",
  stalled: "var(--stalled)",
  idle: "var(--idle)",
  accent: "var(--accent)",
};

const DOT: Record<Tone, string> = {
  received: "bg-received",
  committed: "bg-committed",
  risk: "bg-risk",
  stalled: "bg-stalled",
  idle: "bg-idle",
  accent: "bg-accent",
};

export interface VacancySlice {
  key: string;
  label: string;
  count: number;
  tone: Tone;
  onClick: () => void;
}

/**
 * Rooms rented against rooms empty, and the same shape again for carparks.
 *
 * A donut rather than a pie: the hole carries the count, which is the figure
 * anyone actually reads off this card. Every slice and every legend row opens
 * the records behind it, like the rest of the dashboard.
 *
 * Colours are CSS variables, so both charts follow the theme with no
 * JavaScript involved.
 */
export function TmsVacancyDonut({
  title,
  hint,
  slices,
  total,
  totalLabel,
  empty,
}: {
  title: string;
  hint: string;
  slices: VacancySlice[];
  total: number;
  totalLabel: string;
  empty: string;
}) {
  const drawable = slices.filter((s) => s.count > 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title={title} hint={hint} />

      {total === 0 ? (
        <div className="flex flex-1 items-center px-5 py-10 text-sm text-ink-muted">
          {empty}
        </div>
      ) : (
        <>
          <div className="relative px-2 pt-4">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={drawable}
                    dataKey="count"
                    nameKey="label"
                    innerRadius="58%"
                    outerRadius="88%"
                    paddingAngle={drawable.length > 1 ? 2 : 0}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {drawable.map((slice) => (
                      <Cell
                        key={slice.key}
                        fill={FILL[slice.tone]}
                        className="cursor-pointer outline-none transition hover:brightness-110"
                        onClick={slice.onClick}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Absolutely positioned so it sits in the hole. aria-hidden
                because the legend below already reads the same figures out. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-4"
            >
              <span className="tnum font-display text-3xl font-bold tracking-tight text-ink">
                {total}
              </span>
              <span className="text-[0.6875rem] text-ink-subtle">
                {totalLabel}
              </span>
            </div>
          </div>

          <ul className="mt-2 flex-1 space-y-1 p-3">
            {slices.map((slice) => (
              <li key={slice.key}>
                <button
                  type="button"
                  onClick={slice.onClick}
                  disabled={slice.count === 0}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition",
                    slice.count > 0
                      ? "hover:bg-surface-2"
                      : "cursor-default opacity-55",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2.5 shrink-0 rounded-sm",
                      DOT[slice.tone],
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {slice.label}
                  </span>
                  <span className="tnum shrink-0 text-sm font-semibold text-ink">
                    {slice.count}
                  </span>
                  <span className="tnum w-14 shrink-0 text-right text-xs text-ink-muted">
                    {formatPercent(slice.count / total, 1)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
