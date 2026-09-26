/**
 * Domain types for MCN Asset HQ.
 *
 * These shapes are deliberately close to the Phase 2 Supabase tables so the
 * migration from mock data to the database is a swap of the data source only —
 * nothing in `metrics.ts` or the components should need to change.
 */

/**
 * `pending` is the default for a newly created account: the person can sign in
 * but sees nothing until the super admin assigns them a scope.
 */
/**
 * `mdna` and `mec` are divisions, not job descriptions. A person holding one
 * sees that division; `businessLine` optionally narrows them to a single line
 * inside it.
 */
export type Role =
  | "super_admin"
  | "mdna"
  | "mec"
  | "micana"
  | "tms"
  | "pending";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super admin",
  mdna: "MDNA",
  mec: "MEC",
  micana: "Micana",
  tms: "TMS",
  pending: "Pending",
};

/**
 * The scopes a CIO can hold. Four are business lines; `commissions` is the
 * introducer payment run, which sees the commission ledger only.
 */
export type ModuleKey =
  | "factory"
  | "mdna"
  | "nasdaq"
  | "commissions"
  | "mec"
  | "micana"
  | "tms";

/**
 * A role *within* a module. It decides which dashboard renders and nothing
 * else — access is `private.can_access()` in Postgres, which never reads this.
 * Null means the standard module view.
 */
/**
 * A business line nests inside a division role. Null means the whole
 * division — which is what an MDNA admin holds.
 *
 * For MDNA the line narrows which records are visible. For MEC it selects
 * which dashboard renders: the three desks collaborate on the same records,
 * so restricting rows between them would break the handoffs.
 */
export type MdnaLine = "mdna" | "factory" | "nasdaq" | "commissions";

export type MecLine =
  | "strategic_partnership"
  | "operations_manager"
  | "operations_executive";

/**
 * Micana's three. Like MEC's, these select the dashboard rather than the rows:
 * a profile on `tenant` reads every tenancy, not only its own. Per-person
 * visibility would need profiles linked to micana_tenants and micana_bungalows.
 */
export type MicanaLine = "tenant" | "owner" | "operator";

/**
 * TMS's three. `tms_landlord` and `tms_tenant` rather than plain `landlord`
 * and `tenant`: business_line is a single column shared by every division, and
 * a bare `tenant` would be ambiguous the moment anyone holds both roles. The
 * database CHECK spells them the same way.
 */
export type TmsLine = "agent" | "tms_landlord" | "tms_tenant";

export type BusinessLine = MdnaLine | MecLine | MicanaLine | TmsLine;

export const BUSINESS_LINE_LABELS: Record<BusinessLine, string> = {
  mdna: "MDNA Senior Co-Living",
  factory: "Factory Cosif",
  nasdaq: "Nasdaq M&A",
  commissions: "Commissions",
  strategic_partnership: "Strategic Partnership",
  operations_manager: "MEC Operation Manager",
  operations_executive: "MEC Operation Executive",
  tenant: "Micana Tenant",
  owner: "Micana Owner",
  operator: "Micana Operator",
  agent: "TMS Agent",
  tms_landlord: "TMS Landlord",
  tms_tenant: "TMS Tenant",
};

/** Which lines belong to which division role. */
export const LINES_BY_ROLE: Record<
  "mdna" | "mec" | "micana" | "tms",
  BusinessLine[]
> =
  {
    mdna: ["mdna", "factory", "nasdaq", "commissions"],
    mec: [
      "strategic_partnership",
      "operations_manager",
      "operations_executive",
    ],
    micana: ["tenant", "owner", "operator"],
    tms: ["agent", "tms_landlord", "tms_tenant"],
  };

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  /** null = the whole division. Only ever set when role is mdna or mec. */
  businessLine: BusinessLine | null;
  /**
   * The invoice generator, and nothing else. Neither a role nor a business
   * line: raising an invoice for a legal entity is not the same as working in
   * a module. Super admin has it implicitly.
   */
  canIssueInvoices: boolean;
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

export type DocumentCategory =
  | "Official Letter"
  | "Agreement"
  | "Bank Slip"
  | "Company Profile"
  | "Financial Statement"
  | "Identity";

export interface DocumentRef {
  id: string;
  name: string;
  category: DocumentCategory;
  /** Phase 1: a file in /public. Phase 2: a signed Supabase Storage URL. */
  url: string;
  mimeType: "application/pdf" | "image/png" | "image/jpeg";
  sizeKb: number;
  uploadedAt: string; // ISO date
}

