"use client";

import { useState } from "react";

import { useDrillDown } from "@/components/drilldown/DrillDownProvider";
import { RecordsCard } from "@/components/drilldown/RecordsCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TmsChargeForm } from "@/components/forms/TmsChargeForm";
import { TmsExpenseForm } from "@/components/forms/TmsExpenseForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { TmsFilterBar } from "@/components/tms/TmsFilterBar";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconChevronRight, IconWarning } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatPercent, formatRM, ratio } from "@/lib/format";
import {
  getTmsExpenseMonths,
  getTmsExpenseSummary,
  getTmsPortfolio,
  getTmsTenantExpenses,
  TMS_NO_FILTER,
  type TmsFilter,
} from "@/lib/metrics";
import {
  tmsExpenseCategoryDrill,
  tmsExpenseDrill,
} from "@/lib/drilldowns";
import type { TmsExpense, TmsRentCharge } from "@/lib/types";

type Editing<T> = T | null | undefined;

/**
 * Two questions on one page, because they are asked together: what does the
 * portfolio cost to run, and which tenants account for it.
 *
 * The split is `tenancyId`. A cost pinned to a tenancy is that tenant's;
 * everything else is the cost of holding the unit. Tenant costs are counted
 * whether or not they were recoverable — a room that needs RM800 of repairs a
 * year is worth knowing about even when the tenant was never billed.
 */
