/** Formatting helpers. Malaysian conventions throughout: RM, en-MY dates. */

const RM = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** RM 1,250,000 */
export function formatRM(value: number): string {
  return `RM ${RM.format(Math.round(value))}`;
}

/**
 * RM 938.50 — the exact figure, cents and all.
 *
 * formatRM rounds, which is right for a dashboard: nobody reads a portfolio
 * total to the sen, and RM 1,250,000 beats RM 1,250,000.00 everywhere it
 * appears. It is wrong wherever the number is one a person has to type into a
 * bank transfer. A utility recharge of RM38.50 rendered as "RM 39", inside a
 * total rendered as "RM 939", is a tenant sending 50 sen too much and a
 * reconciliation that does not balance.
 *
 * Use this on anything a tenant pays or an agent verifies against a slip.
 */
export function formatRMExact(value: number): string {
  return `RM ${RM_EXACT.format(value)}`;
}

const RM_EXACT = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** RM 1.25M — for tight spaces like chart labels and funnel stages. */
export function formatRMCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const m = value / 1_000_000;
    return `RM ${trimZeros(m.toFixed(2))}M`;
  }
  if (abs >= 1_000) {
    const k = value / 1_000;
    return `RM ${trimZeros(k.toFixed(0))}k`;
  }
  return `RM ${RM.format(value)}`;
}

function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/** 1,250,000 — no currency prefix, for table columns with an RM header. */
export function formatNumber(value: number): string {
  return RM.format(Math.round(value));
}

/** 12.5% */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** 30 Nov 2026 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/**
 * Whole days between two dates, timezone-independent.
 * Both sides are normalised to UTC midnight so server and client render the
 * same integer and hydration never mismatches.
 */
export function daysBetween(from: string | Date, to: string | Date): number {
  const a = toUtcMidnight(from);
  const b = toUtcMidnight(to);
  // An unconfigured date arrives as "" and yields NaN here. Returning 0 keeps
  // the same contract as the rest of lib/config: a missing value renders an
  // honest zero rather than NaN leaking onto the page.
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function daysRemaining(
  deadline: string | Date,
  now: string | Date,
): number {
  return Math.max(0, daysBetween(now, deadline));
}

function toUtcMidnight(value: string | Date): number {
  const d = typeof value === "string" ? new Date(value) : value;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Malaysian mobile numbers: 012-345 6789 → tel:+60123456789 */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("60")) return `tel:+${digits}`;
  if (digits.startsWith("0")) return `tel:+60${digits.slice(1)}`;
  return `tel:${digits}`;
}

/** Safe divide that returns 0 instead of NaN/Infinity. */
export function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

/** Clamp a 0–1 ratio for use as a bar width. */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