/* -------------------------------------------------------------------------- */
/* Factory Cosif                                                               */
/* -------------------------------------------------------------------------- */


/* -------------------------------------------------------------------------- */
/* MDNA Admin (co-living)                                                       */
/* -------------------------------------------------------------------------- */

export type MdnaStatus =
  | "prospect"  // In discussion, nothing signed
  | "signed"    // Package agreement signed
  | "paid"      // RM500k package paid in full
  | "invested"; // RM50k landed in MCN Asset HQ


/* -------------------------------------------------------------------------- */
/* Nasdaq listing M&A                                                          */
/* -------------------------------------------------------------------------- */

export type NasdaqStatus =
  | "in_discussion"
  | "loi_signed"
  | "due_diligence"
  | "agreed"
  | "onboarded";


/* -------------------------------------------------------------------------- */
/* MEC Asset (HR) — revenue, deliberately separate from the RM20M raise        */
/* -------------------------------------------------------------------------- */

/** The eight annual revenue streams. Five external, three internal. */
export type MecStreamKey =
  | "cec_ticketing"
  | "corporate_sponsor"
  | "subscription"
  | "advisory"
  | "training"
  | "esos"
  | "outsource"
  | "payroll";

export type MecStreamGroup = "external" | "internal";

/**
 * Received ⊆ Invoiced ⊆ Contracted — the same nesting Factory and MDNA use.
 * `enquiry` is pipeline only and `lost` is excluded from every figure.
 */
export type MecRecordStatus =
  | "enquiry"     // In discussion, nothing booked
  | "contracted"  // Booked or signed, not yet billed
  | "invoiced"    // Billed, awaiting payment
  | "received"    // Cash in MEC Asset's account
  | "lost";       // Dropped

/** Contract size band for a sponsorship deal. */
export type MecProjectTier = "tier_1" | "tier_2" | "tier_3";


/* -------------------------------------------------------------------------- */
/* MEC partnership desk — non-revenue trackers                                 */
/* -------------------------------------------------------------------------- */



/* -------------------------------------------------------------------------- */
/* MEC Lifestyle — operations desk                                             */
/* -------------------------------------------------------------------------- */


export type EventSupportStatus = "planning" | "on_ground" | "completed";






/* -------------------------------------------------------------------------- */
/* MEC Lifestyle — Ops Admin deliverables                                      */
/* -------------------------------------------------------------------------- */

export type DeliverableCategory =
  | "edm_landing"
  | "facebook_event"
  | "cec_profile"
  | "digital_access";


export type HandoffType = "media" | "cec" | "other";


/* -------------------------------------------------------------------------- */
/* Micana Innovation Co-Living & HealthTech                                    */
/* -------------------------------------------------------------------------- */


export type MicanaTenantStatus =
  | "enquiry"    // Viewing arranged, nothing signed
  | "reserved"   // Deposit taken, not yet moved in
  | "occupied"   // In residence and paying rent
  | "notice"     // Move-out date set — the room needs refilling
  | "moved_out"; // Room vacant





/* -------------------------------------------------------------------------- */
/* Tenant Management System                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The three-level hierarchy the portfolio actually has:
 *
 *   TmsProperty  ENESTA          the building
 *   TmsUnit      ENESTA 25-06    one leased apartment, and the landlord behind it
 *   TmsRoom      Room N          what a tenant rents
 *
 * `roomCode` is built in Postgres from all three, never typed, so it cannot
 * disagree with the record it names.
 */
export type TmsPropertyType =
  | "condominium"
  | "apartment"
  | "landed"
  | "commercial";

export interface TmsLandlord {
  id: string;
  landlordName: string;
  companyName: string;
  phone: string;
  email: string;
  /** NRIC or company registration number, whichever signed the lease. */
  idNumber: string;
  bankName: string;
  bankAccount: string;
  /** Address of the linked landlord login, or "" when nobody signs in. */
  loginEmail: string;
  documents: DocumentRef[];
  notes?: string;
}

export interface TmsProperty {
  id: string;
  propertyName: string;
  /** Short form the room codes are built from — ENESTA, MVERTICA. */
  propertyCode: string;
  address: string;
  city: string;
  state: string;
  propertyType: TmsPropertyType;
  documents: DocumentRef[];
  notes?: string;
}

export type TmsUnitStatus = "onboarding" | "active" | "ended";

