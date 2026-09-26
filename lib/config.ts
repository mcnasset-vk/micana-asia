/**
 * Every commercially sensitive figure, read from the environment.
 *
 * This repository is public. Contract values, staff quotas, contractor rates
 * and fundraising targets are confidential — several of them are individual
 * compensation terms covered by confidentiality clauses — so none of them may
 * appear in source, in a default, or in a comment. Set them in `.env.local`
 * locally and in the hosting environment for a deployment; `.env.example`
 * lists every name with no values.
 *
 * Each reference below is written out in full rather than looked up
 * dynamically, because Next.js inlines `process.env.NEXT_PUBLIC_*` at build
 * time only when it can see the literal name.
 *
 * An unset variable falls back to 0, which is deliberate: `ratio()` returns 0
 * on a zero denominator, so a misconfigured deployment renders honest zeroes
 * instead of NaN. A dashboard reading RM 0 everywhere is an obvious signal
 * that the environment is incomplete.
 */

/** ISO date, or "" when unset — formatDate renders "—" and date maths reads 0. */
function date(raw: string | undefined): string {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function num(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/* -------------------------------------------------------------------------- */
/* Capital raise                                                               */
/* -------------------------------------------------------------------------- */

export const CFG_FUNDRAISING_TARGET = num(
  process.env.NEXT_PUBLIC_FUNDRAISING_TARGET,
);
export const CFG_NASDAQ_PAT_TARGET = num(
  process.env.NEXT_PUBLIC_NASDAQ_PAT_TARGET,
);

// The deadline is as disclosive as the target: the two together describe the
// whole raise, so it belongs here rather than in source.
export const CFG_FUNDRAISING_DEADLINE = date(
  process.env.NEXT_PUBLIC_FUNDRAISING_DEADLINE,
);
export const CFG_CAMPAIGN_START = date(process.env.NEXT_PUBLIC_CAMPAIGN_START);

/* -------------------------------------------------------------------------- */
/* Tenant payment details                                                      */
/* -------------------------------------------------------------------------- */
// Shown to a tenant so they know where to send rent. Unlike the figures above
// these are meant to be handed out — but note they are NEXT_PUBLIC_, so they
// are compiled into the browser bundle and readable by anyone who loads the
// site, signed in or not. Use the account you would print on an invoice, not
// one you would rather keep quiet. Leave blank and the panel tells the tenant
// to contact the office instead of showing an empty form.

function text(raw: string | undefined): string {
  return (raw ?? "").trim();
}

export const CFG_PAY_TO_NAME = text(process.env.NEXT_PUBLIC_PAY_TO_NAME);
export const CFG_PAY_BANK = text(process.env.NEXT_PUBLIC_PAY_BANK);
export const CFG_PAY_ACCOUNT = text(process.env.NEXT_PUBLIC_PAY_ACCOUNT);
export const CFG_PAY_CONTACT = text(process.env.NEXT_PUBLIC_PAY_CONTACT);

/* -------------------------------------------------------------------------- */
/* Deal structures                                                             */
/* -------------------------------------------------------------------------- */

export const CFG_FACTORY_DISBURSEMENT = num(
  process.env.NEXT_PUBLIC_FACTORY_DISBURSEMENT,
);
export const CFG_FACTORY_HQ_INVESTMENT = num(
  process.env.NEXT_PUBLIC_FACTORY_HQ_INVESTMENT,
);
export const CFG_MDNA_PACKAGE = num(process.env.NEXT_PUBLIC_MDNA_PACKAGE);
export const CFG_MDNA_HQ_INVESTMENT = num(
  process.env.NEXT_PUBLIC_MDNA_HQ_INVESTMENT,
);
export const CFG_INTRODUCER_COMMISSION = num(
  process.env.NEXT_PUBLIC_INTRODUCER_COMMISSION,
);

/* -------------------------------------------------------------------------- */
/* MEC revenue streams                                                         */
/* -------------------------------------------------------------------------- */

export const CFG_MEC_TARGET_CEC = num(process.env.NEXT_PUBLIC_MEC_TARGET_CEC);
export const CFG_MEC_TARGET_SPONSOR = num(
  process.env.NEXT_PUBLIC_MEC_TARGET_SPONSOR,
);
export const CFG_MEC_TARGET_SUBSCRIPTION = num(
  process.env.NEXT_PUBLIC_MEC_TARGET_SUBSCRIPTION,
);
export const CFG_MEC_TARGET_ADVISORY = num(
  process.env.NEXT_PUBLIC_MEC_TARGET_ADVISORY,
);
export const CFG_MEC_TARGET_TRAINING = num(
  process.env.NEXT_PUBLIC_MEC_TARGET_TRAINING,
);
export const CFG_MEC_TARGET_PAYROLL = num(
  process.env.NEXT_PUBLIC_MEC_TARGET_PAYROLL,
);

/* -------------------------------------------------------------------------- */
/* Individual compensation — the most sensitive values here                    */
/* -------------------------------------------------------------------------- */

export const CFG_MEC_PARTNERSHIP_QUOTA = num(
  process.env.NEXT_PUBLIC_MEC_PARTNERSHIP_QUOTA,
);
export const CFG_MEC_REVENUE_PER_STAFF_MIN = num(
  process.env.NEXT_PUBLIC_MEC_REVENUE_PER_STAFF_MIN,
);
export const CFG_MEC_REVENUE_PER_STAFF_MAX = num(
  process.env.NEXT_PUBLIC_MEC_REVENUE_PER_STAFF_MAX,
);
export const CFG_LIFESTYLE_MONTHLY_FEE = num(
  process.env.NEXT_PUBLIC_LIFESTYLE_MONTHLY_FEE,
);

/** Ops Admin Associate deliverable rate card. */
export const CFG_RATE_EDM = num(process.env.NEXT_PUBLIC_RATE_EDM);
export const CFG_RATE_FB_EVENT = num(process.env.NEXT_PUBLIC_RATE_FB_EVENT);
export const CFG_RATE_CEC_PROFILE = num(
  process.env.NEXT_PUBLIC_RATE_CEC_PROFILE,
);
export const CFG_RATE_DIGITAL_ACCESS = num(
  process.env.NEXT_PUBLIC_RATE_DIGITAL_ACCESS,
);
