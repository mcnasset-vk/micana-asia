import type {
  TmsChargeKind,
  TmsChargeStatus,
  TmsExpenseCategory,
  TmsRoomType,
  TmsTenancyStatus,
  TmsUnitStatus,
  TmsUtility,
  ModuleKey,
  Tone,
} from "./types";
import {
} from "./config";

/* -------------------------------------------------------------------------- */
/* Business rules — the numbers everything else derives from                    */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* MEC Asset (HR) — annual revenue model                                       */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* MEC partnership desk                                                        */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* MEC Lifestyle — operations desk                                             */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Tenant Management System                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Tenancy statuses in the order a tenancy moves through them.
 *
 * `reserved` deliberately sits between enquiry and active: it holds the room —
 * so no second tenancy can be booked into it — without being billed, because a
 * deposit against a future move-in is not yet rent.
 */
export const TMS_TENANCY_STATUSES: {
  key: TmsTenancyStatus;
  label: string;
  hint: string;
  tone: Tone;
}[] = [
  {
    key: "enquiry",
    label: "Enquiry",
    hint: "Viewing arranged, nothing signed",
    tone: "idle",
  },
  {
    key: "reserved",
    label: "Reserved",
    hint: "Deposit taken against a move-in still to come",
    tone: "committed",
  },
  {
    key: "active",
    label: "Active",
    hint: "In residence and paying rent",
    tone: "received",
  },
  {
    key: "notice",
    label: "Under Notice",
    hint: "Move-out date set — the room needs refilling",
    tone: "risk",
  },
  {
    key: "ended",
    label: "Ended",
    hint: "Moved out. The room and any carpark are free again",
    tone: "idle",
  },
];

/**
 * Statuses that hold a room against another tenancy. Mirrors the partial
 * unique index tms_tenancies_one_live_per_room, which is the real guard.
 */
export const TMS_HOLDING_STATUSES: TmsTenancyStatus[] = [
  "reserved",
  "active",
  "notice",
];

/**
 * Statuses that make a room *rented today*, given the dates also line up.
 * A reserved room is held but not yet occupied, which is why the dashboard can
 * show a vacant room that already carries a future move-in date.
 */
export const TMS_OCCUPYING_STATUSES: TmsTenancyStatus[] = ["active", "notice"];

export const TMS_UNIT_STATUSES: {
  key: TmsUnitStatus;
  label: string;
  hint: string;
  tone: Tone;
}[] = [
  {
    key: "onboarding",
    label: "Onboarding",
    hint: "Lease signed, not yet taking tenants",
    tone: "committed",
  },
  {
    key: "active",
    label: "Active",
    hint: "Under master lease and letting rooms",
    tone: "received",
  },
  {
    key: "ended",
    label: "Ended",
    hint: "Lease handed back to the landlord",
    tone: "idle",
  },
];

export const TMS_ROOM_TYPES: { key: TmsRoomType; label: string }[] = [
  { key: "master", label: "Master" },
  { key: "medium", label: "Medium" },
  { key: "single", label: "Single" },
  { key: "study", label: "Study" },
];

export const TMS_CHARGE_KINDS: {
  key: TmsChargeKind;
  label: string;
  hint: string;
}[] = [
  { key: "rent", label: "Rent", hint: "The monthly room rent" },
  { key: "carpark", label: "Carpark", hint: "An assigned bay, charged on top" },
  {
    key: "utility",
    label: "Utility",
    hint: "Electricity, water or aircon recharged to the room",
  },
  { key: "other", label: "Other", hint: "Damages, late fees, anything else" },
];

export const TMS_CHARGE_STATUSES: {
  key: TmsChargeStatus;
  label: string;
  /** For a bar-chart axis, where the full label crowds its neighbours out. */
  short: string;
  tone: Tone;
}[] = [
  { key: "unpaid", label: "Not Paid", short: "Not Paid", tone: "risk" },
  // Between the two, and deliberately not next to "Paid": a claim the office
  // has not checked belongs beside what is still owed, not beside what landed.
  {
    key: "submitted",
    label: "Awaiting Confirmation",
    short: "Awaiting",
    tone: "committed",
  },
  { key: "paid", label: "Paid", short: "Paid", tone: "received" },
];

export const TMS_EXPENSE_CATEGORIES: {
  key: TmsExpenseCategory;
  label: string;
  hint: string;
}[] = [
  {
    key: "master_rent",
    label: "Master Rent",
    hint: "What the landlord is paid for the unit",
  },
  { key: "maintenance", label: "Maintenance", hint: "Servicing and upkeep" },
  { key: "utilities", label: "Utilities", hint: "The bills for the whole unit" },
  { key: "internet", label: "Internet", hint: "Broadband for the unit" },
  { key: "cleaning", label: "Cleaning", hint: "Common-area cleaning" },
  { key: "furnishing", label: "Furnishing", hint: "Beds, wardrobes, appliances" },
  {
    key: "management_fee",
    label: "Management Fee",
    hint: "Charged by the building, not by us",
  },
  { key: "repairs", label: "Repairs", hint: "Fixing something broken" },
  { key: "other", label: "Other", hint: "Anything that fits nowhere else" },
];

export const TMS_UTILITIES: {
  key: TmsUtility;
  label: string;
  unit: string;
}[] = [
  { key: "electricity", label: "Electricity", unit: "kWh" },
  { key: "water", label: "Water", unit: "m³" },
  { key: "gas", label: "Gas", unit: "m³" },
  { key: "aircon", label: "Aircon", unit: "kWh" },
];

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

export const MODULE_LABELS: Record<ModuleKey, string> = {
  factory: "Factory Cosif",
  mdna: "MDNA Admin",
  nasdaq: "Nasdaq Listing M&A",
  commissions: "Introducer Commissions",
  mec: "MEC Asset (HR)",
  micana: "Micana Co-Living & HealthTech",
  tms: "Tenant Management System",
};

export const MODULE_HREF: Record<ModuleKey, string> = {
  factory: "/factory",
  mdna: "/mdna/admin",
  nasdaq: "/nasdaq",
  commissions: "/commissions",
  mec: "/mec",
  micana: "/micana",
  tms: "/tms",
};

