import "server-only";

import { createClient } from "./supabase/server";
import type {
  DocumentRef,
  TmsAccessCard,
  TmsCarpark,
  TmsExpense,
  TmsLandlord,
  TmsMeterReading,
  TmsProperty,
  TmsRentCharge,
  TmsPaymentSubmission,
  TmsMeterTopup,
  TmsGatewayEvent,
  TmsMeter,
  TmsRoom,
  TmsTenancy,
  TmsUnit,
  UserProfile,
} from "./types";

/**
 * Everything the dashboard renders, fetched in one pass.
 *
 * Row level security does the filtering: a CIO's queries simply return no rows
 * for the modules they are not scoped to, so the arrays arrive already
 * restricted without the app asking for anything special.
 */
export interface DashboardData {
  /** Tenant Management System. */
  landlords: TmsLandlord[];
  properties: TmsProperty[];
  units: TmsUnit[];
  rooms: TmsRoom[];
  carparks: TmsCarpark[];
  accessCards: TmsAccessCard[];
  tenancies: TmsTenancy[];
  charges: TmsRentCharge[];
  expenses: TmsExpense[];
  readings: TmsMeterReading[];
  /** Tenant-declared payments awaiting or past verification. */
  submissions: TmsPaymentSubmission[];
  topups: TmsMeterTopup[];
  /** What the gateway reported, newest first. Agent-only; empty otherwise. */
  gatewayEvents: TmsGatewayEvent[];
  /** Only ever the caller's own meters — see tms_my_meters(). */
  meters: TmsMeter[];
}

export const EMPTY_DATA: DashboardData = {
  landlords: [],
  properties: [],
  units: [],
  rooms: [],
  carparks: [],
  accessCards: [],
  tenancies: [],
  charges: [],
  expenses: [],
  readings: [],
  submissions: [],
  topups: [],
  gatewayEvents: [],
  meters: [],
};

/* -------------------------------------------------------------------------- */
/* Row shapes as they come back from Postgres                                  */
/* -------------------------------------------------------------------------- */

type DocumentRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  name: string;
  category: string;
  storage_path: string;
  mime_type: string;
  size_kb: number;
  uploaded_at: string;
};

/** Signed URLs are short-lived; one hour comfortably covers a working session. */
const SIGNED_URL_TTL = 3600;

/**
 * A path beginning with "/" is a bundled sample file served by the app.
 * Anything else is an object in the private bucket and needs a signed URL.
 */
function isBundledSample(path: string): boolean {
  return path.startsWith("/");
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const [
    tmsLandlords,
    tmsProperties,
    tmsUnits,
    tmsRooms,
    tmsCarparks,
    tmsAccessCards,
    tmsTenancies,
    tmsCharges,
    tmsExpenses,
    tmsReadings,
    tmsSubmissions,
    tmsTopups,
    tmsMeters,
    tmsGatewayEvents,
    documents,
  ] = await Promise.all([
    supabase.from("tms_landlords").select("*").order("landlord_name"),
    supabase.from("tms_properties").select("*").order("property_name"),
    supabase.from("tms_units").select("*").order("unit_number"),
    supabase.from("tms_rooms").select("*").order("room_code"),
    supabase.from("tms_carparks").select("*").order("bay_label"),
    supabase.from("tms_access_cards").select("*").order("key_no"),
    supabase.from("tms_tenancies").select("*").order("room_code"),
    supabase.from("tms_rent_charges").select("*").order("period_month"),
    supabase.from("tms_expenses").select("*").order("incurred_on"),
    supabase.from("tms_meter_readings").select("*").order("period_month"),
    supabase
      .from("tms_payment_submissions")
      .select("*, tms_payment_submission_charges(charge_id)")
      .order("submitted_at", { ascending: false }),
    supabase.from("tms_meter_topups").select("*").order("submitted_at", { ascending: false }),
    // A function rather than a table: tms_devices stays agent-only so the
    // meter's key_hash is never in a row a tenant can read.
    supabase.rpc("tms_my_meters"),
    // The reconciliation trail. RLS hands a tenant nothing; an agent gets
    // the recent hundred, which is weeks of it.
    supabase
      .from("tms_gateway_events")
      .select("id, provider, event_id, source, outcome, submission_id, topup_id, received_at")
      .order("received_at", { ascending: false })
      .limit(100),
    supabase.from("documents").select("*").order("uploaded_at"),
  ]);

  const docs = await buildDocumentIndex(
    (documents.data ?? []) as DocumentRow[],
    supabase,
  );

  const slips = await signSlips(
    [
      ...(tmsSubmissions.data ?? []).map((r) => (r.slip_path as string) ?? ""),
      ...(tmsTopups.data ?? []).map((r) => (r.slip_path as string) ?? ""),
    ],
    supabase,
  );

  return {
    landlords: (tmsLandlords.data ?? []).map((row) => mapLandlord(row, docs)),
    properties: (tmsProperties.data ?? []).map((row) => mapProperty(row, docs)),
    units: (tmsUnits.data ?? []).map((row) => mapUnit(row, docs)),
    rooms: (tmsRooms.data ?? []).map(mapRoom),
    carparks: (tmsCarparks.data ?? []).map(mapCarpark),
    accessCards: (tmsAccessCards.data ?? []).map(mapAccessCard),
    tenancies: (tmsTenancies.data ?? []).map((row) => mapTenancy(row, docs)),
    charges: (tmsCharges.data ?? []).map((row) => mapCharge(row, docs)),
    expenses: (tmsExpenses.data ?? []).map((row) => mapExpense(row, docs)),
    readings: (tmsReadings.data ?? []).map((row) => mapMeterReading(row, docs)),
    submissions: (tmsSubmissions.data ?? []).map((row) =>
      mapSubmission(row, slips),
    ),
    topups: (tmsTopups.data ?? []).map((row) => mapTopup(row, slips)),
    gatewayEvents: (tmsGatewayEvents.data ?? []).map(mapGatewayEvent),
    meters: (tmsMeters.data ?? []).map(mapMeter),
  };
}

