import {
  TMS_CHARGE_KINDS,
  TMS_EXPENSE_CATEGORIES,
  TMS_TENANCY_STATUSES,
} from "./constants";
import {
  getTmsCarparkVacancy,
  getTmsExpenseSummary,
  getTmsRoomInventory,
  getTmsRoomVacancy,
  isChargeOverdue,
  isTenancyOccupying,
  tmsCarparkRows,
  tmsChargeRows,
  tmsExpenseRows,
  tmsLandlordRows,
  tmsReadingRows,
  tmsRoomRows,
  tmsTenancyRows,
  tmsUnitRows,
} from "./metrics";
import type { TmsFilter } from "./metrics";
import type { DashboardData } from "./data";
import type {
  DrillDownContent,
  DrillRow,
  TmsChargeKind,
  TmsExpenseCategory,
  TmsTenancyStatus,
} from "./types";

const total = (rows: DrillRow[]) =>
  rows.reduce((sum, row) => sum + row.amount, 0);

/* -------------------------------------------------------------------------- */
/* Capital — combined across Factory + MDNA                                    */
/* -------------------------------------------------------------------------- */

/** Rooms by status — the two halves of the Room Vacancy pie. */
export function tmsRoomDrill(
  data: DashboardData,
  filter: TmsFilter,
  now: string,
  which: "all" | "rented" | "vacant",
): DrillDownContent {
  const vacancy = getTmsRoomVacancy(data, filter, now);
  const source =
    which === "all"
      ? vacancy.rows
      : vacancy.rows.filter((r) => r.rented === (which === "rented"));
  const rows = tmsRoomRows(source, now);

  const titles = {
    all: "Rooms — All",
    rented: "Rooms Rented",
    vacant: "Rooms Vacant",
  } as const;

  const subtitles = {
    all: "Every lettable room, with whoever is in it today.",
    rented:
      "Rooms with a tenancy in residence right now. These are the rooms earning rent.",
    vacant:
      "Rooms with nobody in residence today. Some already carry a booking — those are flagged.",
  } as const;

  return {
    title: titles[which],
    subtitle: subtitles[which],
    total: total(rows),
    totalLabel: `${rows.length} ${rows.length === 1 ? "room" : "rooms"} · monthly rent`,
    amountHeader: "Monthly Rent (RM)",
    rows,
  };
}

/**
 * The full room inventory, withdrawn rooms included — the management page's
 * list. Distinct from tmsRoomDrill, which is drawn from the vacancy figures
 * and therefore leaves out anything not currently lettable.
 */
export function tmsRoomInventoryDrill(
  data: DashboardData,
  filter: TmsFilter,
  now: string,
): DrillDownContent {
  const rows = tmsRoomRows(getTmsRoomInventory(data, filter, now), now);
  const out = rows.filter((r) => r.statusLabel === "Out of service").length;

  return {
    title: "Rooms",
    subtitle:
      out > 0
        ? `Every room on record. ${out} withdrawn from letting and not counted in vacancy.`
        : "Every room on record. A room exists whether or not anyone is in it.",
    total: total(rows),
    totalLabel: `${rows.length} ${rows.length === 1 ? "room" : "rooms"} · monthly rent`,
    amountHeader: "Monthly Rent (RM)",
    rows,
  };
}

/** Every bay on record, out-of-service ones included. */
export function tmsCarparkInventoryDrill(
  data: DashboardData,
  filter: TmsFilter,
): DrillDownContent {
  const bays = data.carparks.filter(
    (c) =>
      filter.propertyIds.length === 0 ||
      filter.propertyIds.includes(c.propertyId),
  );
  const rows = tmsCarparkRows(bays);

  return {
    title: "Carparks",
    subtitle:
      "Every bay on record, in service or not. Assign one from the Edit sheet.",
    total: total(rows),
    totalLabel: `${rows.length} ${rows.length === 1 ? "bay" : "bays"} · monthly fees`,
    amountHeader: "Monthly Fee (RM)",
    rows,
  };
}

/** Bays by assignment — the two halves of the Carpark Vacancy pie. */
export function tmsCarparkDrill(
  data: DashboardData,
  filter: TmsFilter,
  which: "all" | "assigned" | "unassigned",
): DrillDownContent {
  const { bays } = getTmsCarparkVacancy(data, filter);
  const source =
    which === "all"
      ? bays
      : bays.filter((b) => (b.tenancyId !== null) === (which === "assigned"));
  const rows = tmsCarparkRows(source);

  const titles = {
    all: "Carparks — All",
    assigned: "Carparks Assigned",
    unassigned: "Carparks Not Assigned",
  } as const;

  return {
    title: titles[which],
    subtitle:
      which === "unassigned"
        ? "Bays with no tenant against them. Each one is a fee not being charged."
        : "Bays in the portfolio, and who holds them.",
    total: total(rows),
    totalLabel: `${rows.length} ${rows.length === 1 ? "bay" : "bays"} · monthly fees`,
    amountHeader: "Monthly Fee (RM)",
    rows,
  };
}

