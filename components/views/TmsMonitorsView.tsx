"use client";

import { useState } from "react";

import { KpiCard } from "@/components/dashboard/KpiCard";
import { useDrillDown } from "@/components/drilldown/DrillDownProvider";
import { RecordsCard } from "@/components/drilldown/RecordsCard";
import { TmsReadingForm } from "@/components/forms/TmsReadingForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { TmsFilterBar } from "@/components/tms/TmsFilterBar";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatNumber, formatPercent, formatRM, ratio } from "@/lib/format";
import {
  getTmsMeterSummary,
  TMS_NO_FILTER,
  type TmsFilter,
} from "@/lib/metrics";
import { tmsReadingDrill } from "@/lib/drilldowns";
import type { TmsMeterReading } from "@/lib/types";

type Editing<T> = T | null | undefined;

/**
 * Utility consumption across the portfolio.
 *
 * Readings are cumulative meter values, so what is entered is what the meter
 * says and the usage is worked out from the pair. That is the only way a
 * reading can be corrected later without the usage having to be recomputed by
 * hand — and the only way a replaced meter cannot silently bill a tenant for
 * the whole of the old one's total.
 */
export function TmsMonitorsView() {
  const { data, isTmsAgent } = useDashboard();
  const { openDrillDown } = useDrillDown();

  const [filter, setFilter] = useState<TmsFilter>(TMS_NO_FILTER);
  const [reading, setReading] = useState<Editing<TmsMeterReading>>(undefined);

  const meters = getTmsMeterSummary(data, filter);
  const biggest = meters.byUnit[0]?.amount ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Tenant Management System"
        title="Monitors"
        description="Electricity, water, gas and aircon across the units. Readings arrive by hand or from a device; what is stored is the meter value, and usage is worked out from it."
        action={
          isTmsAgent ? (
            <button
              type="button"
              onClick={() => setReading(null)}
              disabled={data.units.length === 0}
              className={cn(
                "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover",
                data.units.length === 0 && "cursor-not-allowed opacity-45",
              )}
            >
              {data.units.length === 0 ? "Add a unit first" : "Add reading"}
            </button>
          ) : null
        }
      />

      <div className="mt-4">
        <TmsFilterBar
          filter={filter}
          onChange={setFilter}
          monthLabel="Reading month"
          // The months that have READINGS. getTmsMeterSummary keys on these,
          // and the default list is the months that have charges — a different
          // set entirely on a portfolio billed and metered at different times.
          months={meters.months}
          monthHint={
            filter.month
              ? undefined
              : `Showing ${meters.monthLabel}, the latest recorded.`
          }
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Metered this month"
          value={formatRM(meters.totalAmount)}
          detail={`${meters.readingCount} ${meters.readingCount === 1 ? "reading" : "readings"} · ${meters.monthLabel}`}
          tone="idle"
          onClick={() => openDrillDown(tmsReadingDrill(data, filter, meters.month))}
        />
        {meters.byUtility
          .filter((u) => u.count > 0)
          .slice(0, 3)
          .map((utility) => (
            <KpiCard
              key={utility.key}
              label={utility.label}
              value={`${formatNumber(utility.usage)} ${utility.unit}`}
              detail={`${formatRM(utility.amount)} across ${utility.count} ${utility.count === 1 ? "meter" : "meters"}`}
              tone="idle"
              onClick={() =>
                openDrillDown(tmsReadingDrill(data, filter, meters.month))
              }
            />
          ))}
        {meters.readingCount === 0 ? (
          <Card className="px-5 py-4 sm:col-span-2 xl:col-span-3">
            <p className="max-w-prose text-sm text-ink-muted">
              No readings recorded yet. Add one by hand — device ingest for TMS
              is not built. The existing{" "}
              <code className="rounded bg-surface-3 px-1 py-0.5 text-xs">
                /api/iot/aircon
              </code>{" "}
              endpoint belongs to Micana and writes to its tables, not these.
            </p>
          </Card>
        ) : null}
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="By utility"
            hint={`Consumption recorded for ${meters.monthLabel}`}
          />
          {meters.readingCount === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-muted">
              Nothing recorded for this month.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {meters.byUtility.map((utility) => (
                <li
                  key={utility.key}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">
                      {utility.label}
                    </span>
                    <span className="block text-[0.6875rem] text-ink-subtle">
                      {utility.count === 0
                        ? "no meters read"
                        : `${utility.count} ${utility.count === 1 ? "meter" : "meters"}`}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-right">
                    <span className="block text-sm font-medium text-ink">
                      {formatNumber(utility.usage)} {utility.unit}
                    </span>
                    <span className="block text-[0.6875rem] text-ink-muted">
                      {formatRM(utility.amount)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <footer className="border-t border-line px-5 py-3 text-[0.6875rem] text-ink-subtle">
            {meters.iotCount > 0
              ? `${formatPercent(ratio(meters.iotCount, meters.readingCount), 0)} of this month's readings came from a device rather than being typed in.`
              : "Every reading this month was entered by hand."}
          </footer>
        </Card>

        <Card>
          <CardHeader
            title="By unit"
            hint="Which units are consuming the most, largest first"
          />
          {meters.byUnit.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-muted">
              Nothing recorded for this month.
            </p>
          ) : (
            <ul className="space-y-1 p-3">
              {meters.byUnit.map((unit) => (
                <li key={unit.unitId} className="px-2.5 py-2">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm text-ink">
                      {unit.label}
                    </span>
                    <span className="tnum shrink-0 text-sm font-medium text-ink">
                      {formatRM(unit.amount)}
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{
                        width: `${(unit.amount / (biggest || 1)) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="mt-1 block text-[0.6875rem] text-ink-subtle">
                    {unit.meters} {unit.meters === 1 ? "meter" : "meters"} read
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <RecordsCard
          height="h-[32rem]"
          content={{
            ...tmsReadingDrill(data, filter, null),
            title: "All Meter Readings",
            subtitle:
              "Every reading recorded, by hand or by device. Export to CSV for the billing run.",
            rowAction: isTmsAgent
              ? {
                  label: () => "Edit",
                  run: (row) => {
                    const found = data.readings.find((x) => x.id === row.id);
                    if (found) setReading(found);
                  },
                }
              : undefined,
          }}
        />
      </div>

      <TmsReadingForm
        open={reading !== undefined}
        onClose={() => setReading(undefined)}
        reading={reading}
        units={data.units}
        rooms={data.rooms}
      />
    </>
  );
}