/**
 * Payment slips live at tms-slips/<uid>/… rather than in the documents table,
 * so buildDocumentIndex never sees them and they need signing separately.
 *
 * A path that comes back unsigned is dropped to "" rather than rendered as a
 * broken link: storage refused it, which for an agent means the slip is gone
 * and for a tenant means it was never theirs.
 */
async function signSlips(
  paths: string[],
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter(Boolean))];
  if (wanted.length === 0) return new Map();

  const { data } = await supabase.storage
    .from("documents")
    .createSignedUrls(wanted, SIGNED_URL_TTL);

  const signed = new Map<string, string>();
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) signed.set(entry.path, entry.signedUrl);
  }
  return signed;
}

function mapSubmission(
  row: Record<string, unknown>,
  slips: Map<string, string>,
): TmsPaymentSubmission {
  const slipPath = (row.slip_path as string) ?? "";
  const links =
    (row.tms_payment_submission_charges as { charge_id: string }[] | null) ?? [];
  return {
    id: row.id as string,
    tenancyId: row.tenancy_id as string,
    propertyName: (row.property_name as string) ?? "",
    roomCode: (row.room_code as string) ?? "",
    tenantName: (row.tenant_name as string) ?? "",
    reference: (row.reference as string) ?? "",
    amount: n(row.amount),
    method: row.method as TmsPaymentSubmission["method"],
    status: row.status as TmsPaymentSubmission["status"],
    slipPath,
    slipUrl: slips.get(slipPath) ?? "",
    provider: (row.provider as TmsPaymentSubmission["provider"]) ?? "",
    providerReference: (row.provider_reference as string) ?? "",
    checkoutUrl: (row.checkout_url as string) ?? "",
    checkoutExpiresAt: (row.checkout_expires_at as string) ?? null,
    verifiedVia: (row.verified_via as TmsPaymentSubmission["verifiedVia"]) ?? "",
    submittedAt: row.submitted_at as string,
    verifiedAt: (row.verified_at as string) ?? null,
    rejectReason: (row.reject_reason as string) ?? "",
    chargeIds: links.map((l) => l.charge_id),
    notes: (row.notes as string) ?? undefined,
  };
}

function mapTopup(
  row: Record<string, unknown>,
  slips: Map<string, string>,
): TmsMeterTopup {
  const slipPath = (row.slip_path as string) ?? "";
  return {
    id: row.id as string,
    deviceId: row.device_id as string,
    tenancyId: row.tenancy_id as string,
    meterLabel: (row.meter_label as string) ?? "",
    propertyName: (row.property_name as string) ?? "",
    roomCode: (row.room_code as string) ?? "",
    tenantName: (row.tenant_name as string) ?? "",
    reference: (row.reference as string) ?? "",
    amount: n(row.amount),
    method: row.method as TmsMeterTopup["method"],
    status: row.status as TmsMeterTopup["status"],
    slipPath,
    slipUrl: slips.get(slipPath) ?? "",
    provider: (row.provider as TmsPaymentSubmission["provider"]) ?? "",
    providerReference: (row.provider_reference as string) ?? "",
    checkoutUrl: (row.checkout_url as string) ?? "",
    checkoutExpiresAt: (row.checkout_expires_at as string) ?? null,
    verifiedVia: (row.verified_via as TmsPaymentSubmission["verifiedVia"]) ?? "",
    balanceAfter: row.balance_after == null ? null : n(row.balance_after),
    submittedAt: row.submitted_at as string,
    verifiedAt: (row.verified_at as string) ?? null,
    rejectReason: (row.reject_reason as string) ?? "",
    notes: (row.notes as string) ?? undefined,
  };
}