export interface TmsUnit {
  id: string;
  propertyId: string;
  /** Denormalised in Postgres so the unit list stands alone. See lib/data.ts. */
  propertyName: string;
  propertyCode: string;
  landlordId: string | null;
  landlordName: string;
  unitNumber: string;
  floorLabel: string;
  /** What leaves the business each month under the master lease. */
  masterRent: number;
  leaseStartAt: string | null;
  leaseEndAt: string | null;
  status: TmsUnitStatus;
  documents: DocumentRef[];
  notes?: string;
}

export type TmsRoomType = "master" | "medium" | "single" | "study";

export interface TmsRoom {
  id: string;
  unitId: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  roomLabel: string;
  /** "ENESTA 25-06 Room N". Built by trigger from the chain above. */
  roomCode: string;
  roomType: TmsRoomType;
  marketRent: number;
  hasAircon: boolean;
  hasBathroom: boolean;
  /**
   * A room withdrawn from letting leaves the vacancy denominator rather than
   * sitting in it as permanently empty and dragging the percentage down.
   */
  active: boolean;
  notes?: string;
}

export interface TmsCarpark {
  id: string;
  unitId: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  bayLabel: string;
  /** Charged on top of rent. Zero means the bay is bundled into it. */
  monthlyFee: number;
  /** null is the "Not Assigned" slice on the dashboard. */
  tenancyId: string | null;
  tenantName: string;
  active: boolean;
  notes?: string;
}

/**
 * `reserved` is a deposit against a future move-in, so it holds the room but
 * is not yet billed. `notice` still occupies and still pays.
 */
export type TmsTenancyStatus =
  | "enquiry"
  | "reserved"
  | "active"
  | "notice"
  | "ended";

export interface TmsTenancy {
  id: string;
  roomId: string;
  unitId: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  roomLabel: string;
  roomCode: string;
  tenantName: string;
  phone: string;
  email: string;
  idNumber: string;
  status: TmsTenancyStatus;
  monthlyRent: number;
  deposit: number;
  advanceRent: number;
  /** Day of the month rent falls due. Drives due dates on generated charges. */
  rentDueDay: number;
  movedInAt: string | null;
  movedOutAt: string | null;
  /** Address of the linked tenant login, or "" when this tenancy has none. */
  loginEmail: string;

  /* ---- Booking registration ------------------------------------------- */
  /** Issued once by the database, never reissued on edit. "" on old rows. */
  serialNo: string;
  registeredAt: string;
  /** Who took the booking. "" when nobody was recorded. */
  agentId: string | null;
  agentName: string;

  nickname: string;
  gender: "" | "male" | "female";
  nationality: string;

  ecName: string;
  ecPhone: string;
  ecRelationship: string;

  smartMeterId: string;
  /** Whole months of the term, filled by trigger. Null without both dates. */
  tenancyMonths: number | null;

  keyIssued: boolean;
  /** Intent only — the bay itself lives in tms_carparks. */
  parkingIncluded: boolean;
  renewalMonths: number;
  /** Paths in the documents bucket. */
  inventoryPaths: string[];

  /**
   * Each figure carries the words that govern it, because a Malaysian tenancy
   * agreement states the sum both ways and the words win if they disagree.
   */
  monthlyRentWords: string;
  /** What the FIRST month is billed when it is not a whole one. */
  proRate: number;
  proRateWords: string;
  securityDeposit: number;
  securityDepositWords: string;
  utilityDeposit: number;
  utilityDepositWords: string;
  accessKeyDeposit: number;
  accessKeyCount: number;
  agreementFee: number;

  /** Path to the signed agreement in the documents bucket. */
  agreementPath: string;

  documents: DocumentRef[];
  notes?: string;
}

/** A card or fob issued to a tenancy. Several per tenancy is normal. */
export interface TmsAccessCard {
  id: string;
  tenancyId: string;
  cardLabel: string;
  keyNo: string;
  /** Photographs of each face, as paths in the documents bucket. */
  frontPath: string;
  backPath: string;
  notes?: string;
}

export type TmsChargeKind = "rent" | "carpark" | "utility" | "other";
/**
 * 'submitted' sits between the two: the tenant has declared payment and
 * uploaded a slip, and nobody has checked it yet. It is NOT a kind of paid —
 * everything that counts money treats it as still outstanding, because until
 * an agent has looked at the slip the only evidence is the tenant's word.
 */
export type TmsChargeStatus = "unpaid" | "submitted" | "paid";
export type TmsPaymentMethod = "" | "bank" | "cash" | "online";

