import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * A session-less Supabase client, for callers that have no cookie to present —
 * today that means the aircon devices posting to /api/iot/aircon.
 *
 * This is the publishable key, so it carries no privilege of its own: it can
 * reach exactly one thing, `micana_record_aircon_reading`, and that function
 * authenticates the device by its own key before writing. Row level security
 * still applies to everything else.
 */
export function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
