"use client";

import { useActionState, useState, useTransition } from "react";

import {
  generateTmsMonth,
  setChargePaid,
  type FormState,
} from "@/app/(dashboard)/actions";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TmsPaymentPanel } from "@/components/dashboard/TmsPaymentPanel";
import { TmsRoomStatusTable } from "@/components/dashboard/TmsRoomStatusTable";
import { TmsVacancyDonut } from "@/components/dashboard/TmsVacancyDonut";
import { useDrillDown } from "@/components/drilldown/DrillDownProvider";
import { RecordsCard } from "@/components/drilldown/RecordsCard";
import { TmsTenancyForm } from "@/components/forms/TmsTenancyForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { TmsFilterBar } from "@/components/tms/TmsFilterBar";
import { TmsGatewayPanel } from "@/components/tms/TmsGatewayPanel";
import { TmsVerificationQueue } from "@/components/tms/TmsVerificationQueue";
import { formatPercent, formatRM } from "@/lib/format";
import {
  getTmsCarparkVacancy,
  getTmsPaymentTracking,
  getTmsPortfolio,
  getTmsRoomVacancy,
  TMS_NO_FILTER,
  type TmsFilter,
} from "@/lib/metrics";
import {
  tmsCarparkDrill,
  tmsChargeDrill,
  tmsChargeKindDrill,
  tmsRoomDrill,
  tmsTenancyDrill,
} from "@/lib/drilldowns";
import type { TmsTenancy } from "@/lib/types";

/** `undefined` = sheet closed, `null` = adding, a record = editing. */
type Editing<T> = T | null | undefined;

/**
 * The screen an agent opens in the morning: how full the portfolio is, how
 * much of this month's rent has arrived, and which rooms need attention.
 *
 * The month filter defaults to the latest month that has charges rather than
 * to today. A dashboard that opens on an unbilled month reads as though
 * everything is unpaid, which is the one wrong impression worth engineering
 * around.
 */
