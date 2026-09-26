import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

import * as payex from "@/lib/payments/payex";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  TmsGatewayKind,
  TmsGatewayProvider,
  TmsSubmissionStatus,
} from "@/lib/types";

/**
 * Online payments, in the application's own terms.
 *
 * Three routes end up here — the server action that opens a checkout, the
 * webhook that says a checkout was paid, and the "go and ask" that the return
 * page and the office use — and all three settle the ledger through one
 * function, tms_apply_gateway_result, keyed on one event id. So a result that
 * arrives by two routes is applied once, whichever route wins.
 *
 * The provider is named in exactly one place below (`PROVIDER`), and its
 * shapes live in lib/payments/payex/. A second provider is a second folder
 * there and a `switch` here.
 */

export type GatewayKind = TmsGatewayKind;

/** The provider new checkouts are opened with. */
export const PROVIDER: TmsGatewayProvider = "payex";

/**
 * Whether online payment can be offered at all, without naming who provides it.
 *
 * The pages, the layout's sweep and the two start actions all ask this. They
 * asked the adapter directly before, which meant swapping provider touched
 * five files outside this one and the docstring above was not quite true.
 * Now the provider is named here and nowhere else.
 */
export function gatewayConfigured(): boolean {
  return payex.payexConfigured();
}

/** The active adapter's error, under a name that does not date. */
export { PayexError as GatewayError } from "@/lib/payments/payex";

/**
 * How long a checkout stays open.
 *
 * Ours to enforce, not the gateway's: Payex intents carry no expiry, so this
 * is the deadline the sweep in reconcileOverdueAttempts works to.
 */
const CHECKOUT_MINUTES = 30;

export interface GatewayAttempt {
  kind: GatewayKind;
  id: string;
  reference: string;
  amount: number;
  provider: TmsGatewayProvider | "";
  providerReference: string;
  status: TmsSubmissionStatus;
  /** Our deadline for the checkout. Payex intents carry none of their own. */
  checkoutExpiresAt: string | null;
}

export type GatewayOutcome = "paid" | "expired" | "cancelled" | "pending";

const TABLE: Record<GatewayKind, "tms_payment_submissions" | "tms_meter_topups"> = {
  payment: "tms_payment_submissions",
  topup: "tms_meter_topups",
};

/** RR-… is a rent payment, TU-… a meter topup. Anything else is not ours. */
export function kindFromReference(reference: string): GatewayKind | null {
  if (/^RR-\d{6}-\d{5}$/.test(reference)) return "payment";
  if (/^TU-\d{6}-\d{5}$/.test(reference)) return "topup";
  return null;
}

function toAttempt(kind: GatewayKind, row: Record<string, unknown>): GatewayAttempt {
  return {
    kind,
    id: String(row.id),
    reference: String(row.reference ?? ""),
    amount: Number(row.amount ?? 0),
    provider: (row.provider as TmsGatewayProvider | "") ?? "",
    providerReference: String(row.provider_reference ?? ""),
    status: row.status as TmsSubmissionStatus,
    checkoutExpiresAt: row.checkout_expires_at
      ? String(row.checkout_expires_at)
      : null,
  };
}

const ATTEMPT_COLUMNS =
  "id, reference, amount, provider, provider_reference, status, checkout_expires_at";

/** Bypasses RLS: for the webhook, which has no session to be scoped by. */
export async function findAttemptByReference(
  reference: string,
): Promise<GatewayAttempt | null> {
  const kind = kindFromReference(reference);
  if (!kind) return null;

  const { data } = await createServiceClient()
    .from(TABLE[kind])
    .select(ATTEMPT_COLUMNS)
    .eq("reference", reference)
    .eq("method", "gateway")
    .maybeSingle();

  return data ? toAttempt(kind, data) : null;
}

