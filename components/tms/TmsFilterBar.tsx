"use client";

import { useDrillDown } from "@/components/drilldown/DrillDownProvider";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { getTmsMonths, type TmsFilter } from "@/lib/metrics";
import { tmsLandlordDrill } from "@/lib/drilldowns";

/**
 * Property and month, the two filters everything on these pages reads.
 *
 * Properties are toggles rather than a dropdown: comparing two of a dozen
 * addresses is the common case, and a multi-select dropdown hides which ones
 * are on. Nothing selected means everything, so the page opens full rather
 * than empty.
 */
export function TmsFilterBar({
  filter,
  onChange,
  showMonth = true,
  monthLabel = "Payment month",
  monthHint,
  months: monthsProp,
}: {
  filter: TmsFilter;
  onChange: (next: TmsFilter) => void;
  showMonth?: boolean;
  monthLabel?: string;
  monthHint?: string;
  /**
   * The months this page's figures are actually keyed on. Defaults to the
   * months that have charges, which is right for the payment dashboards and
   * wrong for Monitors — meter readings have months of their own, and offering
   * a charge month there let the agent pick a period with no readings in it and
   * be told there were none at all.
   */
  months?: { month: string; label: string }[];
}) {
  const { data } = useDashboard();
  const { openDrillDown } = useDrillDown();
  const months = monthsProp ?? getTmsMonths(data);

  const toggle = (id: string) => {
    const on = filter.propertyIds.includes(id);
    onChange({
      ...filter,
      propertyIds: on
        ? filter.propertyIds.filter((x) => x !== id)
        : [...filter.propertyIds, id],
    });
  };

  return (
    <Card className="px-5 py-4">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-ink-subtle">
            Property
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange({ ...filter, propertyIds: [] })}
              aria-pressed={filter.propertyIds.length === 0}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                filter.propertyIds.length === 0
                  ? "border-accent-line bg-accent-soft text-accent"
                  : "border-line text-ink-muted hover:border-accent-line hover:text-accent",
              )}
            >
              All properties
            </button>
            {data.properties.map((property) => {
              const on = filter.propertyIds.includes(property.id);
              return (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => toggle(property.id)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    on
                      ? "border-accent-line bg-accent-soft text-accent"
                      : "border-line text-ink-muted hover:border-accent-line hover:text-accent",
                  )}
                >
                  {property.propertyName}
                </button>
              );
            })}
            {data.properties.length === 0 ? (
              <span className="text-xs text-ink-subtle">
                No properties yet.
              </span>
            ) : null}
          </div>
        </div>

        {showMonth ? (
          <div className="min-w-[12rem]">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-ink-subtle">
              {monthLabel}
            </p>
            <select
              value={filter.month}
              onChange={(e) => onChange({ ...filter, month: e.target.value })}
              className="mt-2 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Every month</option>
              {months.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.label}
                </option>
              ))}
            </select>
            {monthHint ? (
              <p className="mt-1 text-[0.6875rem] text-ink-subtle">
                {monthHint}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="self-end">
          <button
            type="button"
            onClick={() => openDrillDown(tmsLandlordDrill(data))}
            className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink-muted transition hover:border-accent-line hover:text-accent"
          >
            {data.landlords.length} landlord
            {data.landlords.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </Card>
  );
}