export function TmsAgentView() {
  const { data, now, isTmsAgent } = useDashboard();
  const { openDrillDown } = useDrillDown();
  const [, startTransition] = useTransition();

  const latestMonth = [...new Set(data.charges.map((c) => c.periodMonth))].sort(
    (a, b) => b.localeCompare(a),
  )[0];

  const [filter, setFilter] = useState<TmsFilter>({
    ...TMS_NO_FILTER,
    month: latestMonth ?? "",
  });
  const [tenancy, setTenancy] = useState<Editing<TmsTenancy>>(undefined);

  const rooms = getTmsRoomVacancy(data, filter, now);
  const carparks = getTmsCarparkVacancy(data, filter);
  const payments = getTmsPaymentTracking(data, filter, now);
  const portfolio = getTmsPortfolio(data, filter, now);

  // setChargePaid reports failure as { error }, so an unhandled promise here
  // meant an RLS rejection or a dropped request left the row unchanged with
  // nothing said. The banner is the only feedback that the click did not take.
  const [settleError, setSettleError] = useState<string | null>(null);

  const togglePaid = !isTmsAgent
    ? undefined
    : {
        label: (row: { statusLabel: string }) =>
          row.statusLabel === "Paid" ? "Mark unpaid" : "Mark paid",
        run: (row: { id: string; statusLabel: string }) => {
          const paid = row.statusLabel !== "Paid";
          setSettleError(null);
          startTransition(async () => {
            const result = await setChargePaid(row.id, paid);
            if (result.error) setSettleError(result.error);
          });
        },
      };

  return (
    <>
      <PageHeader
        eyebrow="Tenant Management System"
        title="Agent Dashboard"
        description="Condominium units held on a master lease and let room by room. The figures here are trading income, not capital, and never count toward the RM20,000,000 target."
        action={
          isTmsAgent ? (
            // Keyed on the month so changing the filter REMOUNTS this and the
            // date input re-seeds. defaultValue is only read on mount, so
            // without the key the button kept billing whatever month was
            // current at first render — switch the filter to July, press it,
            // and August was silently raised again.
            <GenerateMonth key={filter.month} month={filter.month} />
          ) : null
        }
      />

      <div className="mt-4">
        <TmsFilterBar
          filter={filter}
          onChange={setFilter}
          monthHint="Applies to the payment figures only."
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Occupancy"
          value={formatPercent(rooms.rentedPct, 1)}
          detail={`${rooms.rentedRooms} of ${rooms.totalRooms} rooms · ${formatRM(rooms.rentRoll)}/mo`}
          tone={rooms.rentedPct >= 0.8 ? "received" : "risk"}
          onClick={() => openDrillDown(tmsRoomDrill(data, filter, now, "rented"))}
        />
        {/* An unbilled month is not a collection failure. Showing 0% in the
            risk tone for a property whose charges were never raised reads as
            "nobody has paid" when the truth is "nobody has been asked". */}
        <KpiCard
          label="Collected this month"
          value={
            payments.nothingBilled ? "—" : formatPercent(payments.collectedPct, 0)
          }
          detail={
            payments.nothingBilled
              ? "Nothing billed for this period yet"
              : `${formatRM(payments.paidAmount)} of ${formatRM(payments.billedAmount)} billed`
          }
          tone={
            payments.nothingBilled
              ? "idle"
              : payments.collectedPct >= 0.9
                ? "received"
                : "risk"
          }
          onClick={() => openDrillDown(tmsChargeDrill(data, filter, now, "paid"))}
        />
        <KpiCard
          label="Outstanding"
          value={formatRM(payments.unpaidAmount)}
          detail={
            payments.overdue.length > 0
              ? `${payments.overdue.length} ${payments.overdue.length === 1 ? "charge" : "charges"} past due`
              : `${payments.unpaidCount} ${payments.unpaidCount === 1 ? "charge" : "charges"} not yet paid`
          }
          tone={payments.overdue.length > 0 ? "stalled" : "risk"}
          onClick={() =>
            openDrillDown(
              tmsChargeDrill(
                data,
                filter,
                now,
                payments.overdue.length > 0 ? "overdue" : "unpaid",
              ),
            )
          }
        />
        <KpiCard
          label="Gross margin"
          value={formatRM(portfolio.grossMargin)}
          detail={`${formatRM(portfolio.rentRoll)} in, ${formatRM(portfolio.masterRent)} out on rent`}
          tone={portfolio.grossMargin > 0 ? "received" : "stalled"}
          onClick={() => openDrillDown(tmsTenancyDrill(data, filter, now, "live"))}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <TmsVacancyDonut
          title="Room Vacancy"
          hint="Rooms with someone in residence today"
          total={rooms.totalRooms}
          totalLabel={rooms.totalRooms === 1 ? "room" : "rooms"}
          empty="No lettable rooms yet. Add a unit and its rooms under Tenant Management."
          slices={[
            {
              key: "rented",
              label: "Rented",
              count: rooms.rentedRooms,
              tone: "received",
              onClick: () =>
                openDrillDown(tmsRoomDrill(data, filter, now, "rented")),
            },
            {
              key: "vacant",
              label: "Vacant",
              count: rooms.vacantRooms,
              tone: "idle",
              onClick: () =>
                openDrillDown(tmsRoomDrill(data, filter, now, "vacant")),
            },
          ]}
        />

        <TmsVacancyDonut
          title="Carpark Vacancy"
          hint="Bays held by a tenant, against bays going spare"
          total={carparks.totalBays}
          totalLabel={carparks.totalBays === 1 ? "bay" : "bays"}
          empty="No carparks recorded yet."
          slices={[
            {
              key: "assigned",
              label: "Assigned",
              count: carparks.assignedBays,
              tone: "received",
              onClick: () =>
                openDrillDown(tmsCarparkDrill(data, filter, "assigned")),
            },
            {
              key: "unassigned",
              label: "Not Assigned",
              count: carparks.unassignedBays,
              tone: "idle",
              onClick: () =>
                openDrillDown(tmsCarparkDrill(data, filter, "unassigned")),
            },
          ]}
        />

        <TmsPaymentPanel
          tracking={payments}
          onOpen={(which) =>
            openDrillDown(tmsChargeDrill(data, filter, now, which))
          }
          onOpenKind={(kind) =>
            openDrillDown(tmsChargeKindDrill(data, filter, now, kind))
          }
        />
      </div>

      {/* Above the room table: an unchecked payment is time-sensitive in a way
          a vacancy is not — the tenant is waiting to be told they are settled. */}
      <div className="mt-4">
        <TmsVerificationQueue />
      </div>

      <div className="mt-4">
        <TmsGatewayPanel />
      </div>

      <div className="mt-4">
        <TmsRoomStatusTable
          rows={rooms.rows}
          onOpenAll={() => openDrillDown(tmsRoomDrill(data, filter, now, "all"))}
          onOpenRoom={
            isTmsAgent
              ? (row) => {
                  // Editing from here edits the tenancy, not the room: the
                  // status the agent clicked on is a fact about the tenancy.
                  if (row.tenancy) setTenancy(row.tenancy);
                }
              : undefined
          }
        />
      </div>

      {settleError ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-stalled-line bg-stalled-soft px-4 py-3 text-sm text-stalled"
        >
          {settleError}
        </p>
      ) : null}

      <div className="mt-4">
        <RecordsCard
          height="h-[32rem]"
          content={{
            ...tmsChargeDrill(data, filter, now, "all"),
            title: "Payment Ledger",
            subtitle:
              "Every charge in the period. Search by tenant or room, and settle a line without leaving the page.",
            rowAction: togglePaid,
          }}
        />
      </div>

      <TmsTenancyForm
        open={tenancy !== undefined}
        onClose={() => setTenancy(undefined)}
        tenancy={tenancy}
        rooms={data.rooms}
      />
    </>
  );
}

/**
 * Raising a month is a form rather than a button so the month travels with the
 * submission, and so pressing it twice is visibly the same action rather than
 * looking like it might bill everyone twice. It cannot: the database inserts
 * only what is missing.
 */
function GenerateMonth({ month }: { month: string }) {
  const [state, action] = useActionState<FormState, FormData>(
    generateTmsMonth,
    {},
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="mb-1 block text-[0.6875rem] font-medium text-ink-muted">
          Raise charges for
        </span>
        <input
          type="date"
          name="period_month"
          defaultValue={month || undefined}
          className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        />
      </label>
      <button
        type="submit"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
      >
        Raise month
      </button>
      {state.error ? (
        <p role="status" className="w-full text-xs text-ink-muted">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
