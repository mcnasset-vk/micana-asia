import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * The server's own Supabase client. Bypasses row level security.
 *
 * Every other client in this directory carries a person's session and is
 * held to their rows by RLS. This one carries the project's secret key and
 * is held to nothing, which is why it exists in exactly one situation: a
 * payment gateway has reported a result, and there is no person to act as.
 * The functions it may call — tms_attach_gateway_checkout,
 * tms_cancel_gateway_submission, tms_apply_gateway_result — are granted to
 * service_role alone, so the reach of this key is those three and whatever
 * a bug in this file lets through.
 *
 * `server-only` makes importing it from a client component a build error
 * rather than a leaked key. The variable is deliberately not NEXT_PUBLIC_.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set. The gateway cannot be applied without it.",
    );
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
