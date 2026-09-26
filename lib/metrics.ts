import {
  TMS_CHARGE_KINDS,
  TMS_CHARGE_STATUSES,
  TMS_EXPENSE_CATEGORIES,
  TMS_OCCUPYING_STATUSES,
  TMS_TENANCY_STATUSES,
  TMS_UNIT_STATUSES,
  TMS_UTILITIES,
} from "./constants";
import {
  clamp01,
  daysBetween,
  ratio,
} from "./format";
import type { DashboardData } from "./data";
import type {
  DrillRow,
  TmsCarpark,
  TmsExpense,
  TmsExpenseCategory,
  TmsLandlord,
  TmsMeterReading,
  TmsRentCharge,
  TmsRoom,
  TmsTenancy,
  TmsTenancyStatus,
  TmsUnit,
  TmsUtility,
  Tone,
  TmsChargeStatus,
} from "./types";


/** "Jun 2026" — same en-MY convention as the capital trend chart. */
function monthLabel(month: string): string {
  const d = new Date(`${month.slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleString("en-MY", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/* -------------------------------------------------------------------------- */

/** Adds one field across a list. Used throughout the figures below. */
function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

/* ==========================================================================
   TENANT MANAGEMENT SYSTEM
   --------------------------------------------------------------------------
   TMS contributes nothing to the RM20,000,000 raise. It is a managed-rental
   operation measured on rent collected, rooms filled and cost of running the
   units — none of which is capital, so none of it appears in
   getCapitalSummary.

   Two derived facts carry the whole dashboard, and neither is stored:

     A room is RENTED when a tenancy on it is active or under notice AND the
     term covers today. Anything else is VACANT. That is what lets the room
     status table show a vacant room that already carries a future move-in
     date — the booking exists, the tenancy has not started.

     A bay is ASSIGNED when it points at a tenancy. Ending a tenancy releases
     it in the database, so an assigned bay always has someone in it.

   Deriving both from the tenancy ledger is the only way they can never
   disagree with it.
   ========================================================================== */

/**
 * What the two dashboard filters narrow to.
 *
 * An empty `propertyIds` means every property — the same "equals to any" with
 * nothing chosen. `month` is a YYYY-MM-01 string, or "" for every month.
 */
export interface TmsFilter {
  propertyIds: string[];
  month: string;
}

export const TMS_NO_FILTER: TmsFilter = { propertyIds: [], month: "" };

function inProperties(filter: TmsFilter, propertyId: string): boolean {
  return filter.propertyIds.length === 0
    ? true
    : filter.propertyIds.includes(propertyId);
}

/* -------------------------------------------------------------------------- */
/* Predicates                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Holds the room against anyone else moving in. Mirrors the partial unique
 * index tms_tenancies_one_live_per_room, which is the real guard — this copy
 * only decides what the interface shows.
 */
export function isTenancyHolding(tenancy: TmsTenancy): boolean {
  return (
    tenancy.status === "reserved" ||
    tenancy.status === "active" ||
    tenancy.status === "notice"
  );
}

/**
 * Occupying the room *today*: the status says someone is in residence and the
 * term covers this date.
 *
 * The date test is what separates this from `isTenancyHolding`. A tenancy that
 * starts next month holds its room but does not fill it, and counting it as
 * filled would report a room as earning rent a month before it does.
 */
export function isTenancyOccupying(tenancy: TmsTenancy, now: string): boolean {
  if (!TMS_OCCUPYING_STATUSES.includes(tenancy.status)) return false;
  // A move-in date is REQUIRED, not optional.
  //
  // An earlier version treated a missing date as "occupying anyway, the status
  // says so". That put the room in the rent roll while tms_generate_month —
  // which requires `moved_in_at is not null` — raised no charge for it, so the
  // dashboard showed rent being earned that was never once invoiced, and
  // collection still read 100% because the missing charge was not in the
  // denominator either. Matching the generator is what keeps the two honest.
  if (!tenancy.movedInAt) return false;
  if (tenancy.movedInAt > now) return false;
  if (tenancy.movedOutAt && tenancy.movedOutAt < now) return false;
  return true;
}

/**
 * Deliberately 'unpaid' only. A charge past its due date that the tenant has
 * already submitted against is waiting on the office, not on the tenant, and
 * chasing them for it would be wrong.
 */
export function isChargeOverdue(charge: TmsRentCharge, now: string): boolean {
  return charge.status === "unpaid" && charge.dueAt < now;
}

/* -------------------------------------------------------------------------- */
/* Room vacancy                                                                */
/* -------------------------------------------------------------------------- */

export interface TmsRoomStatusRow {
  roomId: string;
  roomCode: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  roomLabel: string;
  /** False when the room is withdrawn from letting. */
  active: boolean;
  rented: boolean;
  /** The tenancy that decides the status, or the latest one if none is live. */
  tenancy: TmsTenancy | null;
  tenantName: string;
  phone: string;
  monthlyRent: number;
  movedInAt: string | null;
  movedOutAt: string | null;
}

export interface TmsRoomVacancy {
  rows: TmsRoomStatusRow[];
  totalRooms: number;
  rentedRooms: number;
  vacantRooms: number;
  rentedPct: number;
  vacantPct: number;
  /** Rent actually being earned by the filled rooms. */
  rentRoll: number;
  /** What every lettable room would earn at its own asking rent. */
  rentRollAtFull: number;
}

/**
 * The room inventory with its status resolved, which is both the vacancy pie
 * and the Tenant And Room Status table.
 *
 * Inactive rooms are excluded entirely rather than counted as vacant: a room
 * withdrawn from letting is not a letting opportunity going begging, and
 * leaving it in would drag the percentage down for as long as it is out.
 */
export function getTmsRoomVacancy(
  data: DashboardData,
  filter: TmsFilter,
  now: string,
): TmsRoomVacancy {
  const rooms = data.rooms.filter(
    (r) => r.active && inProperties(filter, r.propertyId),
  );
  const rows = buildRoomStatusRows(data, rooms, now);

  const rentedRooms = rows.filter((r) => r.rented).length;
  const totalRooms = rows.length;

  return {
    rows,
    totalRooms,
    rentedRooms,
    vacantRooms: totalRooms - rentedRooms,
    rentedPct: clamp01(ratio(rentedRooms, totalRooms)),
    vacantPct: clamp01(ratio(totalRooms - rentedRooms, totalRooms)),
    rentRoll: sum(
      rows.filter((r) => r.rented),
      (r) => r.monthlyRent,
    ),
    rentRollAtFull: sum(rooms, (r) => r.marketRent),
  };
}

/**
 * Every room on record, lettable or not, with its status resolved.
 *
 * Vacancy deliberately excludes withdrawn rooms; the management page must not,
 * or a room taken out of service disappears from the only list that can edit
 * it and there is no way to put it back.
 */
export function getTmsRoomInventory(
  data: DashboardData,
  filter: TmsFilter,
  now: string,
): TmsRoomStatusRow[] {
  return buildRoomStatusRows(
    data,
    data.rooms.filter((r) => inProperties(filter, r.propertyId)),
    now,
  );
}

function buildRoomStatusRows(
  data: DashboardData,
  rooms: TmsRoom[],
  now: string,
): TmsRoomStatusRow[] {
  return rooms.map((room) => {
    const onRoom = data.tenancies.filter((t) => t.roomId === room.id);
    const live = onRoom.find((t) => isTenancyOccupying(t, now)) ?? null;

    // No live tenancy: show the most recent one anyway, so the table can carry
    // a future booking or the last tenant's move-out date beside a vacant room
    // instead of an empty line that says nothing.
    const latest =
      live ??
      [...onRoom].sort((a, b) =>
        (b.movedInAt ?? b.movedOutAt ?? "").localeCompare(
          a.movedInAt ?? a.movedOutAt ?? "",
        ),
      )[0] ??
      null;

    return {
      roomId: room.id,
      roomCode: room.roomCode || room.roomLabel,
      propertyId: room.propertyId,
      propertyName: room.propertyName,
      unitNumber: room.unitNumber,
      roomLabel: room.roomLabel,
      active: room.active,
      rented: live !== null,
      tenancy: latest,
      tenantName: latest?.tenantName ?? "",
      phone: latest?.phone ?? "",
      monthlyRent: live?.monthlyRent ?? room.marketRent,
      movedInAt: latest?.movedInAt ?? null,
      movedOutAt: latest?.movedOutAt ?? null,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Carpark vacancy                                                             */
/* -------------------------------------------------------------------------- */

export interface TmsCarparkVacancy {
  bays: TmsCarpark[];
  totalBays: number;
  assignedBays: number;
  unassignedBays: number;
  assignedPct: number;
  /** Monthly fees the assigned bays carry. Bundled bays add nothing. */
  feeIncome: number;
}

export function getTmsCarparkVacancy(
  data: DashboardData,
  filter: TmsFilter,
): TmsCarparkVacancy {
  const bays = data.carparks.filter(
    (c) => c.active && inProperties(filter, c.propertyId),
  );
  const assigned = bays.filter((c) => c.tenancyId !== null);

  return {
    bays,
    totalBays: bays.length,
    assignedBays: assigned.length,
    unassignedBays: bays.length - assigned.length,
    assignedPct: clamp01(ratio(assigned.length, bays.length)),
    feeIncome: sum(assigned, (c) => c.monthlyFee),
  };
}

/* -------------------------------------------------------------------------- */
/* Monthly payment tracking                                                    */
/* -------------------------------------------------------------------------- */

export interface TmsPaymentBucket {
  key: TmsChargeStatus;
  label: string;
  short: string;
  tone: Tone;
  count: number;
  amount: number;
  charges: TmsRentCharge[];
}

export interface TmsPaymentTracking {
  /** Claimed by a tenant, not yet checked. Counted as outstanding, not paid. */
  submittedCount: number;
  submittedAmount: number;
  /** The month being counted, or "" when the filter spans all of them. */
  month: string;
  monthLabel: string;
  /**
   * True when nothing was billed at all. Distinct from "billed and unpaid":
   * a 0% collection rate on an empty month is not a collection failure, and
   * the dashboard must not colour it as one.
   */
  nothingBilled: boolean;
  buckets: TmsPaymentBucket[];
  paidCount: number;
  unpaidCount: number;
  paidAmount: number;
  unpaidAmount: number;
  billedAmount: number;
  /** Of what was billed, the share settled. Money, not row count. */
  collectedPct: number;
  overdue: TmsRentCharge[];
  overdueAmount: number;
  byKind: {
    key: TmsRentCharge["kind"];
    label: string;
    hint: string;
    count: number;
    amount: number;
    paidAmount: number;
  }[];
}

/**
 * Paid against not-paid for one month.
 *
 * The row count runs ahead of the room count on purpose: rent, carpark and a
 * utility recharge are three separate things a tenant owes, so a portfolio of
 * 69 rooms routinely bills closer to a hundred lines.
 *
 * `collectedPct` is money over money, not rows over rows. Nineteen settled
 * RM50 carpark fees against one outstanding RM900 rent is not 95% collected.
 */
export function getTmsPaymentTracking(
  data: DashboardData,
  filter: TmsFilter,
  now: string,
): TmsPaymentTracking {
  const scoped = data.charges.filter(
    (c) =>
      inProperties(filter, c.propertyId) &&
      (filter.month === "" || c.periodMonth === filter.month),
  );

  const buckets: TmsPaymentBucket[] = TMS_CHARGE_STATUSES.map((status) => {
    const charges = scoped.filter((c) => c.status === status.key);
    return {
      key: status.key,
      label: status.label,
      short: status.short,
      tone: status.tone,
      count: charges.length,
      amount: sum(charges, (c) => c.amount),
      charges,
    };
  });

  const paid = buckets.find((b) => b.key === "paid")!;
  const unpaid = buckets.find((b) => b.key === "unpaid")!;
  const submitted = buckets.find((b) => b.key === "submitted")!;

  // A submitted charge is billed and still outstanding. Leaving it out of both
  // would have meant the agent's Outstanding figure fell the moment a tenant
  // CLAIMED to have paid — before anyone opened the slip — and the month's
  // billed total would quietly shrink by the same amount. Money is not
  // collected until it has been checked.
  const billedAmount = paid.amount + unpaid.amount + submitted.amount;
  const outstandingAmount = unpaid.amount + submitted.amount;
  const outstandingCount = unpaid.count + submitted.count;
  const overdue = scoped.filter((c) => isChargeOverdue(c, now));

  return {
    month: filter.month,
    monthLabel: filter.month ? monthLabel(filter.month) : "Every month",
    buckets,
    paidCount: paid.count,
    unpaidCount: outstandingCount,
    submittedCount: submitted.count,
    submittedAmount: submitted.amount,
    paidAmount: paid.amount,
    unpaidAmount: outstandingAmount,
    billedAmount,
    nothingBilled: billedAmount === 0 && outstandingCount === 0,
    collectedPct: clamp01(ratio(paid.amount, billedAmount)),
    overdue,
    overdueAmount: sum(overdue, (c) => c.amount),
    byKind: TMS_CHARGE_KINDS.map((kind) => {
      const rows = scoped.filter((c) => c.kind === kind.key);
      return {
        key: kind.key,
        label: kind.label,
        hint: kind.hint,
        count: rows.length,
        amount: sum(rows, (c) => c.amount),
        paidAmount: sum(
          rows.filter((c) => c.status === "paid"),
          (c) => c.amount,
        ),
      };
    }),
  };
}

/**
 * Every month that has charges, newest first — the month picker's options.
 *
 * Drawn from the data rather than generated from a range so the picker can
 * never offer a month that was never billed.
 */
export function getTmsMonths(data: DashboardData): {
  month: string;
  label: string;
}[] {
  const months = [...new Set(data.charges.map((c) => c.periodMonth))];
  return months
    .sort((a, b) => b.localeCompare(a))
    .map((month) => ({ month, label: monthLabel(month) }));
}

/**
 * Every month that has an expense, newest first — the Expenses month picker.
 *
 * Drawn from incurredOn rather than from the charge months, because an expense
 * belongs to the month it was spent and a portfolio is routinely billed and
 * spent in different months.
 */
export function getTmsExpenseMonths(data: DashboardData): {
  month: string;
  label: string;
}[] {
  const months = [
    ...new Set(data.expenses.map((e) => `${e.incurredOn.slice(0, 7)}-01`)),
  ];
  return months
    .sort((a, b) => b.localeCompare(a))
    .map((month) => ({ month, label: monthLabel(month) }));
}

/** Collection month by month, for the trend bars. Oldest first, as read. */
export function getTmsCollectionTrend(
  data: DashboardData,
  filter: TmsFilter,
): {
  month: string;
  label: string;
  paidAmount: number;
  unpaidAmount: number;
  paidCount: number;
  unpaidCount: number;
}[] {
  const scoped = data.charges.filter((c) =>
    inProperties(filter, c.propertyId),
  );
  const months = [...new Set(scoped.map((c) => c.periodMonth))].sort();

  return months.map((month) => {
    const rows = scoped.filter((c) => c.periodMonth === month);
    const paid = rows.filter((c) => c.status === "paid");
    const unpaid = rows.filter((c) => c.status === "unpaid");
    return {
      month,
      label: monthLabel(month),
      paidAmount: sum(paid, (c) => c.amount),
      unpaidAmount: sum(unpaid, (c) => c.amount),
      paidCount: paid.length,
      unpaidCount: unpaid.length,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* The portfolio at a glance                                                   */
/* -------------------------------------------------------------------------- */

export interface TmsPortfolio {
  landlords: number;
  properties: number;
  units: number;
  unitsActive: number;
  rooms: number;
  roomsActive: number;
  tenanciesLive: number;
  tenanciesUnderNotice: number;
  /** Rent leaving the business each month under the master leases. */
  masterRent: number;
  rentRoll: number;
  /** Rent roll less master rent. Not profit — the expenses are separate. */
  grossMargin: number;
}

export function getTmsPortfolio(
  data: DashboardData,
  filter: TmsFilter,
  now: string,
): TmsPortfolio {
  const units = data.units.filter((u) => inProperties(filter, u.propertyId));
  const rooms = data.rooms.filter((r) => inProperties(filter, r.propertyId));
  const tenancies = data.tenancies.filter((t) =>
    inProperties(filter, t.propertyId),
  );

  // Restricted to lettable rooms so this agrees with getTmsRoomVacancy, which
  // drops inactive rooms from its denominator. The two figures sit beside each
  // other on the Agent Dashboard — Occupancy's detail line and Gross margin's —
  // and an earlier version had them disagree by the rent of any room withdrawn
  // for repair while its tenant was still in residence.
  const lettable = new Set(rooms.filter((r) => r.active).map((r) => r.id));
  const live = tenancies.filter(
    (t) => isTenancyOccupying(t, now) && lettable.has(t.roomId),
  );

  // Every unit under lease, not only the active ones. Rent earned inside a unit
  // still marked 'onboarding' was previously credited with none of its master
  // rent charged against it, so a unit running at a loss reported a profit.
  const masterRent = sum(
    units.filter((u) => u.status !== "ended"),
    (u) => u.masterRent,
  );
  const rentRoll = sum(live, (t) => t.monthlyRent);

  return {
    landlords: new Set(
      units.map((u) => u.landlordId).filter((id): id is string => id !== null),
    ).size,
    properties: new Set(units.map((u) => u.propertyId)).size,
    units: units.length,
    unitsActive: units.filter((u) => u.status === "active").length,
    rooms: rooms.length,
    roomsActive: rooms.filter((r) => r.active).length,
    tenanciesLive: live.length,
    tenanciesUnderNotice: tenancies.filter((t) => t.status === "notice").length,
    masterRent,
    rentRoll,
    grossMargin: rentRoll - masterRent,
  };
}

/** Tenancies by status, for the pipeline strip on the tenant management page. */
export function getTmsTenancyBuckets(
  data: DashboardData,
  filter: TmsFilter,
): {
  key: TmsTenancyStatus;
  label: string;
  hint: string;
  tone: Tone;
  count: number;
  rentValue: number;
  tenancies: TmsTenancy[];
}[] {
  const scoped = data.tenancies.filter((t) =>
    inProperties(filter, t.propertyId),
  );
  return TMS_TENANCY_STATUSES.map((status) => {
    const tenancies = scoped.filter((t) => t.status === status.key);
    return {
      ...status,
      count: tenancies.length,
      rentValue: sum(tenancies, (t) => t.monthlyRent),
      tenancies,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Expenses                                                                    */
/* -------------------------------------------------------------------------- */

export interface TmsExpenseSummary {
  expenses: TmsExpense[];
  total: number;
  /**
   * How many distinct calendar months the expenses span. The spend figure is a
   * total over that window while the rent roll is always ONE month, so
   * comparing them needs this as the divisor. Zero when there is no spend.
   */
  monthsCovered: number;
  paid: number;
  unpaid: number;
  /**
   * Costs pinned to a tenancy and marked recoverable. Held apart from the rest
   * because they are not really the cost of running the unit — they are money
   * out on its way back in.
   */
  billable: number;
  recharged: number;
  awaitingRecharge: number;
  byCategory: {
    key: TmsExpenseCategory;
    label: string;
    hint: string;
    count: number;
    amount: number;
  }[];
  byProperty: {
    propertyId: string;
    propertyName: string;
    amount: number;
    count: number;
  }[];
}

/**
 * The operating cost of the portfolio.
 *
 * `month` filters on when the cost was incurred, which is deliberately not the
 * same field the payment tracking filters on: an expense belongs to the month
 * it was spent, a charge to the month it is rent for.
 */
export function getTmsExpenseSummary(
  data: DashboardData,
  filter: TmsFilter,
): TmsExpenseSummary {
  const expenses = data.expenses.filter(
    (e) =>
      inProperties(filter, e.propertyId) &&
      (filter.month === "" || e.incurredOn.slice(0, 7) === filter.month.slice(0, 7)),
  );

  const byProperty = new Map<
    string,
    { propertyId: string; propertyName: string; amount: number; count: number }
  >();
  for (const expense of expenses) {
    const entry = byProperty.get(expense.propertyId) ?? {
      propertyId: expense.propertyId,
      propertyName: expense.propertyName || "—",
      amount: 0,
      count: 0,
    };
    entry.amount += expense.amount;
    entry.count += 1;
    byProperty.set(expense.propertyId, entry);
  }

  const billableRows = expenses.filter((e) => e.billableToTenant);

  return {
    expenses,
    total: sum(expenses, (e) => e.amount),
    monthsCovered: new Set(expenses.map((e) => e.incurredOn.slice(0, 7))).size,
    paid: sum(
      expenses.filter((e) => e.paidAt !== null),
      (e) => e.amount,
    ),
    unpaid: sum(
      expenses.filter((e) => e.paidAt === null),
      (e) => e.amount,
    ),
    billable: sum(billableRows, (e) => e.amount),
    recharged: sum(
      billableRows.filter((e) => e.rechargedAt !== null),
      (e) => e.amount,
    ),
    awaitingRecharge: sum(
      billableRows.filter((e) => e.rechargedAt === null),
      (e) => e.amount,
    ),
    byCategory: TMS_EXPENSE_CATEGORIES.map((category) => {
      const rows = expenses.filter((e) => e.category === category.key);
      return {
        key: category.key,
        label: category.label,
        hint: category.hint,
        count: rows.length,
        amount: sum(rows, (e) => e.amount),
      };
    }).sort((a, b) => b.amount - a.amount),
    byProperty: [...byProperty.values()].sort((a, b) => b.amount - a.amount),
  };
}

export interface TmsTenantExpenseSummary {
  total: number;
  recharged: number;
  awaitingRecharge: number;
  /** Costs pinned to a tenancy but never marked recoverable. Absorbed. */
  absorbed: number;
  byTenant: {
    tenancyId: string;
    tenantName: string;
    roomCode: string;
    propertyName: string;
    amount: number;
    billable: number;
    recharged: number;
    count: number;
    expenses: TmsExpense[];
  }[];
}

/**
 * What the tenants have cost, tenant by tenant.
 *
 * The question this answers is which rooms are expensive to run, so it counts
 * every expense pinned to a tenancy — not only the recoverable ones. A room
 * that needs RM800 of repairs a year is worth knowing about whether or not the
 * tenant was ever billed for them.
 */
export function getTmsTenantExpenses(
  data: DashboardData,
  filter: TmsFilter,
): TmsTenantExpenseSummary {
  const expenses = getTmsExpenseSummary(data, filter).expenses.filter(
    (e) => e.tenancyId !== null,
  );

  const byTenant = new Map<
    string,
    TmsTenantExpenseSummary["byTenant"][number]
  >();

  for (const expense of expenses) {
    const id = expense.tenancyId!;
    const tenancy = data.tenancies.find((t) => t.id === id);
    const entry = byTenant.get(id) ?? {
      tenancyId: id,
      tenantName: expense.tenantName || tenancy?.tenantName || "—",
      roomCode: tenancy?.roomCode ?? "",
      propertyName: expense.propertyName,
      amount: 0,
      billable: 0,
      recharged: 0,
      count: 0,
      expenses: [],
    };
    entry.amount += expense.amount;
    if (expense.billableToTenant) entry.billable += expense.amount;
    if (expense.rechargedAt !== null) entry.recharged += expense.amount;
    entry.count += 1;
    entry.expenses.push(expense);
    byTenant.set(id, entry);
  }

  const billable = expenses.filter((e) => e.billableToTenant);

  return {
    total: sum(expenses, (e) => e.amount),
    recharged: sum(
      billable.filter((e) => e.rechargedAt !== null),
      (e) => e.amount,
    ),
    awaitingRecharge: sum(
      billable.filter((e) => e.rechargedAt === null),
      (e) => e.amount,
    ),
    absorbed: sum(
      expenses.filter((e) => !e.billableToTenant),
      (e) => e.amount,
    ),
    byTenant: [...byTenant.values()].sort((a, b) => b.amount - a.amount),
  };
}

/* -------------------------------------------------------------------------- */
/* Monitors — utility meters                                                   */
/* -------------------------------------------------------------------------- */

export interface TmsMeterSummary {
  /** The month the headline figures describe. */
  month: string | null;
  monthLabel: string;
  readings: TmsMeterReading[];
  readingCount: number;
  /** Readings that came from a device rather than being typed in. */
  iotCount: number;
  totalAmount: number;
  byUtility: {
    key: TmsUtility;
    label: string;
    unit: string;
    usage: number;
    amount: number;
    count: number;
  }[];
  /**
   * Ranked by amount, which is money and therefore comparable. There is
   * deliberately no total usage figure here: a unit's electricity is in kWh
   * and its water in cubic metres, and adding them would produce a number
   * that means nothing.
   */
  byUnit: {
    unitId: string;
    label: string;
    propertyName: string;
    meters: number;
    amount: number;
  }[];
  /** Every month with a reading, newest first — the month picker. */
  months: { month: string; label: string }[];
}

/**
 * Consumption for one month. With no month chosen the latest one present is
 * used, so the panel opens on something rather than on an empty state.
 */
export function getTmsMeterSummary(
  data: DashboardData,
  filter: TmsFilter,
): TmsMeterSummary {
  const scoped = data.readings.filter((r) =>
    inProperties(filter, r.propertyId),
  );
  const months = [...new Set(scoped.map((r) => r.periodMonth))].sort((a, b) =>
    b.localeCompare(a),
  );

  const target = filter.month || months[0] || null;
  const readings = target
    ? scoped.filter((r) => r.periodMonth === target)
    : [];

  const byUnit = new Map<string, TmsMeterSummary["byUnit"][number]>();
  for (const reading of readings) {
    const entry = byUnit.get(reading.unitId) ?? {
      unitId: reading.unitId,
      label: `${reading.propertyName} ${reading.unitNumber}`.trim() || "—",
      propertyName: reading.propertyName,
      meters: 0,
      amount: 0,
    };
    entry.meters += 1;
    entry.amount += reading.amount;
    byUnit.set(reading.unitId, entry);
  }

  return {
    month: target,
    monthLabel: target ? monthLabel(target) : "No readings yet",
    readings,
    readingCount: readings.length,
    iotCount: readings.filter((r) => r.source === "iot").length,
    totalAmount: sum(readings, (r) => r.amount),
    byUtility: TMS_UTILITIES.map((utility) => {
      const rows = readings.filter((r) => r.utility === utility.key);
      return {
        key: utility.key,
        label: utility.label,
        unit: utility.unit,
        usage: sum(rows, (r) => r.usageUnits),
        amount: sum(rows, (r) => r.amount),
        count: rows.length,
      };
    }),
    byUnit: [...byUnit.values()].sort((a, b) => b.amount - a.amount),
    months: months.map((month) => ({ month, label: monthLabel(month) })),
  };
}

/* -------------------------------------------------------------------------- */
/* TMS drill-down rows                                                         */
/* -------------------------------------------------------------------------- */

const TMS_TENANCY_TONE: Record<TmsTenancyStatus, Tone> = {
  enquiry: "idle",
  reserved: "committed",
  active: "received",
  notice: "risk",
  ended: "idle",
};

export function tmsTenancyRows(tenancies: TmsTenancy[]): DrillRow[] {
  return tenancies.map((tenancy) => {
    const status = TMS_TENANCY_STATUSES.find((s) => s.key === tenancy.status)!;
    return {
      id: tenancy.id,
      name: tenancy.tenantName,
      subtitle: tenancy.roomCode || tenancy.roomLabel,
      phone: tenancy.phone,
      amount: tenancy.monthlyRent,
      amountLabel: "per month",
      statusLabel: status.label,
      statusTone: TMS_TENANCY_TONE[tenancy.status],
      date: tenancy.movedOutAt ?? tenancy.movedInAt,
      dateLabel: tenancy.movedOutAt
        ? "Moves out"
        : tenancy.movedInAt
          ? "Moved in"
          : "No date",
      documents: tenancy.documents,
      flag:
        tenancy.status === "notice"
          ? "Under notice — this room needs refilling"
          : undefined,
    };
  });
}

/**
 * The room inventory as drill-down rows. Built from the resolved status rows
 * rather than the rooms directly, so a room and its tenant cannot disagree.
 */
export function tmsRoomRows(rows: TmsRoomStatusRow[], now: string): DrillRow[] {
  return rows.map((row) => ({
    id: row.roomId,
    name: row.roomCode,
    subtitle: row.rented
      ? `${row.propertyName} · ${row.tenantName}`
      : `${row.propertyName} · no one in residence`,
    phone: row.phone,
    amount: row.monthlyRent,
    amountLabel: row.rented ? "rent" : "asking",
    statusLabel: !row.active ? "Out of service" : row.rented ? "Rented" : "Vacant",
    statusTone: !row.active ? "stalled" : row.rented ? "received" : "idle",
    date: row.movedOutAt ?? row.movedInAt,
    dateLabel: row.movedOutAt
      ? "Moves out"
      : row.movedInAt
        ? "Moved in"
        : "No date",
    documents: [],
    // A vacant room with a move-in still AHEAD of it is already spoken for,
    // and chasing it as an empty room would be wasted effort.
    //
    // The date test is what makes this true. Without it a stale tenancy — one
    // left on 'notice' after its move-out had passed — labelled a room that had
    // been empty for weeks "Booked from" a date in the past, so the one room
    // most in need of refilling was the one the agent was told to leave alone.
    flag: !row.active
      ? "Withdrawn from letting — it is not counted in vacancy"
      : !row.rented
        ? holdFlag(row, now)
        : undefined,
  }));
}

/**
 * Why a vacant room is not available: a booking still to start, or a tenancy
 * that should have been closed off and is still holding the room against the
 * database's one-live-tenancy rule.
 */
function holdFlag(row: TmsRoomStatusRow, now: string): string | undefined {
  const t = row.tenancy;
  if (!t || !isTenancyHolding(t)) return undefined;

  if (t.movedInAt && t.movedInAt > now) return `Booked from ${t.movedInAt}`;
  if (!t.movedInAt) return "Held by a booking with no move-in date set";

  // Move-in is in the past, so the room should be occupied and is not — the
  // record contradicts itself and the room cannot be re-let until it is fixed.
  return `Still held by ${t.tenantName || "an open tenancy"} — close the tenancy to re-let this room`;
}

export function tmsCarparkRows(bays: TmsCarpark[]): DrillRow[] {
  return bays.map((bay) => ({
    id: bay.id,
    name: bay.bayLabel,
    subtitle: `${bay.propertyName} ${bay.unitNumber}`.trim(),
    phone: "",
    amount: bay.monthlyFee,
    amountLabel: bay.monthlyFee > 0 ? "per month" : "bundled",
    statusLabel: !bay.active
      ? "Out of service"
      : bay.tenancyId
        ? "Assigned"
        : "Not Assigned",
    statusTone: !bay.active ? "stalled" : bay.tenancyId ? "received" : "idle",
    date: null,
    dateLabel: bay.tenantName || "Free",
    documents: [],
  }));
}

export function tmsChargeRows(
  charges: TmsRentCharge[],
  now: string,
): DrillRow[] {
  return charges.map((charge) => {
    const kind = TMS_CHARGE_KINDS.find((k) => k.key === charge.kind)!;
    const overdue = isChargeOverdue(charge, now);
    return {
      id: charge.id,
      name: charge.tenantName || "—",
      subtitle: `${charge.roomCode || "—"} · ${kind.label} · ${monthLabel(charge.periodMonth)}`,
      phone: "",
      amount: charge.amount,
      amountLabel: charge.description || kind.label,
      statusLabel:
        charge.status === "paid"
          ? "Paid"
          : charge.status === "submitted"
            ? "Awaiting Confirmation"
            : "Not Paid",
      statusTone:
        charge.status === "paid"
          ? "received"
          : charge.status === "submitted"
            ? "committed"
            : overdue
              ? "stalled"
              : "risk",
      date: charge.paidAt ?? charge.dueAt,
      dateLabel: charge.paidAt ? "Paid" : "Due",
      documents: charge.documents,
      flag: overdue
        ? `Overdue — due ${charge.dueAt}, ${daysBetween(charge.dueAt, now)} days ago`
        : undefined,
    };
  });
}

export function tmsExpenseRows(expenses: TmsExpense[]): DrillRow[] {
  return expenses.map((expense) => {
    const category = TMS_EXPENSE_CATEGORIES.find(
      (c) => c.key === expense.category,
    )!;
    const where = [expense.propertyName, expense.unitNumber, expense.tenantName]
      .filter(Boolean)
      .join(" · ");
    return {
      id: expense.id,
      name: expense.description || category.label,
      subtitle: where || category.hint,
      phone: "",
      amount: expense.amount,
      amountLabel: category.label,
      statusLabel: expense.paidAt ? "Paid" : "Outstanding",
      statusTone: expense.paidAt ? "received" : "risk",
      date: expense.incurredOn,
      dateLabel: "Incurred",
      documents: expense.documents,
      flag:
        expense.billableToTenant && expense.rechargedAt === null
          ? "Recoverable from the tenant, not yet recharged"
          : undefined,
    };
  });
}

export function tmsReadingRows(readings: TmsMeterReading[]): DrillRow[] {
  return readings.map((reading) => {
    const utility = TMS_UTILITIES.find((u) => u.key === reading.utility)!;
    return {
      id: reading.id,
      name: reading.roomCode || `${reading.propertyName} ${reading.unitNumber}`.trim(),
      subtitle: `${utility.label} · ${monthLabel(reading.periodMonth)} · ${reading.usageUnits} ${utility.unit}`,
      phone: "",
      amount: reading.amount,
      amountLabel: `${reading.ratePerUnit}/${utility.unit}`,
      statusLabel: reading.source === "iot" ? "Device" : "Manual",
      statusTone: reading.source === "iot" ? "received" : "idle",
      date: reading.periodMonth,
      dateLabel: "Month",
      documents: reading.documents,
    };
  });
}

export function tmsUnitRows(units: TmsUnit[]): DrillRow[] {
  return units.map((unit) => {
    const status = TMS_UNIT_STATUSES.find((s) => s.key === unit.status)!;
    return {
      id: unit.id,
      name: `${unit.propertyName} ${unit.unitNumber}`.trim(),
      subtitle: unit.landlordName
        ? `Landlord: ${unit.landlordName}`
        : "No landlord on record",
      phone: "",
      amount: unit.masterRent,
      amountLabel: "master rent",
      statusLabel: status.label,
      statusTone: status.tone,
      date: unit.leaseEndAt ?? unit.leaseStartAt,
      dateLabel: unit.leaseEndAt ? "Lease ends" : "Lease starts",
      documents: unit.documents,
    };
  });
}

export function tmsLandlordRows(
  landlords: TmsLandlord[],
  units: TmsUnit[],
): DrillRow[] {
  return landlords.map((landlord) => {
    const theirs = units.filter((u) => u.landlordId === landlord.id);
    return {
      id: landlord.id,
      name: landlord.landlordName,
      subtitle: landlord.companyName || `${theirs.length} unit${theirs.length === 1 ? "" : "s"}`,
      phone: landlord.phone,
      // The landlord's position is what we pay them, which is the sum of the
      // master rents on their units — not a figure stored against them.
      amount: sum(theirs, (u) => u.masterRent),
      amountLabel: "master rent",
      statusLabel: landlord.loginEmail ? "Has sign-in" : "No sign-in",
      statusTone: landlord.loginEmail ? "received" : "idle",
      date: null,
      dateLabel: landlord.bankName || "No bank on record",
      documents: landlord.documents,
    };
  });
}
