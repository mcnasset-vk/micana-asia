import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes reachable without a session.
 *
 * The three /api entries are machine callers, not people. Each authenticates
 * with a secret of its own rather than a cookie — a device key for the aircon
 * ingest, a cron secret plus a job key for the reminder run, a callback token
 * for a payment gateway reporting a result. Without them the proxy answers a
 * 307 to /login, which a device, a scheduler and a gateway are all equally
 * unable to do anything with.
 */
const PUBLIC_PATHS = [
  "/login",
  // The tenant's own door. Without this line the proxy would redirect it to
  // /login before it rendered, which is exactly the password box the separate
  // route exists to keep out of a tenant's way.
  "/tenantsearch/login",
  "/auth",
  "/api/iot",
  "/api/cron",
  "/api/webhooks",
];

/** Both sign-in screens, for the "already signed in, go home" check below. */
const SIGN_IN_PATHS = ["/login", "/tenantsearch/login"];

/**
 * Refreshes the Supabase auth token on every request and redirects signed-out
 * visitors to the login page.
 *
 * This is a convenience, not the security boundary — the real guarantee is row
 * level security in Postgres, which applies even if someone bypasses the app.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not put code between createServerClient and getClaims — a mistake here
  // causes users to be logged out at random.
  const { data } = await supabase.auth.getClaims();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (data?.claims && SIGN_IN_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
