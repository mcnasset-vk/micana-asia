/**
 * A ringgit figure written out in words.
 *
 * Lifted out of the invoice generator, which is where it started and which
 * this repository does not carry. The tenancy agreement needs it for the same
 * reason an invoice does: a figure that governs a contract is written in both
 * numerals and words, so a disputed digit has a second reading to check.
 *
 * Pure arithmetic — no React, no database, no configuration.
 */

const ONES = [
  "", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
  "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN",
  "SEVENTEEN", "EIGHTEEN", "NINETEEN",
];
const TENS = [
  "", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY",
  "NINETY",
];
const SCALES = ["", " THOUSAND", " MILLION", " BILLION"];

function underThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} HUNDRED`);
  if (rest < 20) {
    if (rest) parts.push(ONES[rest]);
  } else {
    const tail = ONES[rest % 10];
    parts.push(TENS[Math.floor(rest / 10)] + (tail ? ` ${tail}` : ""));
  }
  return parts.join(" ");
}

export function inWords(n: number): string {
  let remaining = Math.floor(Math.abs(n));
  if (remaining === 0) return "ZERO";
  const groups: string[] = [];
  let scale = 0;
  while (remaining > 0 && scale < SCALES.length) {
    const chunk = remaining % 1000;
    if (chunk) groups.unshift(underThousand(chunk) + SCALES[scale]);
    remaining = Math.floor(remaining / 1000);
    scale += 1;
  }
  return groups.join(" ");
}

/** "RINGGIT MALAYSIA : FIVE HUNDRED FIFTEEN ONLY" */
export function ringgitInWords(amount: number): string {
  const whole = Math.floor(amount);
  const sen = Math.round((amount - whole) * 100);
  const senPart = sen > 0 ? ` AND SEN ${inWords(sen)}` : "";
  return `RINGGIT MALAYSIA : ${inWords(whole)}${senPart} ONLY`;
}