/**
 * Where the tenant comes back to. Derived from the request rather than
 * configured, so a preview deployment returns to itself. The proxy forwards
 * the original host and scheme on Vercel; a dev server has neither header
 * and falls back to its own.
 */
export async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Open a hosted checkout for an attempt tms_create_gateway_* has just
 * written, and remember it on the row.
 *
 * Order matters. The row exists first, so the months are already held and a
 * second click cannot open a second checkout for them. The checkout is
 * created second. If that fails the row is withdrawn again in the same
 * breath, by the system, so the months go straight back rather than sitting
 * held behind a checkout that does not exist.
 */
export async function openCheckout(
  attempt: Pick<GatewayAttempt, "kind" | "id" | "reference" | "amount">,
  description: string,
): Promise<{ checkoutUrl: string; expiresAt: string | null }> {
  const origin = await appOrigin();
  const returnTo = (outcome: "success" | "cancel") =>
    `${origin}/tms/gateway/return?ref=${encodeURIComponent(attempt.reference)}&outcome=${outcome}`;

  const service = createServiceClient();

  let session: payex.PayexSession;
  try {
    session = await payex.createSession({
      referenceId: attempt.reference,
      amount: attempt.amount,
      description,
      successUrl: returnTo("success"),
      cancelUrl: returnTo("cancel"),
      expiresAt: new Date(Date.now() + CHECKOUT_MINUTES * 60_000),
      metadata: { kind: attempt.kind, id: attempt.id },
    });
  } catch (cause) {
    await service.rpc("tms_cancel_gateway_submission", {
      p_kind: attempt.kind,
      p_id: attempt.id,
      p_reason: "The payment page could not be opened. Nothing was charged.",
      p_via: "system",
    });
    throw cause;
  }

  const { error } = await service.rpc("tms_attach_gateway_checkout", {
    p_kind: attempt.kind,
    p_id: attempt.id,
    p_provider_reference: session.id,
    p_checkout_url: session.checkoutUrl,
    p_expires_at: session.expiresAt,
  });

  if (error) {
    // The row would not take the checkout — most likely already withdrawn.
    // Close the session too, so nobody can pay against a row that is gone.
    await payex.cancelSession(session.id).catch(() => undefined);
    throw new Error(error.message);
  }

  return { checkoutUrl: session.checkoutUrl, expiresAt: session.expiresAt };
}

/**
 * Ask the gateway what became of an attempt, and make the ledger agree.
 *
 * The event id is the session id plus the status it reads, so a webhook and
 * a poll that both see COMPLETED name the same event, and the second is a
 * no-op inside tms_apply_gateway_result. `applied` is that function's word
 * for what it did; 'pending' means the gateway is still waiting and nothing
 * was recorded.
 */
export async function reconcileAttempt(
  attempt: GatewayAttempt,
  source: "webhook" | "poll",
  extra: Record<string, unknown> = {},
): Promise<{ outcome: GatewayOutcome; applied: string | null }> {
  if (!attempt.providerReference || attempt.provider !== PROVIDER) {
    return { outcome: "pending", applied: null };
  }

  const session = await payex.getSession(attempt.providerReference);
  let outcome = payex.sessionOutcome(session.status);

  /*
   * A checkout past its deadline with no transaction against it at all.
   *
   * Nobody paid: a transaction exists from the moment someone tries, so none
   * means nobody tried, or the intent died before they could. Left as
   * "pending" that row holds the tenant's months for good — the sweep asks
   * the same question and gets the same answer every time, so nothing ever
   * releases them and the tenant cannot pay those months by any other route
   * either. Three topups sat stuck this way for two days before it was noticed.
   *
   * Only after the deadline. Before it, no transaction means a checkout that
   * is open and may yet be paid, and expiring that would cancel a payment
   * while the tenant is in the middle of making it.
   */
  const lapsed = attempt.checkoutExpiresAt
    ? Date.parse(attempt.checkoutExpiresAt) < Date.now()
    : false;
  const neverStarted = outcome === "pending" && !session.status && lapsed;
  if (neverStarted) outcome = "expired";

  if (outcome === "pending") return { outcome, applied: null };

  const { data, error } = await createServiceClient().rpc("tms_apply_gateway_result", {
    p_provider: PROVIDER,
    // Stable either way, so a second sweep is a duplicate rather than a second
    // event: the status when there is a transaction, the word when there is not.
    p_event_id: neverStarted
      ? `${attempt.providerReference}:expired`
      : `${session.id}:${session.status}`,
    p_source: source,
    p_provider_reference: neverStarted ? attempt.providerReference : session.id,
    // The reference check exists to catch a gateway pointing at the wrong row.
    // With no transaction there is nothing pointing anywhere, so the row's own
    // reference is passed rather than the empty string a missing echo gives —
    // which the check would read as a mismatch and refuse to apply.
    p_external_reference: neverStarted ? attempt.reference : session.referenceId,
    p_outcome: outcome,
    p_amount: outcome === "paid" ? session.amount : null,
    p_payload: { session: session.raw, ...extra },
  });

  if (error) throw new Error(error.message);
  return { outcome, applied: typeof data === "string" ? data : null };
}