/**
 * One thing a tenant owes in one month. Rent is one kind among several, which
 * is why a month's charge count runs ahead of the room count: a tenant with a
 * carpark and a utility recharge contributes three rows, not one.
 */
export interface TmsRentCharge {
  id: string;
  tenancyId: string;
  propertyId: string;
  propertyName: string;
  roomCode: string;
  tenantName: string;
  /** First of the month, YYYY-MM-01. */
  periodMonth: string;
  kind: TmsChargeKind;
  description: string;
  amount: number;
  status: TmsChargeStatus;
  dueAt: string;
  paidAt: string | null;
  method: TmsPaymentMethod;
  reference: string;
  documents: DocumentRef[];
  notes?: string;
}

export type TmsExpenseCategory =
  | "master_rent"
  | "maintenance"
  | "utilities"
  | "internet"
  | "cleaning"
  | "furnishing"
  | "management_fee"
  | "repairs"
  | "other";

/**
 * Both expense screens read this one shape. What separates them is `tenancyId`:
 * an expense pinned to a tenancy is that tenant's, and everything else is the
 * cost of running the unit.
 */
export interface TmsExpense {
  id: string;
  propertyId: string;
  unitId: string | null;
  tenancyId: string | null;
  propertyName: string;
  unitNumber: string;
  tenantName: string;
  category: TmsExpenseCategory;
  description: string;
  amount: number;
  incurredOn: string;
  paidAt: string | null;
  billableToTenant: boolean;
  /**
   * Set once a recharge has been raised. The recharge itself is a row in
   * `charges`, so the two can never be counted as separate costs.
   */
  rechargedAt: string | null;
  documents: DocumentRef[];
  notes?: string;
}

export type TmsUtility = "electricity" | "water" | "gas" | "aircon";

