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
