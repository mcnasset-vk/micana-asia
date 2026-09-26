import "server-only";

import { PayexError, payexForgetToken, payexToken } from "./auth";

export { PayexError, payexConfigured } from "./auth";

/**
 * Payex, as the gateway layer needs it.
 *
 * This file answers the same six questions lib/payments/xendit.ts answers, in
 * the same shapes, so lib/payments/gateway.ts can hold one provider at a time
 * without knowing which. Two of Payex's answers differ from Xendit's in ways
 * that matter, and both are handled here rather than leaking upwards:
 *
 *   1. There is no endpoint to cancel an unpaid payment intent. Void acts on
 *      a transaction that already happened. So cancelSession cannot shut the
 *      checkout; what it can do is establish whether anyone has paid, which
 *      is the question withdrawAttempt actually needs answered.
 *
 *   2. A payment intent is not a transaction. The intent exists from the
 *      moment we create it; a transaction exists only once somebody pays.
 *      So "what became of this attempt" is a search by our own intent key,
 *      and no rows is a real answer — nobody paid — not a failure.
 *
 * WHAT THIS FILE MAY NOT DO
 *
 * It may not decide that money moved on a status string it does not
 * recognise. PAID_STATUSES below is empty until somebody fills it from
 * Payex's reference table, and until then sessionOutcome answers "pending"
 * for everything. A tenant's payment then sits visible and unsettled, which
 * an agent can see and act on. The opposite mistake — guessing a code means
 * paid — credits a meter nobody paid for, silently.
 */

const BASE_URL = process.env.PAYEX_BASE_URL ?? "https://api.payex.io";
const COLLECTION_ID = process.env.PAYEX_COLLECTION_ID ?? "";

/** Payex signals success with "00", on the envelope and on each result. */
const OK = "00";

/**
 * How a Payex status maps onto the ledger's outcomes.
 *
 * Both sets are read from the environment so a value can be added the moment
 * somebody sees it, without waiting on a code change — PAYEX_PAID_STATUSES
 * and PAYEX_FAILED_STATUSES, comma separated, matched case-insensitively.
 *
 * PAID starts EMPTY and must stay that way until the value is observed rather
 * than assumed. A wrong entry there marks a month's rent paid, or credits a
 * meter, for money that never arrived, and nothing downstream contradicts it.
 * The opposite mistake only leaves a payment visible and unsettled, which a
 * person can see and fix.
 *
 * FAILED seeds with "failed", which Payex returned on a real attempt and
 * sessionOutcome named in the log. That is what these are meant to be filled
 * from, and it is why the logging exists.
 */
function statusSet(raw: string | undefined, seed: string[]): Set<string> {
  const out = new Set(seed);
  for (const part of (raw ?? "").split(",")) {
    const value = part.trim().toLowerCase();
    if (value) out.add(value);
  }
  return out;
}

const PAID_STATUSES = statusSet(process.env.PAYEX_PAID_STATUSES, []);
const FAILED_STATUSES = statusSet(process.env.PAYEX_FAILED_STATUSES, ["failed"]);

const seenUnknownStatus = new Set<string>();

export interface PayexSession {
  /** The payment intent key. Stored as provider_reference. */
  id: string;
  /** Our RR-/TU- reference, echoed back as reference_number. */
  referenceId: string;
  /** Payex's transaction status, or "" when no transaction exists yet. */
  status: string;
  amount: number;
  currency: string;
  /** The hosted checkout. Empty on a session read back after payment. */
  checkoutUrl: string;
  /**
   * Our deadline, not Payex's.
   *
   * PaymentIntents takes no expiry, so nothing at Payex closes an abandoned
   * checkout. This is the time after which the sweep in gateway.ts stops
   * waiting and asks what happened, and it is enforced entirely on our side.
   */
  expiresAt: string | null;
  /** Payex's transaction id, once one exists. Needed for void and refund. */
  txnId: string | null;
  raw: Record<string, unknown>;
}

