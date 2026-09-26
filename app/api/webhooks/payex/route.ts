import type { NextRequest } from "next/server";

import {
  findAttemptByReference,
  kindFromReference,
  reconcileAttempt,
} from "@/lib/payments/gateway";
import { verifyCallback } from "@/lib/payments/payex";

/**
 * Payex's payment callback.
 *
 *   POST /api/webhooks/payex
 *   { "reference_number": "RR-202609-00012", "txn_id": "...", "status": "..." }
 *
 * The body is treated as a prompt, not as proof. It tells us which of our
 * references something happened to; what happened is then read back from
 * Payex with our own token, through the same reconcile the return page uses,
 * and applied by tms_apply_gateway_result. So a forged body that somehow
 * passed verification could at most make us ask Payex a question we would
 * have asked anyway, and a genuine body delivered twice is applied once.
 *
 * VERIFICATION IS CURRENTLY CLOSED
 *
 * payex.verifyCallback returns false for everything, because Payex's swagger
 * does not say how the callback is signed and a check that cannot check must
 * not wave things through. Every delivery is therefore refused with a 401
 * until the signature scheme is known and implemented.
 *
 * That costs promptness, not correctness. The return page reconciles when the
 * tenant comes back, and reconcileOverdueAttempts sweeps anything abandoned;
 * both ask Payex directly, which is the authoritative path in any case.
 *
 * `/api/webhooks` is in PUBLIC_PATHS in lib/supabase/proxy.ts; Payex has no
 * cookie to present.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  if (!body) {
    return Response.json({ error: "Unreadable body." }, { status: 400 });
  }

  if (!verifyCallback(request.headers, body)) {
    return Response.json({ error: "Unauthorised." }, { status: 401 });
  }

  const reference = String(body.reference_number ?? "");
  if (!kindFromReference(reference)) {
    // Not one of ours. The account may take other money; 2xx so Payex stops.
    return Response.json({ ok: true, outcome: "ignored" });
  }

  const attempt = await findAttemptByReference(reference);
  if (!attempt) return Response.json({ ok: true, outcome: "ignored" });

  try {
    const result = await reconcileAttempt(attempt, "webhook", {
      webhook: body,
    });
    return Response.json({
      ok: true,
      outcome: result.outcome,
      applied: result.applied,
    });
  } catch (cause) {
    console.error(`payex webhook: ${reference}`, cause);
    return Response.json(
      { error: "Could not apply the result." },
      { status: 500 },
    );
  }
}

/**
 * Payex may post JSON or a form. Both are read rather than one assumed,
 * because guessing wrong turns a real payment into a 400 that Payex retries
 * six times and then gives up on.
 */
async function readBody(
  request: NextRequest,
): Promise<Record<string, unknown> | null> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      return (await request.json()) as Record<string, unknown>;
    }
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  } catch {
    return null;
  }
}