/**
 * Withdraw an open attempt: close the checkout at the gateway first, then
 * the row. If the gateway will not close it — because it has just been paid,
 * or has already expired — the answer is whatever the gateway now says, so
 * reconcile instead and report that the attempt was already settled.
 */
export async function withdrawAttempt(
  attempt: GatewayAttempt,
  via: "tenant" | "agent",
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string; settled: boolean }> {
  if (attempt.status !== "submitted") {
    return { ok: false, error: "That attempt has already been dealt with.", settled: true };
  }

  if (attempt.providerReference && attempt.provider === PROVIDER) {
    try {
      await payex.cancelSession(attempt.providerReference);
    } catch (cause) {
      if (cause instanceof payex.PayexError && cause.status === 422) {
        const { outcome } = await reconcileAttempt(attempt, "poll", { withdrawnBy: via });
        return {
          ok: false,
          settled: true,
          error:
            outcome === "paid"
              ? "That payment has already gone through — it cannot be withdrawn."
              : "That attempt had already closed. It has been updated.",
        };
      }
      return {
        ok: false,
        settled: false,
        error: "The payment gateway could not be reached. Try again in a moment.",
      };
    }
  }

  const { error } = await createServiceClient().rpc("tms_cancel_gateway_submission", {
    p_kind: attempt.kind,
    p_id: attempt.id,
    p_reason: reason,
    p_via: via,
  });

  if (error) return { ok: false, error: error.message, settled: false };
  return { ok: true };
}

/**
 * Attempts whose checkout has lapsed and which nobody has asked about — the
 * tenant never came back, and no webhook arrives for an intent that
 * simply expires. Called on the way into the payment screens with the
 * caller's own client, so RLS decides whose attempts are looked at: a
 * tenant's own, or for an agent everybody's. Capped, because a screen load
 * is not the place for a backlog.
 */
export async function reconcileOverdueAttempts(
  supabase: SupabaseClient,
): Promise<void> {
  const now = new Date().toISOString();
  const found: GatewayAttempt[] = [];

  for (const kind of ["payment", "topup"] as const) {
    const { data } = await supabase
      .from(TABLE[kind])
      .select(ATTEMPT_COLUMNS)
      .eq("method", "gateway")
      .eq("status", "submitted")
      .neq("provider_reference", "")
      .lt("checkout_expires_at", now)
      .limit(5);
    for (const row of data ?? []) found.push(toAttempt(kind, row));
  }

  for (const attempt of found) {
    // One failure must not stop the others, and none may stop the page.
    await reconcileAttempt(attempt, "poll", { sweep: true }).catch((cause) => {
      console.error(`gateway sweep: ${attempt.reference}`, cause);
    });
  }
}