export async function createSession(input: {
  referenceId: string;
  amount: number;
  description: string;
  customerName?: string;
  email?: string;
  contactNumber?: string;
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}): Promise<PayexSession> {
  if (!(input.amount > 0)) {
    throw new PayexError("A payment must be for more than nothing.", "AMOUNT");
  }

  const body = [
    {
      // SEN, not ringgit. RM20 is 2000.
      //
      // This was wrong in the first cut, and wrong in the direction that does
      // not announce itself: an earlier note in this file claimed ringgit and
      // said so with confidence. Sending 20 for RM20 produced a Payex page
      // reading "MYR 0.20" — a hundredth of the sum, which looks like a
      // formatting quirk rather than a charge for the wrong amount.
      //
      // Math.round, not toFixed: the input is ringgit with two decimals, and
      // 20.05 * 100 is 2004.9999999999998 in floating point. Truncating that
      // undercharges by a sen on a payment that must reconcile exactly against
      // the ledger, and tms_apply_gateway_result compares the two.
      amount: Math.round(input.amount * 100),
      currency: "MYR",
      ...(COLLECTION_ID ? { collection_id: COLLECTION_ID } : {}),
      capture: true,
      customer_name: input.customerName || "Tenant",
      ...(input.email ? { email: input.email } : {}),
      ...(input.contactNumber ? { contact_number: input.contactNumber } : {}),
      description: input.description,
      reference_number: input.referenceId,
      // Derived from where the tenant is being sent back to, so a preview
      // deployment calls its own webhook rather than production's. Xendit
      // configures this in its dashboard; Payex takes it per request.
      callback_url: `${new URL(input.successUrl).origin}/api/webhooks/payex`,
      return_url: input.successUrl,
      // One intent, one attempt. Without it a tenant who reloads the hosted
      // page can pay the same reference twice, and the second payment has no
      // charge left to settle. It also bounds the window in which a withdrawn
      // attempt can still be paid, since we cannot close the intent ourselves.
      single_attempt: true,
    },
  ];

  const envelope = await call("POST", "/api/v1/PaymentIntents", { body });
  const first = firstRow(envelope);
  const key = str(first.key);
  const url = str(first.url);

  if (str(first.status) !== OK || !url || !key) {
    throw new PayexError(
      str(first.error) || "Payex declined the payment request.",
      "DECLINED",
    );
  }

  return {
    id: key,
    referenceId: input.referenceId,
    status: "",
    amount: input.amount,
    currency: "MYR",
    checkoutUrl: url,
    expiresAt: input.expiresAt.toISOString(),
    txnId: null,
    raw: first,
  };
}

/**
 * What became of the attempt, asked of Payex rather than of the browser.
 *
 * Searched by our intent key, because that is what we stored and because a
 * transaction id does not exist until somebody pays. No transaction is a
 * complete answer: the intent was created and never used.
 */
export async function getSession(intentKey: string): Promise<PayexSession> {
  const envelope = await call(
    "GET",
    `/api/v1/Transactions?payment_intent=${encodeURIComponent(intentKey)}&limit=10`,
  );

  const rows = Array.isArray(envelope.result) ? envelope.result : [];
  const txn = pickTransaction(rows as Record<string, unknown>[]);

  if (!txn) {
    return {
      id: intentKey,
      referenceId: "",
      status: "",
      amount: 0,
      currency: "MYR",
      checkoutUrl: "",
      expiresAt: null,
      txnId: null,
      raw: { payment_intent: intentKey, transactions: 0 },
    };
  }

  return {
    id: intentKey,
    referenceId: str(txn.reference_number),
    status: str(txn.status),
    // RINGGIT, and not divided. Payex takes the amount in sen and gives it
    // back in ringgit, which is asymmetric enough to be worth stating.
    //
    // This was inferred the other way first. The evidence came from a stored
    // event: TU-202609-00006 was RM100 in our ledger, created by a build that
    // sent 100 rather than 10000, so Payex charged MYR 1.00 — and the
    // transaction came back reading `amount: "1"`. One, not one hundred. The
    // response is in the major unit.
    //
    // Dividing here was not a harmless guess. tms_apply_gateway_result
    // compares this against the row's own amount, so every settled payment
    // would have arrived a hundredth of its true size, been recorded as a
    // 'mismatch' and refused to settle — with the money already taken.
    amount: Number(txn.amount ?? 0),
    currency: str(txn.currency) || "MYR",
    checkoutUrl: "",
    expiresAt: null,
    txnId: str(txn.txn_id) || null,
    raw: txn,
  };
}

