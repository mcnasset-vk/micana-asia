import { redirect } from "next/navigation";

import {
  kindFromReference,
  reconcileAttempt,
  withdrawAttempt,
  type GatewayAttempt,
} from "@/lib/payments/gateway";
import { createClient } from "@/lib/supabase/server";
import type { TmsSubmissionStatus } from "@/lib/types";

/**
 * Where the hosted checkout sends the tenant back.
 *
 *   /tms/gateway/return?ref=RR-202609-00012&outcome=success
 *   /tms/gateway/return?ref=TU-202609-00007&outcome=cancel
 *
 * Coming back proves nothing — a URL is a URL — so this page does not mark
 * anything paid. It asks the gateway, through the same reconcile the
 * webhook uses, and then sends the tenant to their screen, which shows
 * whatever the ledger now says. If the webhook got there first the ask is
 * a no-op; if it has not arrived yet the tenant still sees the truth.
 *
 * "cancel" is the tenant leaving the payment page. The attempt is withdrawn
 * so the months are free again at once, rather than held for the rest of
 * the checkout's life. If they paid after all, the withdrawal fails and the
 * reconcile inside it records the payment instead.
 *
 * The row is looked up with the tenant's own client, so a reference that is
 * not theirs finds nothing and nothing is asked.
 */

export const dynamic = "force-dynamic";

export default async function GatewayReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; outcome?: string }>;
}) {
  const { ref = "", outcome = "" } = await searchParams;
  const kind = kindFromReference(ref);
  const target = kind === "topup" ? "/tms/topup" : "/tms/pay";

  if (kind) {
    const supabase = await createClient();
    const { data: row } = await supabase
      .from(kind === "payment" ? "tms_payment_submissions" : "tms_meter_topups")
      .select(
        "id, reference, amount, provider, provider_reference, status, method, checkout_expires_at",
      )
      .eq("reference", ref)
      .maybeSingle();

    if (row && row.method === "gateway" && row.status === "submitted") {
      const attempt: GatewayAttempt = {
        kind,
        id: String(row.id),
        reference: String(row.reference),
        amount: Number(row.amount),
        provider: row.provider,
        providerReference: String(row.provider_reference ?? ""),
        status: row.status as TmsSubmissionStatus,
        checkoutExpiresAt: row.checkout_expires_at
          ? String(row.checkout_expires_at)
          : null,
      };

      try {
        if (outcome === "cancel") {
          await withdrawAttempt(
            attempt,
            "tenant",
            "You left the payment page before paying.",
          );
        } else {
          await reconcileAttempt(attempt, "poll", { returned: outcome });
        }
      } catch (cause) {
        // The gateway was unreachable. The screen will say "still waiting",
        // which is true, and the office can ask again later.
        console.error(`gateway return: ${ref}`, cause);
      }
    }
  }

  redirect(kind ? `${target}?returned=${encodeURIComponent(ref)}` : target);
}