function mapGatewayEvent(row: Record<string, unknown>): TmsGatewayEvent {
  return {
    id: row.id as string,
    provider: row.provider as TmsGatewayEvent["provider"],
    eventId: (row.event_id as string) ?? "",
    source: row.source as TmsGatewayEvent["source"],
    outcome: (row.outcome as TmsGatewayEvent["outcome"]) ?? "",
    submissionId: (row.submission_id as string) ?? null,
    topupId: (row.topup_id as string) ?? null,
    receivedAt: row.received_at as string,
  };
}

function mapMeter(row: Record<string, unknown>): TmsMeter {
  return {
    id: row.id as string,
    deviceId: (row.device_id as string) ?? "",
    label: (row.label as string) ?? "",
    utility: row.utility as TmsMeter["utility"],
    billingMode: row.billing_mode as TmsMeter["billingMode"],
    balance: n(row.balance),
    lowBalanceThreshold: n(row.low_balance_threshold),
    lastSeenAt: (row.last_seen_at as string) ?? null,
  };
}

/** Groups documents by their owning record, resolving storage URLs in bulk. */
async function buildDocumentIndex(
  rows: DocumentRow[],
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, DocumentRef[]>> {
  const stored = rows.filter((r) => !isBundledSample(r.storage_path));
  const signed = new Map<string, string>();

  if (stored.length > 0) {
    const paths = [...new Set(stored.map((r) => r.storage_path))];
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrls(paths, SIGNED_URL_TTL);

    for (const entry of data ?? []) {
      if (entry.signedUrl && entry.path) signed.set(entry.path, entry.signedUrl);
    }
  }

  const index = new Map<string, DocumentRef[]>();
  for (const row of rows) {
    const url = isBundledSample(row.storage_path)
      ? row.storage_path
      : (signed.get(row.storage_path) ?? "");

    // A stored file with no signed URL means storage denied access; skip it
    // rather than rendering a preview button that cannot open.
    if (!url) continue;

    const list = index.get(row.entity_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      category: row.category as DocumentRef["category"],
      url,
      mimeType: row.mime_type as DocumentRef["mimeType"],
      sizeKb: row.size_kb,
      uploadedAt: row.uploaded_at,
    });
    index.set(row.entity_id, list);
  }
  return index;
}

/* -------------------------------------------------------------------------- */
/* Row → domain mappers                                                        */
/* -------------------------------------------------------------------------- */

const n = (value: unknown): number => Number(value ?? 0);



















/* -------------------------------------------------------------------------- */
/* Tenant Management System                                                    */
/* -------------------------------------------------------------------------- */
/* The denormalised names on these rows are filled by trigger and always track
 * the parent, so they are read straight through rather than resolved here. */

function mapLandlord(
  row: Record<string, unknown>,
  docs: Map<string, DocumentRef[]>,
): TmsLandlord {
  const id = row.id as string;
  return {
    id,
    landlordName: row.landlord_name as string,
    companyName: (row.company_name as string) ?? "",
    phone: (row.phone as string) ?? "",
    email: (row.email as string) ?? "",
    idNumber: (row.id_number as string) ?? "",
    bankName: (row.bank_name as string) ?? "",
    bankAccount: (row.bank_account as string) ?? "",
    loginEmail: (row.login_email as string) ?? "",
    documents: docs.get(id) ?? [],
    notes: (row.notes as string) ?? undefined,
  };
}

function mapProperty(
  row: Record<string, unknown>,
  docs: Map<string, DocumentRef[]>,
): TmsProperty {
  const id = row.id as string;
  return {
    id,
    propertyName: row.property_name as string,
    propertyCode: (row.property_code as string) ?? "",
    address: (row.address as string) ?? "",
    city: (row.city as string) ?? "",
    state: (row.state as string) ?? "",
    propertyType: row.property_type as TmsProperty["propertyType"],
    documents: docs.get(id) ?? [],
    notes: (row.notes as string) ?? undefined,
  };
}

