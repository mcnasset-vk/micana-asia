"use server";

import { revalidatePath } from "next/cache";

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
import {
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

/** Every mutation refreshes the layout, which is where the data is fetched. */
function refresh() {
  revalidatePath("/", "layout");
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
