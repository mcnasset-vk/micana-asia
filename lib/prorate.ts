/**
 * The first month's rent when a tenant moves in part way through it.
 *
 * This is the same apportionment public.tms_generate_month falls back on, kept
 * here so the form can show an agent what the database would work out before
 * they accept or override it. The two are pinned against each other by
 * supabase/tests/91_tms_prorate.sql: 900 from the 20th of a 30-day month is
 * 330.00 in both, and 900 from the 15th of February is 450.00 in both.
 *
 * By ACTUAL days in the month moved into, not a notional thirty. February is
 * the case that shows why: on 900, dividing by 28 gives 450.00 and dividing by
 * 30 gives 420.00, and the wrong one is wrong every February for every
 * mid-month move-in.
 *
 * What the agent does with the figure is their business — the form lets them
 * add to it or take from it, and whatever total they settle on is what gets
 * billed. This only offers the starting point.
 */

export interface ProRate {
  /** Days the tenant actually occupies in their first month. */
  daysOccupied: number;
  /** Days that month happens to have. */
  daysInMonth: number;
  amount: number;
}

const partsOf = (iso: string): [number, number, number] | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

/** Day 0 of the next month is the last day of this one. */
const daysIn = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * Null when there is nothing to apportion — no date, a malformed one, or a
 * move-in on the 1st, which is a whole month and bills as one.
 */
export function proRateFirstMonth(
  monthlyRent: number,
  movedInAt: string | null | undefined,
): ProRate | null {
  if (!movedInAt) return null;
  const parts = partsOf(movedInAt);
  if (!parts) return null;

  const [year, month, day] = parts;
  if (day <= 1) return null;

  const daysInMonth = daysIn(year, month);
  if (day > daysInMonth) return null;

  const daysOccupied = daysInMonth - day + 1;
  const rent = Number.isFinite(monthlyRent) && monthlyRent > 0 ? monthlyRent : 0;

  return {
    daysOccupied,
    daysInMonth,
    // Rounded to the sen, matching round(..., 2) in the generator.
    amount: Math.round(((rent * daysOccupied) / daysInMonth) * 100) / 100,
  };
}