/** Charges by settlement — the Paid and Not-Paid bars. */
export function tmsChargeDrill(
  data: DashboardData,
  filter: TmsFilter,
  now: string,
  which: "all" | "paid" | "unpaid" | "overdue",
): DrillDownContent {
  const scoped = data.charges.filter(
    (c) =>
      (filter.propertyIds.length === 0 ||
        filter.propertyIds.includes(c.propertyId)) &&
      (filter.month === "" || c.periodMonth === filter.month),
  );

  const source =
    which === "all"
      ? scoped
      : which === "overdue"
        ? scoped.filter((c) => isChargeOverdue(c, now))
        : scoped.filter((c) => c.status === which);

  const rows = tmsChargeRows(source, now);

  const titles = {
    all: "Payments — All",
    paid: "Payments Received",
    unpaid: "Payments Outstanding",
    overdue: "Payments Overdue",
  } as const;

  const subtitles = {
    all: "Every charge raised in the period — rent, carpark, utilities and the rest.",
    paid: "Charges settled, with the date the money arrived.",
    unpaid: "Charges still owed. Not all of them are late yet.",
    overdue: "Charges past their due date and still unpaid. Chase these first.",
  } as const;

  return {
    title: titles[which],
    subtitle: subtitles[which],
    total: total(rows),
    totalLabel: `${rows.length} ${rows.length === 1 ? "charge" : "charges"}`,
    amountHeader: "Amount (RM)",
    rows,
  };
}

/** One kind of charge — rent, carpark, utility or other. */
export function tmsChargeKindDrill(
  data: DashboardData,
  filter: TmsFilter,
  now: string,
  kind: TmsChargeKind,
): DrillDownContent {
  const meta = TMS_CHARGE_KINDS.find((k) => k.key === kind)!;
  const rows = tmsChargeRows(
    data.charges.filter(
      (c) =>
        c.kind === kind &&
        (filter.propertyIds.length === 0 ||
          filter.propertyIds.includes(c.propertyId)) &&
        (filter.month === "" || c.periodMonth === filter.month),
    ),
    now,
  );

  return {
    title: `${meta.label} Charges`,
    subtitle: meta.hint,
    total: total(rows),
    totalLabel: `${rows.length} ${rows.length === 1 ? "charge" : "charges"}`,
    amountHeader: "Amount (RM)",
    rows,
  };
}

export function tmsTenancyDrill(
  data: DashboardData,
  filter: TmsFilter,
  now: string,
  which: "all" | "live" | "pipeline" | "notice",
): DrillDownContent {
  const scoped = data.tenancies.filter(
    (t) =>
      filter.propertyIds.length === 0 ||
      filter.propertyIds.includes(t.propertyId),
  );

  const source = scoped.filter((t) => {
    if (which === "all") return true;
    if (which === "live") return isTenancyOccupying(t, now);
    if (which === "notice") return t.status === "notice";
    return t.status === "enquiry" || t.status === "reserved";
  });

  const rows = tmsTenancyRows(source);

  const titles = {
    all: "Tenancies — All",
    live: "Tenants In Residence",
    pipeline: "Tenancy Pipeline",
    notice: "Tenants Under Notice",
  } as const;

  const subtitles = {
    all: "Every tenancy on record, past and present.",
    live: "Tenancies whose term covers today. These are the rooms earning rent.",
    pipeline:
      "Enquiries and reservations. A reservation already holds its room; an enquiry does not.",
    notice:
      "Tenants who have given notice. These rooms come empty unless they are refilled.",
  } as const;

  return {
    title: titles[which],
    subtitle: subtitles[which],
    total: total(rows),
    totalLabel: `${rows.length} ${rows.length === 1 ? "tenancy" : "tenancies"} · monthly rent`,
    amountHeader: "Monthly Rent (RM)",
    rows,
  };
}