function mapUnit(
  row: Record<string, unknown>,
  docs: Map<string, DocumentRef[]>,
): TmsUnit {
  const id = row.id as string;
  return {
    id,
    propertyId: row.property_id as string,
    propertyName: (row.property_name as string) ?? "",
    propertyCode: (row.property_code as string) ?? "",
    landlordId: (row.landlord_id as string) ?? null,
    landlordName: (row.landlord_name as string) ?? "",
    unitNumber: row.unit_number as string,
    floorLabel: (row.floor_label as string) ?? "",
    masterRent: n(row.master_rent),
    leaseStartAt: (row.lease_start_at as string) ?? null,
    leaseEndAt: (row.lease_end_at as string) ?? null,
    status: row.status as TmsUnit["status"],
    documents: docs.get(id) ?? [],
    notes: (row.notes as string) ?? undefined,
  };
}

function mapRoom(row: Record<string, unknown>): TmsRoom {
  return {
    id: row.id as string,
    unitId: row.unit_id as string,
    propertyId: (row.property_id as string) ?? "",
    propertyName: (row.property_name as string) ?? "",
    unitNumber: (row.unit_number as string) ?? "",
    roomLabel: row.room_label as string,
    roomCode: (row.room_code as string) ?? "",
    roomType: row.room_type as TmsRoom["roomType"],
    marketRent: n(row.market_rent),
    hasAircon: Boolean(row.has_aircon),
    hasBathroom: Boolean(row.has_bathroom),
    active: Boolean(row.active),
    notes: (row.notes as string) ?? undefined,
  };
}

function mapCarpark(row: Record<string, unknown>): TmsCarpark {
  return {
    id: row.id as string,
    unitId: row.unit_id as string,
    propertyId: (row.property_id as string) ?? "",
    propertyName: (row.property_name as string) ?? "",
    unitNumber: (row.unit_number as string) ?? "",
    bayLabel: row.bay_label as string,
    monthlyFee: n(row.monthly_fee),
    tenancyId: (row.tenancy_id as string) ?? null,
    tenantName: (row.tenant_name as string) ?? "",
    active: Boolean(row.active),
    notes: (row.notes as string) ?? undefined,
  };
}

function mapAccessCard(row: Record<string, unknown>): TmsAccessCard {
  return {
    id: row.id as string,
    tenancyId: row.tenancy_id as string,
    cardLabel: (row.card_label as string) ?? "",
    keyNo: (row.key_no as string) ?? "",
    frontPath: (row.front_path as string) ?? "",
    backPath: (row.back_path as string) ?? "",
    notes: (row.notes as string) ?? undefined,
  };
}

function mapTenancy(
  row: Record<string, unknown>,
  docs: Map<string, DocumentRef[]>,
): TmsTenancy {
  const id = row.id as string;
  return {
    id,
    roomId: row.room_id as string,
    unitId: (row.unit_id as string) ?? "",
    propertyId: (row.property_id as string) ?? "",
    propertyName: (row.property_name as string) ?? "",
    unitNumber: (row.unit_number as string) ?? "",
    roomLabel: (row.room_label as string) ?? "",
    roomCode: (row.room_code as string) ?? "",
    tenantName: row.tenant_name as string,
    phone: (row.phone as string) ?? "",
    email: (row.email as string) ?? "",
    idNumber: (row.id_number as string) ?? "",
    status: row.status as TmsTenancy["status"],
    monthlyRent: n(row.monthly_rent),
    deposit: n(row.deposit),
    advanceRent: n(row.advance_rent),
    rentDueDay: n(row.rent_due_day) || 1,
    movedInAt: (row.moved_in_at as string) ?? null,
    movedOutAt: (row.moved_out_at as string) ?? null,
    loginEmail: (row.login_email as string) ?? "",

    serialNo: (row.serial_no as string) ?? "",
    registeredAt: (row.registered_at as string) ?? "",
    agentId: (row.agent_id as string) ?? null,
    agentName: (row.agent_name as string) ?? "",

    nickname: (row.nickname as string) ?? "",
    gender: (row.gender as TmsTenancy["gender"]) ?? "",
    nationality: (row.nationality as string) ?? "",

    ecName: (row.ec_name as string) ?? "",
    ecPhone: (row.ec_phone as string) ?? "",
    ecRelationship: (row.ec_relationship as string) ?? "",

    smartMeterId: (row.smart_meter_id as string) ?? "",
    // Null and zero mean different things — no term set, versus a term shorter
    // than a month — so this must not fall through n().
    tenancyMonths:
      row.tenancy_months === null || row.tenancy_months === undefined
        ? null
        : Number(row.tenancy_months),

    keyIssued: Boolean(row.key_issued),
    parkingIncluded: Boolean(row.parking_included),
    renewalMonths: n(row.renewal_months),
    inventoryPaths: (row.inventory_paths as string[]) ?? [],

    monthlyRentWords: (row.monthly_rent_words as string) ?? "",
    proRate: n(row.pro_rate),
    proRateWords: (row.pro_rate_words as string) ?? "",
    securityDeposit: n(row.security_deposit),
    securityDepositWords: (row.security_deposit_words as string) ?? "",
    utilityDeposit: n(row.utility_deposit),
    utilityDepositWords: (row.utility_deposit_words as string) ?? "",
    accessKeyDeposit: n(row.access_key_deposit),
    accessKeyCount: n(row.access_key_count),
    agreementFee: n(row.agreement_fee),

    agreementPath: (row.agreement_path as string) ?? "",

    documents: docs.get(id) ?? [],
    notes: (row.notes as string) ?? undefined,
  };
}

