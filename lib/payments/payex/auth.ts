import "server-only";

/**
 * Payex authentication.
 *
 * `POST /api/Auth/Token` takes no body. The credential travels as HTTP Basic —
 * base64(username:secret) — and comes back as a bearer token with an
 * expiry, which every other call then carries.
 *
 * WHY server-only, at the top of the file
 *
 * PAYEX_SECRET is a merchant credential: whoever holds it can move money as
 * this business. It must never be prefixed NEXT_PUBLIC_ and never be imported
 * into a client component. The `server-only` import above turns a mistake
 * there into a build failure rather than a secret in the browser bundle —
 * which is the same reason lib/data.ts opens with it.
 *
 * Note the contrast with lib/config.ts: the values there are NEXT_PUBLIC_ on
 * purpose, because a bank account number is printed on invoices. This is the
 * opposite kind of value and gets the opposite treatment.
 */

/** Set in the hosting environment. Never in source, never NEXT_PUBLIC_. */
const USERNAME = process.env.PAYEX_USERNAME ?? "";
const SECRET = process.env.PAYEX_SECRET ?? "";
const BASE_URL = process.env.PAYEX_BASE_URL ?? "https://api.payex.io";

/**
 * Renew this long before the stated expiry.
 *
 * A token that is valid for another two seconds is not worth starting a
 * request with: the call can outlive it and come back 401 for a reason that
 * has nothing to do with the request. Sixty seconds is far more than the
 * round trip and costs one extra token fetch per hour at most.
 */
const RENEW_BEFORE_MS = 60_000;

type Cached = { token: string; expiresAt: number };

let cached: Cached | null = null;

/**
 * The in-flight fetch, shared by every caller that arrives while it is open.
 *
 * Without this, a page that starts three Payex calls at once on a cold cache
 * fetches three tokens, and whichever resolves last wins — the other two are
 * issued, unused and left to expire. Payex may also rate-limit the endpoint.
 */
let inFlight: Promise<string> | null = null;

export class PayexError extends Error {
  /**
   * `code` carries the kind of failure, `status` the HTTP status when there
   * was one. Both are read by describeGateway in the dashboard actions, which
   * turns NOT_CONFIGURED and NETWORK into sentences a tenant should see and
   * everything else into the gateway's own words.
   */
  constructor(
    message: string,
    readonly code = "",
    readonly status = 0,
  ) {
    super(message);
    this.name = "PayexError";
  }
}

/** True when the environment carries enough to talk to Payex at all. */
export function payexConfigured(): boolean {
  return Boolean(USERNAME && SECRET);
}

/**
 * A valid bearer token, from cache when there is one.
 *
 * Throws rather than returning empty: a caller that treats "no token" as "no
 * payment" would silently fall back to showing a tenant a bank transfer while
 * believing it had offered Payex.
 */
export async function payexToken(): Promise<string> {
  if (cached && cached.expiresAt - RENEW_BEFORE_MS > Date.now()) {
    return cached.token;
  }
  if (inFlight) return inFlight;

  if (!payexConfigured()) {
    throw new PayexError(
      "Payex is not configured: set PAYEX_USERNAME and PAYEX_SECRET.",
      "NOT_CONFIGURED",
    );
  }

  inFlight = fetchToken().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function fetchToken(): Promise<string> {
  const basic = Buffer.from(`${USERNAME}:${SECRET}`).toString("base64");

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api/Auth/Token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: "application/json",
      },
      // A credential exchange must never be served from a cache, by us or by
      // anything between us and Payex.
      cache: "no-store",
    });
  } catch (cause) {
    throw new PayexError(`Could not reach Payex: ${String(cause)}`, "NETWORK");
  }

  if (!response.ok) {
    // The body may echo the credential back in an error message, so it is
    // deliberately not included here — this string reaches logs.
    throw new PayexError(
      `Payex refused the credentials (HTTP ${response.status}).`,
      "AUTH",
      response.status,
    );
  }

  const body = (await response.json()) as {
    token?: unknown;
    expiration?: unknown;
  };

  if (typeof body.token !== "string" || body.token === "") {
    throw new PayexError("Payex returned no token.", "AUTH");
  }

  // A malformed or missing expiry is treated as a short one rather than as
  // "never expires": guessing long means every later call fails on a token we
  // still believe in, and the failure surfaces far from its cause.
  const parsed =
    typeof body.expiration === "string" ? Date.parse(body.expiration) : NaN;
  const expiresAt = Number.isFinite(parsed) ? parsed : Date.now() + 5 * 60_000;

  cached = { token: body.token, expiresAt };
  return body.token;
}

/** Drops the cached token. Call after a 401 so the next attempt re-authenticates. */
export function payexForgetToken(): void {
  cached = null;
}
