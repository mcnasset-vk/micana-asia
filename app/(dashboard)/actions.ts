"use server";

import { revalidatePath } from "next/cache";

import {
} from "@/lib/constants";
import { getCurrentProfile } from "@/lib/data";
import {
  openCheckout,
  GatewayError,
  gatewayConfigured,
  PROVIDER,
  reconcileAttempt,
  withdrawAttempt,
  type GatewayAttempt,
} from "@/lib/payments/gateway";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/today";
import {
  LINES_BY_ROLE,
  type BusinessLine,
  type TmsGatewayKind,
  type TmsSubmissionStatus,
} from "@/lib/types";

export interface FormState {
  ok?: boolean;
  error?: string;
  /**
   * Set by the two payment submissions. The tenant has to quote this on the
   * bank transfer, so it is the one thing a successful submit has to say back
   * — a sheet that closes silently loses it.
   */
  reference?: string;
}

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const orNull = (v: FormDataEntryValue | null) => {
  const s = str(v);
  return s === "" ? null : s;
};
const numOr = (v: FormDataEntryValue | null, fallback: number) => {
  const n = Number(str(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Every mutation refreshes the layout, which is where the data is fetched. */
function refresh() {
  revalidatePath("/", "layout");
}

/**
 * Set one account's role, module and job title.
 *
 * Authorisation is the `profiles_update_admin` policy: a non-super-admin's
 * update matches no rows and changes nothing. The checks below exist to turn
 * silence into a readable message, not to be the boundary.
 */
export async function saveUserAccess(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = orNull(formData.get("id"));
  if (!id) return { error: "No account selected." };

  const role = str(formData.get("role")) || "pending";
  // Only a division role carries a line; a null line means the whole division.
  const rawLine = orNull(formData.get("business_line"));
  const businessLine =
    role === "mdna" || role === "mec" || role === "micana" ? rawLine : null;

  const allowed = LINES_BY_ROLE[role as "mdna" | "mec" | "micana"] ?? [];
  if (businessLine && !allowed.includes(businessLine as BusinessLine)) {
    return { error: `That business line does not belong to the ${role} division.` };
  }

  // An unchecked box submits nothing at all, so absence is false — the same
  // reasoning as CheckboxField in components/ui/Field.tsx.
  const canIssueInvoices = formData.get("can_issue_invoices") === "on";

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      role,
      business_line: businessLine,
      can_issue_invoices: canIssueInvoices,
    })
    .eq("id", id)
    .select("id");

  if (error) return { error: describe(error.message) };

  // No error and no row means RLS filtered the update out — the caller is not
  // a super admin, or the account no longer exists.
  if (!data || data.length === 0) {
    return {
      error:
        "Nothing was updated. Only a super admin can change roles, and the account must still exist.",
    };
  }

  refresh();
  return { ok: true };
}

function describe(message: string): string {
  if (/row-level security/i.test(message)) {
    return "You do not have permission to change records in this module.";
  }
  if (/profiles_module_matches_role/i.test(message)) {
    return "That role and module combination is not allowed.";
  }
  if (/violates check constraint/i.test(message)) {
    return "Some values are out of range. Check the amounts and dates.";
  }
  return message;
}

/** Meter and ledger periods are stored as the first of the month. */
const monthOr = (v: FormDataEntryValue | null, fallback: string) => {
  const s = str(v);
  return /^\d{4}-\d{2}/.test(s) ? `${s.slice(0, 7)}-01` : fallback;
};

const thisMonth = () => `${new Date().toISOString().slice(0, 7)}-01`;

/** Settle or un-settle an owner's monthly profit share. */
export async function setPayoutPaid(
  payoutId: string,
  paid: boolean,
): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("micana_owner_payouts")
    .update(
      paid
        ? { status: "paid", paid_at: new Date().toISOString().slice(0, 10) }
        : { status: "accrued", paid_at: null },
    )
    .eq("id", payoutId);

  if (error) return { error: describe(error.message) };
  refresh();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Tenant Management System                                                    */
/* -------------------------------------------------------------------------- */
/* Authorisation is left to row level security throughout, exactly as it is for
 * the other modules: a landlord's or tenant's insert simply fails against the
 * policy, so there is no permission check here to forget. What these actions
 * do check is the shape of the record — a tenancy with no room, a charge with
 * no month — because RLS has nothing to say about that. */

export async function saveTmsLandlord(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = orNull(formData.get("id"));
  const landlordName = str(formData.get("landlord_name"));
  if (!landlordName) return { error: "Landlord name is required." };

  const payload = {
    landlord_name: landlordName,
    company_name: str(formData.get("company_name")),
    phone: str(formData.get("phone")),
    email: str(formData.get("email")),
    id_number: str(formData.get("id_number")),
    bank_name: str(formData.get("bank_name")),
    bank_account: str(formData.get("bank_account")),
    notes: orNull(formData.get("notes")),
  };

  const supabase = await createClient();
  const saved = id
    ? await supabase
        .from("tms_landlords")
        .update(payload)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase.from("tms_landlords").insert(payload).select("id").single();

  if (saved.error) return { error: describeTms(saved.error.message) };

  // Linking is a separate, privileged step: turning an address into an account
  // needs auth.users, which this client cannot read. The record is already
  // saved by this point, so a failure here is reported as exactly that.
  const link = await supabase.rpc("tms_link_landlord_login", {
    p_landlord: saved.data.id,
    p_email: str(formData.get("login_email")),
  });
  if (link.error) {
    refresh();
    return {
      error: `Landlord saved, but the sign-in was not linked. ${describeTms(link.error.message)}`,
    };
  }

  refresh();
  return { ok: true };
}

export async function saveTmsProperty(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = orNull(formData.get("id"));
  const propertyName = str(formData.get("property_name"));
  if (!propertyName) return { error: "Property name is required." };

  const payload = {
    property_name: propertyName,
    // Blank is meaningful: the trigger derives ENESTA from "Enesta residence".
    property_code: str(formData.get("property_code")),
    address: str(formData.get("address")),
    city: str(formData.get("city")),
    state: str(formData.get("state")),
    property_type: str(formData.get("property_type")) || "condominium",
    notes: orNull(formData.get("notes")),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("tms_properties").update(payload).eq("id", id)
    : await supabase.from("tms_properties").insert(payload);

  if (error) return { error: describeTms(error.message) };
  refresh();
  return { ok: true };
}

export async function saveTmsUnit(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = orNull(formData.get("id"));
  const propertyId = orNull(formData.get("property_id"));
  if (!propertyId) return { error: "Choose which property this unit is in." };

  const unitNumber = str(formData.get("unit_number"));
  if (!unitNumber) return { error: "Unit number is required." };

  const payload = {
    property_id: propertyId,
    // Blank means the unit is held with no landlord on record yet, which is a
    // null rather than an empty string the foreign key would reject.
    landlord_id: orNull(formData.get("landlord_id")),
    unit_number: unitNumber,
    floor_label: str(formData.get("floor_label")),
    master_rent: numOr(formData.get("master_rent"), 0),
    lease_start_at: orNull(formData.get("lease_start_at")),
    lease_end_at: orNull(formData.get("lease_end_at")),
    status: str(formData.get("status")) || "active",
    notes: orNull(formData.get("notes")),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("tms_units").update(payload).eq("id", id)
    : await supabase.from("tms_units").insert(payload);

  if (error) return { error: describeTms(error.message) };
  refresh();
  return { ok: true };
}

export async function saveTmsRoom(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = orNull(formData.get("id"));
  const unitId = orNull(formData.get("unit_id"));
  if (!unitId) return { error: "Choose which unit this room is in." };

  const roomLabel = str(formData.get("room_label"));
  if (!roomLabel) return { error: "Room label is required." };

  const payload = {
    unit_id: unitId,
    room_label: roomLabel,
    room_type: str(formData.get("room_type")) || "single",
    market_rent: numOr(formData.get("market_rent"), 0),
    has_aircon: formData.get("has_aircon") !== null,
    has_bathroom: formData.get("has_bathroom") !== null,
    active: formData.get("active") !== null,
    notes: orNull(formData.get("notes")),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("tms_rooms").update(payload).eq("id", id)
    : await supabase.from("tms_rooms").insert(payload);

  if (error) return { error: describeTms(error.message) };
  refresh();
  return { ok: true };
}

export async function saveTmsCarpark(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = orNull(formData.get("id"));
  const unitId = orNull(formData.get("unit_id"));
  if (!unitId) return { error: "Choose which unit this bay belongs to." };

  const bayLabel = str(formData.get("bay_label"));
  if (!bayLabel) return { error: "Bay label is required." };

  const payload = {
    unit_id: unitId,
    bay_label: bayLabel,
    monthly_fee: numOr(formData.get("monthly_fee"), 0),
    // Blank frees the bay. A partial unique index keeps one tenancy to one
    // bay, so reassigning a tenant who already holds one is refused.
    tenancy_id: orNull(formData.get("tenancy_id")),
    active: formData.get("active") !== null,
    notes: orNull(formData.get("notes")),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("tms_carparks").update(payload).eq("id", id)
    : await supabase.from("tms_carparks").insert(payload);

  if (error) return { error: describeTms(error.message) };
  refresh();
  return { ok: true };
}

export async function saveTmsTenancy(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = orNull(formData.get("id"));
  const tenantName = str(formData.get("tenant_name"));
  if (!tenantName) return { error: "Tenant name is required." };

  const roomId = orNull(formData.get("room_id"));
  if (!roomId) return { error: "Choose which room this tenancy is for." };

  const movedOutAt = orNull(formData.get("moved_out_at"));
  let status = str(formData.get("status")) || "enquiry";

  // A move-out date that has already passed means the tenancy is over, whatever
  // the status field still says.
  //
  // Left alone, the two disagree in a way that strands the room: lib/metrics.ts
  // reads the dates and reports it Vacant, while the partial unique index
  // tms_tenancies_one_live_per_room reads the status and refuses the next
  // tenancy. The agent is told to fill a room the database will not let them
  // fill. Closing it here is what the date already meant.
  if (
    movedOutAt &&
    movedOutAt < today() &&
    (status === "active" || status === "notice" || status === "reserved")
  ) {
    status = "ended";
  }

  const payload = {
    room_id: roomId,
    tenant_name: tenantName,
    phone: str(formData.get("phone")),
    email: str(formData.get("email")),
    id_number: str(formData.get("id_number")),
    status,
    monthly_rent: numOr(formData.get("monthly_rent"), 0),
    deposit: numOr(formData.get("deposit"), 0),
    advance_rent: numOr(formData.get("advance_rent"), 0),
    rent_due_day: Math.min(28, Math.max(1, numOr(formData.get("rent_due_day"), 1))),
    // An enquiry has not moved in by definition, so a date left over from an
    // earlier edit is cleared rather than kept and quietly counted.
    moved_in_at:
      status === "enquiry" ? null : orNull(formData.get("moved_in_at")),
    moved_out_at: movedOutAt,
    notes: orNull(formData.get("notes")),
  };

  const supabase = await createClient();
  const saved = id
    ? await supabase
        .from("tms_tenancies")
        .update(payload)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase.from("tms_tenancies").insert(payload).select("id").single();

  if (saved.error) return { error: describeTms(saved.error.message) };

  const link = await supabase.rpc("tms_link_tenancy_login", {
    p_tenancy: saved.data.id,
    p_email: str(formData.get("login_email")),
  });
  if (link.error) {
    refresh();
    return {
      error: `Tenancy saved, but the sign-in was not linked. ${describeTms(link.error.message)}`,
    };
  }

  refresh();
  return { ok: true };
}

/**
 * Booking / tenancy registration.
 *
 * Separate from saveTmsTenancy rather than folded into it: the short form is
 * still the right tool for correcting a rent or closing a term, and widening
 * it to twenty-five more fields would have made every small edit submit — and
 * therefore be able to blank — the whole registration.
 *
 * Both write the same row. The serial number, the agent's name and the term
 * length are filled by the database on save, so nothing here sets them.
 */
export async function saveTmsBooking(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = orNull(formData.get("id"));
  const tenantName = str(formData.get("tenant_name"));
  if (!tenantName) return { error: "Tenant name is required." };

  const roomId = orNull(formData.get("room_id"));
  if (!roomId) return { error: "Choose which room this booking is for." };

  const movedOutAt = orNull(formData.get("moved_out_at"));
  let status = str(formData.get("status")) || "active";

  // Same reconciliation the short form does: a move-out date in the past means
  // the tenancy is over whatever the status still says, and leaving the two
  // disagreeing strands the room — the metrics read the date and call it
  // vacant while tms_tenancies_one_live_per_room reads the status and refuses
  // the next tenancy.
  if (
    movedOutAt &&
    movedOutAt < today() &&
    (status === "active" || status === "notice" || status === "reserved")
  ) {
    status = "ended";
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    room_id: roomId,
    tenant_name: tenantName,
    phone: str(formData.get("phone")),
    email: str(formData.get("email")),
    id_number: str(formData.get("id_number")),
    status,

    nickname: str(formData.get("nickname")),
    gender: str(formData.get("gender")),
    nationality: str(formData.get("nationality")),

    ec_name: str(formData.get("ec_name")),
    ec_phone: str(formData.get("ec_phone")),
    ec_relationship: str(formData.get("ec_relationship")),

    smart_meter_id: str(formData.get("smart_meter_id")),
    key_issued: formData.get("key_issued") === "on",
    parking_included: formData.get("parking_included") === "on",
    renewal_months: numOr(formData.get("renewal_months"), 12),

    monthly_rent: numOr(formData.get("monthly_rent"), 0),
    // The total the agent settled on in the calculator, not the raw
    // apportionment — tms_generate_month bills exactly this for the first
    // month when it is a part month.
    pro_rate: Math.max(0, numOr(formData.get("pro_rate"), 0)),
    security_deposit: numOr(formData.get("security_deposit"), 0),
    utility_deposit: numOr(formData.get("utility_deposit"), 0),
    access_key_deposit: numOr(formData.get("access_key_deposit"), 0),
    access_key_count: numOr(formData.get("access_key_count"), 0),
    agreement_fee: numOr(formData.get("agreement_fee"), 0),

    rent_due_day: Math.min(
      28,
      Math.max(1, numOr(formData.get("rent_due_day"), 1)),
    ),
    moved_in_at:
      status === "enquiry" ? null : orNull(formData.get("moved_in_at")),
    moved_out_at: movedOutAt,
    notes: orNull(formData.get("notes")),
    // Only on the first save. Re-registering an edit under whoever happened to
    // open the form would rewrite who took the booking.
    ...(id ? {} : { agent_id: user?.id ?? null }),
  };

  const saved = id
    ? await supabase
        .from("tms_tenancies")
        .update(payload)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase
        .from("tms_tenancies")
        .insert(payload)
        .select("id")
        .single();

  if (saved.error) return { error: describeTms(saved.error.message) };

  // Access cards are matched by id rather than replaced wholesale.
  //
  // The first draft deleted them all and re-inserted, which is simpler and
  // wrong: the photographs of each card are stored under the card's id, so
  // every save would have handed the rows new ids and orphaned every picture
  // taken of them. A card the agent cleared out is deleted by its absence
  // here, which is the only deletion that should happen.
  const seen: string[] = [];
  const inserts: { tenancy_id: string; card_label: string; key_no: string }[] =
    [];

  for (let index = 0; index < 20; index += 1) {
    const cardId = str(formData.get(`card_id_${index}`));
    const label = str(formData.get(`card_label_${index}`));
    const keyNo = str(formData.get(`card_key_${index}`));
    if (!label && !keyNo) continue;

    if (cardId) {
      seen.push(cardId);
      const { error } = await supabase
        .from("tms_access_cards")
        .update({ card_label: label, key_no: keyNo })
        .eq("id", cardId);
      if (error) {
        refresh();
        return {
          error: `Registration saved, but the access cards were not updated. ${describeTms(error.message)}`,
        };
      }
    } else {
      inserts.push({
        tenancy_id: saved.data.id,
        card_label: label,
        key_no: keyNo,
      });
    }
  }

  const dropped =
    seen.length > 0
      ? await supabase
          .from("tms_access_cards")
          .delete()
          .eq("tenancy_id", saved.data.id)
          .not("id", "in", `(${seen.join(",")})`)
      : await supabase
          .from("tms_access_cards")
          .delete()
          .eq("tenancy_id", saved.data.id);
  if (dropped.error) {
    refresh();
    return {
      error: `Registration saved, but the access cards were not updated. ${describeTms(dropped.error.message)}`,
    };
  }

  if (inserts.length > 0) {
    const written = await supabase.from("tms_access_cards").insert(inserts);
    if (written.error) {
      refresh();
      return {
        error: `Registration saved, but the access cards were not updated. ${describeTms(written.error.message)}`,
      };
    }
  }

  const link = await supabase.rpc("tms_link_tenancy_login", {
    p_tenancy: saved.data.id,
    p_email: str(formData.get("login_email")),
  });
  if (link.error) {
    refresh();
    return {
      error: `Registration saved, but the sign-in was not linked. ${describeTms(link.error.message)}`,
    };
  }

  refresh();
  return { ok: true };
}

export async function saveTmsCharge(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = orNull(formData.get("id"));
  const tenancyId = orNull(formData.get("tenancy_id"));
  if (!tenancyId) return { error: "Choose which tenancy this charge is for." };

  const status = str(formData.get("status")) || "unpaid";
  const paidAt = orNull(formData.get("paid_at"));

  const payload = {
    tenancy_id: tenancyId,
    period_month: monthOr(formData.get("period_month"), thisMonth()),
    kind: str(formData.get("kind")) || "rent",
    description: str(formData.get("description")),
    amount: numOr(formData.get("amount"), 0),
    status,
    due_at: orNull(formData.get("due_at")) ?? undefined,
    // The database refuses a paid charge with no date, so default it here to
    // today rather than bouncing the operator back to fill in an obvious field.
    paid_at: status === "paid" ? (paidAt ?? today()) : null,
    method: str(formData.get("method")),
    reference: str(formData.get("reference")),
    notes: orNull(formData.get("notes")),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("tms_rent_charges").update(payload).eq("id", id)
    : await supabase.from("tms_rent_charges").insert(payload);

  if (error) return { error: describeTms(error.message) };
  refresh();
  return { ok: true };
}

export async function saveTmsExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = orNull(formData.get("id"));
  const propertyId = orNull(formData.get("property_id"));
  if (!propertyId) return { error: "Choose which property this cost is for." };

  const tenancyId = orNull(formData.get("tenancy_id"));
  const billable = formData.get("billable_to_tenant") !== null;
  if (billable && !tenancyId) {
    return {
      error:
        "A recoverable cost has to name the tenancy it will be recharged to.",
    };
  }

  const payload = {
    property_id: propertyId,
    unit_id: orNull(formData.get("unit_id")),
    tenancy_id: tenancyId,
    category: str(formData.get("category")) || "maintenance",
    description: str(formData.get("description")),
    amount: numOr(formData.get("amount"), 0),
    incurred_on: orNull(formData.get("incurred_on")) ?? today(),
    paid_at: orNull(formData.get("paid_at")),
    billable_to_tenant: billable,
    recharged_at: billable ? orNull(formData.get("recharged_at")) : null,
    notes: orNull(formData.get("notes")),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("tms_expenses").update(payload).eq("id", id)
    : await supabase.from("tms_expenses").insert(payload);

  if (error) return { error: describeTms(error.message) };
  refresh();
  return { ok: true };
}

export async function saveTmsReading(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = orNull(formData.get("id"));
  const unitId = orNull(formData.get("unit_id"));
  if (!unitId) return { error: "Choose which unit this meter is on." };

  const payload = {
    unit_id: unitId,
    // Blank means a whole-unit meter, which is the common case.
    room_id: orNull(formData.get("room_id")),
    utility: str(formData.get("utility")) || "electricity",
    period_month: monthOr(formData.get("period_month"), thisMonth()),
    previous_reading: numOr(formData.get("previous_reading"), 0),
    current_reading: numOr(formData.get("current_reading"), 0),
    rate_per_unit: numOr(formData.get("rate_per_unit"), 0),
    notes: orNull(formData.get("notes")),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("tms_meter_readings").update(payload).eq("id", id)
    : await supabase.from("tms_meter_readings").insert(payload);

  if (error) return { error: describeReading(error.message) };
  refresh();
  return { ok: true };
}

/**
 * The TMS constraints an agent will actually hit, in the words of the job
 * rather than the words of the database.
 *
 * `describe` above turns every unique violation into the raw Postgres text —
 * "duplicate key value violates unique constraint tms_tenancies_one_live_per_room"
 * — which tells someone booking a room precisely nothing about what to do next.
 * Each of these names the conflict and the way out of it.
 */
function describeTms(message: string): string {
  if (/tms_tenancies_one_live_per_room/i.test(message)) {
    return "That room already has a live tenancy. End the current one — set it to Ended with a move-out date — before letting the room again.";
  }
  if (/tms_carparks_one_per_tenancy/i.test(message)) {
    return "That tenant already holds a bay. Free the other one first.";
  }
  if (/tms_carparks_label_unique/i.test(message)) {
    return "That unit already has a bay with this label.";
  }
  if (/tms_rooms_label_unique/i.test(message)) {
    return "That unit already has a room with this label.";
  }
  if (/tms_units_number_unique/i.test(message)) {
    return "That property already has a unit with this number.";
  }
  if (/tms_charges_one_per_month/i.test(message)) {
    return "That tenancy already has a charge of this kind for that month. Edit it instead of adding a second.";
  }
  if (/tms_tenancies_dates_ordered/i.test(message)) {
    return "The move-out date cannot come before the move-in date.";
  }
  if (/tms_units_lease_ordered/i.test(message)) {
    return "The lease end date cannot come before the lease start date.";
  }
  if (/tms_expenses_billable_has_tenancy/i.test(message)) {
    return "A recoverable cost has to name the tenancy it will be recharged to.";
  }
  if (/tms_charges_paid_has_date/i.test(message)) {
    return "A paid charge needs the date the money arrived.";
  }
  if (/violates foreign key constraint/i.test(message) && /tms_rent_charges/i.test(message)) {
    return "That tenancy has charges against it, so it cannot be deleted. Its rent ledger has to be dealt with first.";
  }
  return describe(message);
}

/**
 * A meter that reads lower than last month is the one error an operator will
 * actually hit here, and "values are out of range" would not tell them what to
 * do about it.
 */
function describeReading(message: string): string {
  if (/tms_readings_ordered/i.test(message)) {
    return "A meter cannot read lower than it did last month. If the meter was replaced, enter the previous reading as 0.";
  }
  if (/tms_readings_one_per_month/i.test(message)) {
    return "There is already a reading for that meter and month. Edit it instead.";
  }
  return describeTms(message);
}

/** Settling a charge, or putting it back. One click from the ledger. */
export async function setChargePaid(
  chargeId: string,
  paid: boolean,
): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tms_rent_charges")
    .update(
      paid
        ? { status: "paid", paid_at: today() }
        : { status: "unpaid", paid_at: null },
    )
    .eq("id", chargeId);

  if (error) return { error: describeTms(error.message) };
  refresh();
  return { ok: true };
}

/** Assign a bay to a tenancy, or free it. */
export async function setCarparkTenancy(
  carparkId: string,
  tenancyId: string | null,
): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tms_carparks")
    .update({ tenancy_id: tenancyId })
    .eq("id", carparkId);

  if (error) {
    if (/tms_carparks_one_per_tenancy/i.test(error.message)) {
      return { error: "That tenant already holds a bay. Free it first." };
    }
    return { error: describeTms(error.message) };
  }
  refresh();
  return { ok: true };
}

/**
 * Raise a month of rent and carpark charges for every live tenancy.
 *
 * Re-running the same month is safe and is the normal way to pick up a tenancy
 * that started mid-month: the database inserts only what is missing and never
 * touches a charge that already exists.
 */
export async function generateTmsMonth(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const month = monthOr(formData.get("period_month"), thisMonth());

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tms_generate_month", {
    p_month: month,
  });

  if (error) return { error: describeTms(error.message) };
  refresh();

  const made = Number(data ?? 0);
  return {
    ok: true,
    error:
      made === 0
        ? "Nothing to raise — every live tenancy already has its charges for that month."
        : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* Tenant-submitted payments                                                   */
/* -------------------------------------------------------------------------- */

/** Anything larger than this is a photo of a receipt taken very badly. */
const SLIP_MAX_BYTES = 8 * 1024 * 1024;

const SLIP_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/**
 * Puts a payment slip in the bucket and returns its path.
 *
 * The path is tms-slips/<uid>/… because the tms/ prefix is governed by
 * private.can_access, which a tenant deliberately fails — see section 12 of
 * 20260827000000_tms_payments.sql. The uid segment is checked by the storage
 * policy against auth.uid(), so naming someone else's folder is refused by the
 * database rather than trusted from here.
 */
async function uploadSlip(
  file: File,
): Promise<{ path?: string; error?: string }> {
  if (!file || file.size === 0) return { error: "Attach the payment slip." };
  if (file.size > SLIP_MAX_BYTES) {
    return { error: "That file is over 8MB. A photo of the slip is enough." };
  }
  if (!SLIP_TYPES.includes(file.type)) {
    return { error: "Upload a JPEG, PNG, WebP or PDF." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Sign in again." };

  // crypto.randomUUID rather than the filename: two tenants both uploading
  // "slip.jpg" must not be able to collide, and a filename from a browser is
  // not something to build a storage path out of.
  const extension =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
  const path = `tms-slips/${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from("documents")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { error: "The slip could not be uploaded. Try again." };
  return { path };
}

const REGISTRATION_MAX_BYTES = 8 * 1024 * 1024;
const REGISTRATION_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
};

/**
 * Attaches a photograph or the signed agreement to a registration.
 *
 * Not part of saving the form. These are files against a tenancy that already
 * exists — the storage path is keyed by tenancy id, so there has to be one
 * before anything can be filed under it, and an agent photographing a fob
 * should not have to re-submit twenty-five other fields to do it.
 *
 * The bucket policy is what actually decides who may write here; the checks
 * below are so an agent gets a sentence rather than a storage error.
 */
export async function attachTmsRegistrationFile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tenancyId = str(formData.get("tenancy_id"));
  const kind = str(formData.get("kind"));
  const cardId = str(formData.get("card_id"));
  const file = formData.get("file");

  if (!tenancyId) return { error: "Save the registration before attaching files." };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to attach." };
  }
  if (file.size > REGISTRATION_MAX_BYTES) {
    return { error: "That file is over 8MB. A photograph is enough." };
  }
  if (!REGISTRATION_TYPES.includes(file.type)) {
    return { error: "Upload a JPEG, PNG, WebP or PDF." };
  }

  const supabase = await createClient();

  // A random name, not the browser's: two cards photographed as "front.jpg"
  // must not collide, and a filename off a device is not something to build a
  // storage path out of.
  const path = `tms-registration/${tenancyId}/${crypto.randomUUID()}.${
    EXTENSION[file.type] ?? "jpg"
  }`;

  const uploaded = await supabase.storage
    .from("documents")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploaded.error) {
    return { error: "The file could not be uploaded. Try again." };
  }

  if (kind === "agreement") {
    const { error } = await supabase
      .from("tms_tenancies")
      .update({ agreement_path: path })
      .eq("id", tenancyId);
    if (error) return { error: describeTms(error.message) };
  } else if (kind === "inventory") {
    // Read then write, because the column is an array and this appends to it.
    // Two agents uploading at the same instant could lose one of the two
    // paths; the alternative is an array_append in SQL, which is worth doing
    // if inventory photographs ever stop being a one-agent-at-a-time job.
    const existing = await supabase
      .from("tms_tenancies")
      .select("inventory_paths")
      .eq("id", tenancyId)
      .single();
    if (existing.error) return { error: describeTms(existing.error.message) };

    const paths = [
      ...((existing.data?.inventory_paths as string[]) ?? []),
      path,
    ];
    const { error } = await supabase
      .from("tms_tenancies")
      .update({ inventory_paths: paths })
      .eq("id", tenancyId);
    if (error) return { error: describeTms(error.message) };
  } else if (kind === "card_front" || kind === "card_back") {
    if (!cardId) return { error: "Save the card before attaching a photograph." };
    const column = kind === "card_front" ? "front_path" : "back_path";
    const { error } = await supabase
      .from("tms_access_cards")
      .update({ [column]: path })
      .eq("id", cardId);
    if (error) return { error: describeTms(error.message) };
  } else {
    return { error: "Unknown attachment." };
  }

  refresh();
  return { ok: true };
}

/**
 * A tenant declares payment for the months they picked.
 *
 * Every check that matters is in tms_submit_payment: that the charges are
 * theirs, still unpaid, and all on one tenancy. Repeating them here would be
 * two places to keep in step, and the database is the one that cannot be
 * bypassed.
 */
export async function submitTmsPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const chargeIds = formData.getAll("charge_ids").map(str).filter(Boolean);
  if (chargeIds.length === 0) {
    return { error: "Choose at least one month to pay for." };
  }

  const method = str(formData.get("method")) || "bank";
  let slipPath = "";

  if (method === "bank") {
    const uploaded = await uploadSlip(formData.get("slip") as File);
    if (uploaded.error) return { error: uploaded.error };
    slipPath = uploaded.path!;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tms_submit_payment", {
    p_charge_ids: chargeIds,
    p_method: method,
    p_slip_path: slipPath,
    p_notes: orNull(formData.get("notes")),
  });

  if (error) return { error: describeTmsPayment(error.message) };
  refresh();
  return { ok: true, reference: data as string };
}

export async function submitTmsTopup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const deviceId = str(formData.get("device_id"));
  if (!deviceId) return { error: "Choose which meter to top up." };

  const amount = Number(str(formData.get("amount")).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount < 20 || amount > 100) {
    return { error: "Top up between RM20 and RM100." };
  }

  const method = str(formData.get("method")) || "bank";
  let slipPath = "";

  if (method === "bank") {
    const uploaded = await uploadSlip(formData.get("slip") as File);
    if (uploaded.error) return { error: uploaded.error };
    slipPath = uploaded.path!;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tms_submit_topup", {
    p_device_id: deviceId,
    p_amount: amount,
    p_method: method,
    p_slip_path: slipPath,
    p_notes: orNull(formData.get("notes")),
  });

  if (error) return { error: describeTmsPayment(error.message) };
  refresh();
  return { ok: true, reference: data as string };
}

/** Agent-only. The function refuses anyone else, so there is no check here. */
export async function verifyTmsPayment(
  submissionId: string,
  approve: boolean,
  reason = "",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("tms_verify_payment", {
    p_submission_id: submissionId,
    p_approve: approve,
    p_reason: reason,
  });
  if (error) return { error: describeTmsPayment(error.message) };
  refresh();
  return {};
}

export async function verifyTmsTopup(
  topupId: string,
  approve: boolean,
  reason = "",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("tms_verify_topup", {
    p_topup_id: topupId,
    p_approve: approve,
    p_reason: reason,
  });
  if (error) return { error: describeTmsPayment(error.message) };
  refresh();
  return {};
}

/* -------------------------------------------------------------------------- */
/* Online payments                                                             */
/* -------------------------------------------------------------------------- */

export interface GatewayFormState extends FormState {
  /**
   * Where the tenant goes next. The view navigates rather than the action
   * redirecting: a redirect would leave with the reference unshown, and the
   * reference is what they quote if the payment page misbehaves.
   */
  checkoutUrl?: string;
}

const ONLINE_UNAVAILABLE =
  "Online payment is not available yet. Pay by bank transfer instead.";

/**
 * A tenant pays the months they picked through the gateway.
 *
 * tms_create_gateway_payment holds the months and says what they add up to;
 * the amount sent to the gateway is that figure, never the browser's.
 * openCheckout withdraws the row again if the gateway will not open a page,
 * so a failure here leaves nothing held.
 */
export async function startTmsGatewayPayment(
  _prev: GatewayFormState,
  formData: FormData,
): Promise<GatewayFormState> {
  if (!gatewayConfigured()) return { error: ONLINE_UNAVAILABLE };

  const chargeIds = formData.getAll("charge_ids").map(str).filter(Boolean);
  if (chargeIds.length === 0) {
    return { error: "Choose at least one month to pay for." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tms_create_gateway_payment", {
    p_charge_ids: chargeIds,
    p_provider: PROVIDER,
    p_notes: orNull(formData.get("notes")),
  });
  if (error) return { error: describeTmsPayment(error.message) };

  const created = data as { id: string; reference: string; amount: number };
  try {
    const { checkoutUrl } = await openCheckout(
      { kind: "payment", ...created, amount: Number(created.amount) },
      `Room rental — ${created.reference}`,
    );
    refresh();
    return { ok: true, reference: created.reference, checkoutUrl };
  } catch (cause) {
    refresh();
    return { error: describeGateway(cause) };
  }
}

export async function startTmsGatewayTopup(
  _prev: GatewayFormState,
  formData: FormData,
): Promise<GatewayFormState> {
  if (!gatewayConfigured()) return { error: ONLINE_UNAVAILABLE };

  const deviceId = str(formData.get("device_id"));
  if (!deviceId) return { error: "Choose which meter to top up." };

  const amount = Number(str(formData.get("amount")).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount < 20 || amount > 100) {
    return { error: "Top up between RM20 and RM100." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tms_create_gateway_topup", {
    p_device_id: deviceId,
    p_amount: amount,
    p_provider: PROVIDER,
    p_notes: orNull(formData.get("notes")),
  });
  if (error) return { error: describeTmsPayment(error.message) };

  const created = data as { id: string; reference: string; amount: number };
  try {
    const { checkoutUrl } = await openCheckout(
      { kind: "topup", ...created, amount: Number(created.amount) },
      `Smartmeter topup — ${created.reference}`,
    );
    refresh();
    return { ok: true, reference: created.reference, checkoutUrl };
  } catch (cause) {
    refresh();
    return { error: describeGateway(cause) };
  }
}

/**
 * The attempt as the caller may see it. Read with their own client, so RLS
 * answers the question this action would otherwise have to: a tenant reaches
 * their own attempts, an agent everybody's, and nobody else's exists.
 */
async function visibleAttempt(
  kind: TmsGatewayKind,
  id: string,
): Promise<GatewayAttempt | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(kind === "payment" ? "tms_payment_submissions" : "tms_meter_topups")
    .select(
      "id, reference, amount, provider, provider_reference, status, method, checkout_expires_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data || data.method !== "gateway") return null;
  return {
    kind,
    id: String(data.id),
    reference: String(data.reference),
    amount: Number(data.amount),
    provider: data.provider,
    providerReference: String(data.provider_reference ?? ""),
    status: data.status as TmsSubmissionStatus,
    checkoutExpiresAt: data.checkout_expires_at
      ? String(data.checkout_expires_at)
      : null,
  };
}

/** Ask the gateway what became of an attempt. Tenant or agent. */
export async function checkTmsGatewayAttempt(
  kind: TmsGatewayKind,
  id: string,
): Promise<{ error?: string; outcome?: string }> {
  const attempt = await visibleAttempt(kind, id);
  if (!attempt) return { error: "No such online payment." };
  if (attempt.status !== "submitted") {
    refresh();
    return { outcome: attempt.status };
  }

  try {
    const { outcome } = await reconcileAttempt(attempt, "poll");
    refresh();
    return { outcome };
  } catch (cause) {
    return { error: describeGateway(cause) };
  }
}

/** Close an unpaid attempt and free what it held. Tenant or agent. */
export async function withdrawTmsGatewayAttempt(
  kind: TmsGatewayKind,
  id: string,
): Promise<{ error?: string }> {
  const attempt = await visibleAttempt(kind, id);
  if (!attempt) return { error: "No such online payment." };

  const profile = await getCurrentProfile();
  const agent =
    profile?.role === "super_admin" ||
    (profile?.role === "tms" &&
      (profile.businessLine === null || profile.businessLine === "agent"));

  const result = await withdrawAttempt(
    attempt,
    agent ? "agent" : "tenant",
    agent ? "Withdrawn by the office." : "Withdrawn before paying.",
  );
  refresh();
  return result.ok ? {} : { error: result.error };
}

function describeGateway(cause: unknown): string {
  if (cause instanceof GatewayError) {
    if (cause.code === "NOT_CONFIGURED") return ONLINE_UNAVAILABLE;
    if (cause.code === "NETWORK") {
      return "The payment gateway could not be reached. Try again in a moment.";
    }
    return `The payment gateway refused: ${cause.message}`;
  }
  return cause instanceof Error
    ? describeTmsPayment(cause.message)
    : "That could not be started.";
}

/**
 * The RPCs raise in plain English already, so this mostly passes them through.
 * What it catches is the constraint names, which do not read as sentences and
 * would otherwise reach a tenant as `tms_submission_bank_has_slip`.
 */
function describeTmsPayment(message: string): string {
  if (message.includes("tms_submission_bank_has_slip"))
    return "A bank transfer needs the payment slip attached.";
  if (message.includes("tms_topup_bank_has_slip"))
    return "A bank transfer needs the payment slip attached.";
  if (message.includes("tms_meter_topups_amount_check"))
    return "Top up between RM20 and RM100.";
  if (message.includes("_provider_reference_idx"))
    return "That gateway transaction is already recorded.";
  if (message.includes("_reference_key"))
    return "That reference already exists. Try submitting again.";
  if (message.includes("row-level security"))
    return "This account is not allowed to do that.";
  // A raise from one of the functions: already written for a person.
  return message.replace(/^.*?:\s*/, "") || "That could not be saved.";
}