/** One status from the tenancy pipeline strip. */
export function tmsTenancyStatusDrill(
  data: DashboardData,
  filter: TmsFilter,
  status: TmsTenancyStatus,
): DrillDownContent {
  const meta = TMS_TENANCY_STATUSES.find((s) => s.key === status)!;
  const rows = tmsTenancyRows(
    data.tenancies.filter(
      (t) =>
        t.status === status &&
        (filter.propertyIds.length === 0 ||
          filter.propertyIds.includes(t.propertyId)),
    ),
  );

  return {
    title: `Tenancies — ${meta.label}`,
    subtitle: meta.hint,
    total: total(rows),
    totalLabel: `${rows.length} ${rows.length === 1 ? "tenancy" : "tenancies"} · monthly rent`,
    amountHeader: "Monthly Rent (RM)",
    rows,
  };
}

export function tmsExpenseDrill(
  data: DashboardData,
  filter: TmsFilter,
  which: "all" | "tenant" | "operating" | "awaiting_recharge",
): DrillDownContent {
  const { expenses } = getTmsExpenseSummary(data, filter);

  const source = expenses.filter((e) => {
    if (which === "all") return true;
    if (which === "tenant") return e.tenancyId !== null;
    if (which === "operating") return e.tenancyId === null;
    return e.billableToTenant && e.rechargedAt === null;
  });

  const rows = tmsExpenseRows(source);

  const titles = {
    all: "Expenses — All",
    tenant: "Tenant Expenses",
    operating: "Operating Expenses",
    awaiting_recharge: "Awaiting Recharge",
  } as const;

  const subtitles = {
    all: "Every cost recorded against the portfolio in the period.",
    tenant:
      "Costs pinned to a tenancy — recoverable or not. What the rooms actually cost to run.",
    operating:
      "The cost of holding the units: master rent, management fees, utilities and upkeep.",
    awaiting_recharge:
      "Recoverable costs with no charge raised yet. Money out that has not started coming back.",
  } as const;

  return {
    title: titles[which],
    subtitle: subtitles[which],
    total: total(rows),
    totalLabel: `${rows.length} ${rows.length === 1 ? "expense" : "expenses"}`,
    amountHeader: "Amount (RM)",
    rows,
  };
}

export function tmsExpenseCategoryDrill(
  data: DashboardData,
  filter: TmsFilter,
  category: TmsExpenseCategory,
): DrillDownContent {
  const meta = TMS_EXPENSE_CATEGORIES.find((c) => c.key === category)!;
  const rows = tmsExpenseRows(
    getTmsExpenseSummary(data, filter).expenses.filter(
      (e) => e.category === category,
    ),
  );

  return {
    title: `Expenses — ${meta.label}`,
    subtitle: meta.hint,
    total: total(rows),
    totalLabel: `${rows.length} ${rows.length === 1 ? "expense" : "expenses"}`,
    amountHeader: "Amount (RM)",
    rows,
  };
}

export function tmsReadingDrill(
  data: DashboardData,
  filter: TmsFilter,
  month: string | null,
): DrillDownContent {
  const rows = tmsReadingRows(
    data.readings.filter(
      (r) =>
        (filter.propertyIds.length === 0 ||
          filter.propertyIds.includes(r.propertyId)) &&
        (month === null || r.periodMonth === month),
    ),
  );

  return {
    title: "Meter Readings",
    subtitle:
      "Every utility reading recorded, by hand or by device. Export to CSV for the billing run.",
    total: total(rows),
    totalLabel: `${rows.length} ${rows.length === 1 ? "reading" : "readings"}`,
    amountHeader: "Amount (RM)",
    rows,
  };
}

export function tmsUnitDrill(
  data: DashboardData,
  filter: TmsFilter,
): DrillDownContent {
  const rows = tmsUnitRows(
    data.units.filter(
      (u) =>
        filter.propertyIds.length === 0 ||
        filter.propertyIds.includes(u.propertyId),
    ),
  );

  return {
    title: "Units Under Lease",
    subtitle:
      "Every apartment held on a master lease, and what it costs each month.",
    total: total(rows),
    totalLabel: `${rows.length} ${rows.length === 1 ? "unit" : "units"} · master rent`,
    amountHeader: "Master Rent (RM)",
    rows,
  };
}

export function tmsLandlordDrill(data: DashboardData): DrillDownContent {
  const rows = tmsLandlordRows(data.landlords, data.units);

  return {
    title: "Landlords",
    subtitle:
      "The counterparties on the master leases. The amount is what their units cost us each month.",
    total: total(rows),
    totalLabel: `${rows.length} ${rows.length === 1 ? "landlord" : "landlords"}`,
    amountHeader: "Master Rent (RM)",
    rows,
  };
}