/**
 * Payex cannot close an unpaid intent, so this does the next honest thing.
 *
 * withdrawAttempt calls it to make sure a tenant's months are not released
 * while a payment for them is going through. It cannot stop the checkout —
 * nothing can — so it asks whether anybody has paid, and refuses the
 * withdrawal if somebody has. The 422 is deliberate: gateway.ts already
 * treats that as "the gateway says it is too late, go and reconcile".
 */
export async function cancelSession(intentKey: string): Promise<PayexSession> {
  const session = await getSession(intentKey);

  if (session.status && sessionOutcome(session.status) !== "pending") {
    throw new PayexError(
      "That payment intent has already been used.",
      "SETTLED",
      422,
    );
  }
  return session;
}

/** Payex's transaction status, in the ledger's terms. */
export function sessionOutcome(
  status: string,
): "paid" | "expired" | "cancelled" | "pending" {
  if (!status) return "pending";

  // Compared in lower case: Payex answers with words rather than codes, and
  // "Failed" is one capitalisation of a value nothing guarantees the case of.
  const key = status.trim().toLowerCase();
  if (PAID_STATUSES.has(key)) return "paid";
  if (FAILED_STATUSES.has(key)) return "cancelled";

  // Names the value once per process, so the first sandbox run tells whoever
  // is watching the logs exactly what to add to the two sets above.
  if (!seenUnknownStatus.has(status)) {
    seenUnknownStatus.add(status);
    console.warn(
      `payex: unmapped transaction status ${JSON.stringify(status)} — ` +
        "treating as pending. Add it to PAID_STATUSES or FAILED_STATUSES.",
    );
  }
  return "pending";
}

/**
 * Whether a callback really came from Payex.
 *
 * ALWAYS FALSE, for now. Payex's swagger does not document how the callback
 * is signed, and a verifier that cannot verify must not pretend to. Returning
 * false keeps the webhook shut: it answers 401 and settles nothing.
 *
 * Nothing is lost by that except promptness. The return page and the sweep
 * both reconcile by asking Payex directly, which is the authoritative path in
 * any case; the webhook only ever made it quicker.
 */
// The parameters are the contract this will honour once the scheme is known;
// removing them now would only have to be undone.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function verifyCallback(headers: Headers, body: unknown): boolean {
  return false;
}

/**
 * The most meaningful transaction for an intent.
 *
 * single_attempt should mean at most one, but a retried or split payment can
 * produce more. A settled one decides the outcome; otherwise the latest does.
 */
function pickTransaction(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return null;
  const settled = rows.find((r) => sessionOutcome(str(r.status)) === "paid");
  if (settled) return settled;
  return [...rows].sort((a, b) =>
    str(b.txn_date).localeCompare(str(a.txn_date)),
  )[0];
}

type Envelope = { status?: unknown; message?: unknown; result?: unknown };

async function call(
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; retried?: boolean } = {},
): Promise<Envelope> {
  const token = await payexToken();

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      cache: "no-store",
    });
  } catch (cause) {
    throw new PayexError(`Could not reach Payex: ${String(cause)}`, "NETWORK");
  }

  // One retry, and only on 401: the token is cached until just before its
  // stated expiry, but clock skew or an early revocation still lands here.
  // Retrying anything else risks creating a second intent for a request Payex
  // had already accepted.
  if (response.status === 401 && !options.retried) {
    payexForgetToken();
    return call(method, path, { ...options, retried: true });
  }

  if (!response.ok) {
    throw new PayexError(
      `Payex rejected the request (HTTP ${response.status}).`,
      "HTTP",
      response.status,
    );
  }

  const parsed = (await response.json()) as Envelope | unknown[];

  // /Transactions/{id} answers with a bare array; everything else wraps its
  // rows in an envelope. Both are accepted rather than assumed.
  if (Array.isArray(parsed)) return { status: OK, result: parsed };

  const envelope = parsed as Envelope;
  if (envelope.status !== undefined && envelope.status !== OK) {
    throw new PayexError(
      str(envelope.message) || "Payex refused the request.",
      "DECLINED",
    );
  }
  return envelope;
}

function firstRow(envelope: Envelope): Record<string, unknown> {
  const [first] = Array.isArray(envelope.result) ? envelope.result : [];
  if (!first || typeof first !== "object") {
    throw new PayexError("Payex returned nothing to work with.", "EMPTY");
  }
  return first as Record<string, unknown>;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
