/**
 * Tenant payment details, read from the environment.
 *
 * Shown to a tenant so they know where to send rent when they pay by bank
 * transfer. These are meant to be handed out — but note they are
 * NEXT_PUBLIC_, so they are compiled into the browser bundle and readable by
 * anyone who loads the site, signed in or not. Use the account you would
 * print on an invoice, not one you would rather keep quiet. Leave blank and
 * the panel tells the tenant to contact the office instead of showing an
 * empty form.
 *
 * Each reference below is written out in full rather than looked up
 * dynamically, because Next.js inlines `process.env.NEXT_PUBLIC_*` at build
 * time only when it can see the literal name. Set them in `.env.local`
 * locally and in the hosting environment for a deployment; `.env.example`
 * lists every name with no values.
 */

function text(raw: string | undefined): string {
  return (raw ?? "").trim();
}

export const CFG_PAY_TO_NAME = text(process.env.NEXT_PUBLIC_PAY_TO_NAME);
export const CFG_PAY_BANK = text(process.env.NEXT_PUBLIC_PAY_BANK);
export const CFG_PAY_ACCOUNT = text(process.env.NEXT_PUBLIC_PAY_ACCOUNT);
export const CFG_PAY_CONTACT = text(process.env.NEXT_PUBLIC_PAY_CONTACT);

/**
 * The same contact, split so a tenant on a phone can tap it.
 *
 * Two values rather than one because a `tel:` link and a `mailto:` link are
 * different things and neither can be derived reliably from a single line of
 * free text. Set either, both, or neither.
 *
 * CFG_PAY_CONTACT above is the fallback and the escape hatch: when neither of
 * these is set it is shown as written, which is what you want for anything
 * that is not a number or an address — an office, a name, a WhatsApp group.
 */
export const CFG_PAY_PHONE = text(process.env.NEXT_PUBLIC_PAY_PHONE);
export const CFG_PAY_EMAIL = text(process.env.NEXT_PUBLIC_PAY_EMAIL);

/**
 * A phone number as `tel:` wants it: digits, and a leading + if the number was
 * written in international form. Spaces, dashes and brackets are how people
 * read a number, not how a dialler takes one.
 *
 * Deliberately not adding a country code. Guessing one and getting it wrong
 * gives a tenant a number that fails silently, which is worse than the local
 * form that works for everybody actually standing in the building.
 */
export function telHref(raw: string): string {
  const plus = raw.trim().startsWith("+") ? "+" : "";
  return `tel:${plus}${raw.replace(/\D/g, "")}`;
}

/**
 * Where staff are sent when they sign in to this tenant-facing deployment.
 *
 * Optional. Set it and StaffElsewhere offers a link; leave it unset and the
 * notice still explains where the management screens are, without one. It is
 * a URL rather than a hardcoded host so that moving the internal dashboard to
 * a custom domain does not mean editing a component.
 */
export const CFG_INTERNAL_DASHBOARD_URL = text(
  process.env.NEXT_PUBLIC_INTERNAL_DASHBOARD_URL,
);