function mapCharge(
  row: Record<string, unknown>,
  docs: Map<string, DocumentRef[]>,
): TmsRentCharge {
  const id = row.id as string;
  return {
    id,
    tenancyId: row.tenancy_id as string,
    propertyId: (row.property_id as string) ?? "",
    propertyName: (row.property_name as string) ?? "",
    roomCode: (row.room_code as string) ?? "",
    tenantName: (row.tenant_name as string) ?? "",
    periodMonth: row.period_month as string,
    kind: row.kind as TmsRentCharge["kind"],
    description: (row.description as string) ?? "",
    amount: n(row.amount),
    status: row.status as TmsRentCharge["status"],
    dueAt: row.due_at as string,
    paidAt: (row.paid_at as string) ?? null,
    method: (row.method as TmsRentCharge["method"]) ?? "",
    reference: (row.reference as string) ?? "",
    documents: docs.get(id) ?? [],
    notes: (row.notes as string) ?? undefined,
  };
}

function mapExpense(
  row: Record<string, unknown>,
  docs: Map<string, DocumentRef[]>,
): TmsExpense {
  const id = row.id as string;
  return {
    id,
    propertyId: row.property_id as string,
    unitId: (row.unit_id as string) ?? null,
    tenancyId: (row.tenancy_id as string) ?? null,
    propertyName: (row.property_name as string) ?? "",
    unitNumber: (row.unit_number as string) ?? "",
    tenantName: (row.tenant_name as string) ?? "",
    category: row.category as TmsExpense["category"],
    description: (row.description as string) ?? "",
    amount: n(row.amount),
    incurredOn: row.incurred_on as string,
    paidAt: (row.paid_at as string) ?? null,
    billableToTenant: Boolean(row.billable_to_tenant),
    rechargedAt: (row.recharged_at as string) ?? null,
    documents: docs.get(id) ?? [],
    notes: (row.notes as string) ?? undefined,
  };
}

function mapMeterReading(
  row: Record<string, unknown>,
  docs: Map<string, DocumentRef[]>,
): TmsMeterReading {
  const id = row.id as string;
  return {
    id,
    unitId: row.unit_id as string,
    roomId: (row.room_id as string) ?? null,
    propertyId: (row.property_id as string) ?? "",
    propertyName: (row.property_name as string) ?? "",
    unitNumber: (row.unit_number as string) ?? "",
    roomCode: (row.room_code as string) ?? "",
    utility: row.utility as TmsMeterReading["utility"],
    periodMonth: row.period_month as string,
    previousReading: n(row.previous_reading),
    currentReading: n(row.current_reading),
    ratePerUnit: n(row.rate_per_unit),
    usageUnits: n(row.usage_units),
    amount: n(row.amount),
    source: row.source as TmsMeterReading["source"],
    deviceId: (row.device_id as string) ?? "",
    documents: docs.get(id) ?? [],
    notes: (row.notes as string) ?? undefined,
  };
}


/* -------------------------------------------------------------------------- */
/* Signed-in user                                                              */
/* -------------------------------------------------------------------------- */

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Deliberately `*` rather than a column list: naming a column explicitly
  // makes the whole query fail with 42703 on a database where that column does
  // not exist yet, which returns a null profile and locks everyone out. With
  // `*` a missing column is simply absent and the value falls back to null.
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    role: data.role,
    businessLine: data.business_line ?? null,
    // ?? false for the same reason the select is `*`: on a database without
    // the column yet, absent must mean "no", not a crash.
    canIssueInvoices: data.can_issue_invoices ?? false,
  };
}