export interface TmsMeterReading {
  id: string;
  unitId: string;
  /** null for a whole-unit meter, which is the common case. */
  roomId: string | null;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  roomCode: string;
  utility: TmsUtility;
  periodMonth: string;
  previousReading: number;
  currentReading: number;
  ratePerUnit: number;
  /** Generated in Postgres: current − previous, floored at zero. */
  usageUnits: number;
  /** Generated in Postgres: usageUnits × ratePerUnit. */
  amount: number;
  source: "manual" | "iot";
  deviceId: string;
  documents: DocumentRef[];
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/* Introducer commissions                                                      */
/* -------------------------------------------------------------------------- */



/* -------------------------------------------------------------------------- */
/* Drill-down                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The normalised row shape rendered by `RecordsTable`. Every module maps its
 * own records into this so there is exactly one table implementation.
 */
export interface DrillRow {
  id: string;
  /** Company or individual name. */
  name: string;
  /** Secondary line under the name (contact person, referrer, sector…). */
  subtitle?: string;
  phone: string;
  amount: number;
  /** Label shown under the amount, e.g. "into HQ" or "PAT". */
  amountLabel?: string;
  statusLabel: string;
  statusTone: Tone;
  date: string | null;
  dateLabel?: string;
  documents: DocumentRef[];
  /** Rendered as a warning strip on the row, e.g. an overdue factory. */
  flag?: string;
}

export type Tone =
  | "received"
  | "committed"
  | "risk"
  | "stalled"
  | "idle"
  | "accent";

export interface DrillDownContent {
  title: string;
  subtitle?: string;
  /** Headline figure for the panel, already summed by metrics.ts. */
  total?: number;
  totalLabel?: string;
  rows: DrillRow[];
  /** Column header above the amount column, e.g. "Amount into HQ (RM)". */
  amountHeader?: string;
  /**
   * Set when the rows mix units (e.g. RM capital alongside RM profit-after-tax)
   * so the table does not print a sum that adds unlike things together.
   */
  hideTotal?: boolean;
  /**
   * Optional per-row button — "Edit" on a module page, "Mark paid" on the
   * commission ledger. Client-side only; never crosses the server boundary.
   */
  rowAction?: {
    label: (row: DrillRow) => string;
    run: (row: DrillRow) => void;
  };
}

/* -------------------------------------------------------------------------- */
/* Tenant-submitted payments                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A tenant's declaration that they have paid, or an attempt to pay online.
 *
 * `status` is the whole point of the type. 'submitted' means open — claimed
 * on a slip and waiting for an agent, or started at a gateway and waiting for
 * the gateway. 'verified' means settled: an agent agreed with the slip, or
 * the gateway reported the money. 'rejected' is an agent saying no.
 * 'expired' and 'cancelled' are an online attempt that closed unpaid; both
 * hand the months back, and neither is anybody's fault.
 */
export type TmsSubmissionStatus =
  | "submitted"
  | "verified"
  | "rejected"
  | "expired"
  | "cancelled";
export type TmsPayMethod = "bank" | "gateway";
export type TmsGatewayProvider = "xendit" | "billplz" | "payex";
/** Which table an online attempt lives in. */
export type TmsGatewayKind = "payment" | "topup";
/** Who settled the row. Empty while it is still 'submitted'. */
export type TmsVerifiedVia = "" | "agent" | "gateway" | "tenant" | "system";

export interface TmsPaymentSubmission {
  id: string;
  tenancyId: string;
  propertyName: string;
  roomCode: string;
  tenantName: string;
  /** What the tenant quotes on the transfer, and what the office searches by. */
  reference: string;
  amount: number;
  method: TmsPayMethod;
  status: TmsSubmissionStatus;
  /** Path in the documents bucket under tms-slips/<uid>/. Empty for a gateway. */
  slipPath: string;
  slipUrl: string;
  /** Which gateway, when method is 'gateway'. */
  provider: TmsGatewayProvider | "";
  /** The gateway's own id for the transaction. */
  providerReference: string;
  /** The hosted checkout, for a tenant coming back to finish paying. */
  checkoutUrl: string;
  checkoutExpiresAt: string | null;
  verifiedVia: TmsVerifiedVia;
  submittedAt: string;
  verifiedAt: string | null;
  /** Written for the tenant to read, not for the file. */
  rejectReason: string;
  /** Which charges this submission settles. */
  chargeIds: string[];
  notes?: string;
}

export interface TmsMeterTopup {
  id: string;
  deviceId: string;
  tenancyId: string;
  meterLabel: string;
  propertyName: string;
  roomCode: string;
  tenantName: string;
  reference: string;
  amount: number;
  method: TmsPayMethod;
  status: TmsSubmissionStatus;
  slipPath: string;
  slipUrl: string;
  provider: TmsGatewayProvider | "";
  providerReference: string;
  checkoutUrl: string;
  checkoutExpiresAt: string | null;
  verifiedVia: TmsVerifiedVia;
  /** Snapshotted on verification, so an old receipt keeps saying what it said. */
  balanceAfter: number | null;
  submittedAt: string;
  verifiedAt: string | null;
  rejectReason: string;
  notes?: string;
}

/**
 * One thing a gateway told us, as recorded by tms_apply_gateway_result.
 * Agent-only in RLS; a tenant's list is always empty. `outcome` is what
 * applying it did — 'mismatch' and 'late_paid' are the two a person has to
 * look at.
 */
export type TmsGatewayEventOutcome =
  | ""
  | "applied"
  | "noop"
  | "unmatched"
  | "mismatch"
  | "late_paid";

export interface TmsGatewayEvent {
  id: string;
  provider: TmsGatewayProvider;
  eventId: string;
  source: "webhook" | "poll";
  outcome: TmsGatewayEventOutcome;
  submissionId: string | null;
  topupId: string | null;
  receivedAt: string;
}

/**
 * What tms_my_meters() returns — deliberately fewer columns than tms_devices.
 * `key_hash` is the credential the physical meter authenticates with and is
 * not in this shape, which is the reason the function exists at all.
 */
export interface TmsMeter {
  id: string;
  deviceId: string;
  label: string;
  utility: TmsUtility;
  billingMode: "prepaid" | "postpaid";
  balance: number;
  lowBalanceThreshold: number;
  lastSeenAt: string | null;
}

/**
 * A company that can issue an invoice — a row of public.invoice_issuers.
 *
 * Separate from the divisions in ModuleKey on purpose: a division is a part of
 * the dashboard, while this is a legal entity with a registration number and a
 * bank account. TMS is the first and MEC Asset the second, and neither
 * relationship is reliable enough to derive one from the other.
 */
export interface InvoiceIssuer {
  id: string;
  /** Shown in the tool's dropdown, e.g. "MEC Asset". */
  label: string;
  /** Printed in the masthead, e.g. "MEC ASSET SDN BHD". */
  name: string;
  /** SSM number, printed beside the name. */
  regNo: string;
  building: string;
  /** One element per printed line. */
  addressLines: string[];
  contact: string;
  /** The MIV in MIV-2510/00024. */
  prefix: string;
  /** data:image/...;base64,... — empty prints a block instead. */
  logo: string;
  bankName: string;
  bankAccount: string;
}