export function TmsExpensesView() {
  const { data, now, isTmsAgent } = useDashboard();
  const { openDrillDown } = useDrillDown();

  const [filter, setFilter] = useState<TmsFilter>(TMS_NO_FILTER);
  const [expense, setExpense] = useState<Editing<TmsExpense>>(undefined);
  const [charge, setCharge] = useState<Editing<TmsRentCharge>>(undefined);

  const summary = getTmsExpenseSummary(data, filter);
  const tenant = getTmsTenantExpenses(data, filter);
  const portfolio = getTmsPortfolio(data, filter, now);

  const worstCategory = summary.byCategory.find((c) => c.amount > 0);
  const biggest = summary.byCategory[0]?.amount ?? 0;

  // Spend per month, so it can be set beside a monthly rent roll. Null when
  // nothing has been recorded, which renders as an em dash rather than a zero
  // that looks like a measured result.
  const monthlySpend =
    summary.monthsCovered > 0 ? summary.total / summary.monthsCovered : null;

  return (
    <>
      <PageHeader
        eyebrow="Tenant Management System"
        title="Expenses"
        description="What the portfolio costs to run, and what the tenants in it account for. Master rent is an expense here and never nets off against the rent roll elsewhere."
        action={
          isTmsAgent ? (
            <div className="flex flex-wrap gap-2">
              {/* Both forms need a parent that may not exist yet; an empty
                  dropdown and an unactionable error is worse than a button
                  that says what is missing. */}
              <button
                type="button"
                onClick={() => setExpense(null)}
                disabled={data.properties.length === 0}
                className={cn(
                  "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover",
                  data.properties.length === 0 && "cursor-not-allowed opacity-45",
                )}
              >
                {data.properties.length === 0
                  ? "Add a property first"
                  : "Add expense"}
              </button>
              <button
                type="button"
                onClick={() => setCharge(null)}
                disabled={data.tenancies.length === 0}
                className={cn(
                  "rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-muted transition hover:border-accent-line hover:text-accent",
                  data.tenancies.length === 0 && "cursor-not-allowed opacity-45",
                )}
              >
                {data.tenancies.length === 0
                  ? "Add a tenancy first"
                  : "Recharge a tenant"}
              </button>
            </div>
          ) : null
        }
      />

      <div className="mt-4">
        <TmsFilterBar
          filter={filter}
          onChange={setFilter}
          monthLabel="Month incurred"
          // Expense months, not charge months: the default list comes from the
          // rent ledger, and a portfolio is billed and spent in different
          // months, so it offered periods with no expenses and hid ones with.
          months={getTmsExpenseMonths(data)}
          monthHint="An expense belongs to the month it was spent, not the month it is rent for."
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total spend"
          value={formatRM(summary.total)}
          detail={
            worstCategory
              ? `${worstCategory.label} is the largest at ${formatRM(worstCategory.amount)}` +
                (summary.monthsCovered > 1
                  ? ` · across ${summary.monthsCovered} months`
                  : "")
              : "Nothing recorded in this period"
          }
          tone="idle"
          onClick={() => openDrillDown(tmsExpenseDrill(data, filter, "all"))}
        />
        <KpiCard
          label="Still to pay"
          value={formatRM(summary.unpaid)}
          detail={`${formatRM(summary.paid)} already settled`}
          tone={summary.unpaid > 0 ? "risk" : "received"}
          onClick={() =>
            openDrillDown(tmsExpenseDrill(data, filter, "operating"))
          }
        />
        <KpiCard
          label="Tenant costs"
          value={formatRM(tenant.total)}
          detail={`${tenant.byTenant.length} ${tenant.byTenant.length === 1 ? "tenancy" : "tenancies"} carrying costs`}
          tone="idle"
          onClick={() => openDrillDown(tmsExpenseDrill(data, filter, "tenant"))}
        />
        <KpiCard
          label="Awaiting recharge"
          value={formatRM(summary.awaitingRecharge)}
          detail={
            summary.awaitingRecharge > 0
              ? "Recoverable, but no charge raised yet"
              : "Every recoverable cost has been billed on"
          }
          tone={summary.awaitingRecharge > 0 ? "stalled" : "received"}
          onClick={() =>
            openDrillDown(tmsExpenseDrill(data, filter, "awaiting_recharge"))
          }
        />
      </div>

      {/* Spend against the rent that has to cover it. */}
      <Card className="mt-4">
        <CardHeader
          title="What the period cost"
          hint="Spend set beside the rent roll it comes out of"
        />
        <div className="grid gap-px bg-line sm:grid-cols-4">
          <Figure label="Rent roll" value={formatRM(portfolio.rentRoll)} />
          <Figure
            label="Master rent"
            value={formatRM(portfolio.masterRent)}
            note="the largest fixed cost"
          />
          <Figure
            label="Other spend"
            value={formatRM(
              Math.max(
                0,
                summary.total -
                  (summary.byCategory.find((c) => c.key === "master_rent")
                    ?.amount ?? 0),
              ),
            )}
            note={
              summary.monthsCovered > 1
                ? `everything but master rent, over ${summary.monthsCovered} months`
                : "everything but the master rent"
            }
          />
          {/* A month of spend against a month of rent.
              The rent roll is always ONE month, so the spend has to be divided
              by the months it actually spans — with no month filter set this
              card was putting a year of expenses over a single month's rent
              and reporting a healthy portfolio at 400%.
              Deliberately NOT clamped to 100%: spend genuinely running past the
              rent is the most important thing this card can say, and a clamp
              would round it away to a comfortable-looking 100%. */}
          <Figure
            label="Spend vs rent roll"
            value={
              monthlySpend === null
                ? "—"
                : portfolio.rentRoll === 0
                  ? "no rent yet"
                  : formatPercent(ratio(monthlySpend, portfolio.rentRoll), 0)
            }
            note={
              monthlySpend === null
                ? "nothing recorded"
                : // ratio() returns 0 on a zero denominator, so without this the
                  // tile read "0%" directly above "spending more than the rent
                  // covers" — the two flatly contradicting each other on a
                  // portfolio that is leased but not yet let.
                  portfolio.rentRoll === 0
                  ? `${formatRM(monthlySpend)}/month going out, nothing coming in`
                  : monthlySpend > portfolio.rentRoll
                    ? "spending more than the rent covers"
                    : summary.monthsCovered > 1
                      ? `averaged over ${summary.monthsCovered} months`
                      : "a month's spend against a month's rent"
            }
          />
        </div>
      </Card>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Where it goes"
            hint="Spend by category, largest first"
          />
          {summary.total === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-muted">
              Nothing recorded for this period.
            </p>
          ) : (
            <ul className="space-y-1 p-3">
              {summary.byCategory
                .filter((c) => c.amount > 0)
                .map((category) => (
                  <li key={category.key}>
                    <button
                      type="button"
                      onClick={() =>
                        openDrillDown(
                          tmsExpenseCategoryDrill(data, filter, category.key),
                        )
                      }
                      className="w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-surface-2"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm text-ink">
                          {category.label}
                        </span>
                        <span className="tnum shrink-0 text-sm font-medium text-ink">
                          {formatRM(category.amount)}
                        </span>
                      </span>
                      <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{
                            width: `${(category.amount / (biggest || 1)) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="mt-1 block text-[0.6875rem] text-ink-subtle">
                        {category.count}{" "}
                        {category.count === 1 ? "entry" : "entries"} ·{" "}
                        {category.hint}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            title="Tenant Expense Dashboard"
            hint="What each tenancy has cost, recoverable or not"
          />

          {tenant.awaitingRecharge > 0 ? (
            <button
              type="button"
              onClick={() =>
                openDrillDown(
                  tmsExpenseDrill(data, filter, "awaiting_recharge"),
                )
              }
              className="flex w-full items-center gap-2.5 border-b border-stalled-line bg-stalled-soft px-5 py-2.5 text-left transition hover:brightness-[0.98]"
            >
              <IconWarning className="size-4 shrink-0 text-stalled" />
              <span className="flex-1 text-xs text-stalled">
                <strong className="font-semibold">
                  {formatRM(tenant.awaitingRecharge)}
                </strong>{" "}
                is recoverable but has not been charged on
              </span>
              <IconChevronRight className="size-4 shrink-0 text-stalled" />
            </button>
          ) : null}

          <div className="grid gap-px border-b border-line bg-line sm:grid-cols-3">
            <Figure label="Recharged" value={formatRM(tenant.recharged)} />
            <Figure
              label="To recharge"
              value={formatRM(tenant.awaitingRecharge)}
            />
            <Figure
              label="Absorbed"
              value={formatRM(tenant.absorbed)}
              note="never marked recoverable"
            />
          </div>

          {tenant.byTenant.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-muted">
              No costs pinned to a tenancy in this period. Pin one by choosing a
              tenancy on the expense.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {tenant.byTenant.map((row) => (
                <li
                  key={row.tenancyId}
                  className="flex flex-wrap items-center gap-3 px-5 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">
                      {row.tenantName}
                    </span>
                    <span className="block truncate text-[0.6875rem] text-ink-subtle">
                      {row.roomCode || row.propertyName} · {row.count}{" "}
                      {row.count === 1 ? "entry" : "entries"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tnum block text-sm font-medium text-ink">
                      {formatRM(row.amount)}
                    </span>
                    <span
                      className={cn(
                        "tnum block text-[0.6875rem]",
                        row.billable > row.recharged
                          ? "text-stalled"
                          : "text-ink-subtle",
                      )}
                    >
                      {formatRM(row.recharged)} recharged
                    </span>
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
            ...tmsExpenseDrill(data, filter, "all"),
            title: "All Expenses",
            subtitle:
              "Every cost recorded in the period. Export to CSV for the books.",
            rowAction: isTmsAgent
              ? {
                  label: () => "Edit",
                  run: (row) => {
                    const found = data.expenses.find((x) => x.id === row.id);
                    if (found) setExpense(found);
                  },
                }
              : undefined,
          }}
        />
      </div>

      <TmsExpenseForm
        open={expense !== undefined}
        onClose={() => setExpense(undefined)}
        expense={expense}
        properties={data.properties}
        units={data.units}
        tenancies={data.tenancies}
      />
      <TmsChargeForm
        open={charge !== undefined}
        onClose={() => setCharge(undefined)}
        charge={charge}
        tenancies={data.tenancies}
      />
    </>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="tnum mt-1 font-display text-lg font-semibold text-ink">
        {value}
      </p>
      {note ? (
        <p className="mt-0.5 text-[0.6875rem] text-ink-subtle">{note}</p>
      ) : null}
    </div>
  );
}
