"use client";

import Link from "next/link";

import { useDashboard } from "@/components/providers/DashboardProvider";
import { IconShield } from "@/components/ui/icons";
import { CFG_INTERNAL_DASHBOARD_URL } from "@/lib/config";

/**
 * Shown to staff who sign in here.
 *
 * This deployment is the tenant-facing address: a tenant checks what they owe
 * and pays it, a landlord sees their own units. The agent screens — the
 * portfolio, the records behind it, expenses, meters — and user administration
 * live on the internal dashboard instead, against this same database.
 *
 * It is not a security boundary and does not pretend to be one. Row level
 * security decides what any account can read and answers the same on both
 * addresses; an agent who signs in here has lost no privilege, only a set of
 * screens that are not published at this URL. The point is that the public
 * address serves one audience, so there is no management surface on it to
 * find.
 */
export function StaffElsewhere() {
  const { profile } = useDashboard();

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-14 text-center shadow-sm">
      <span className="rounded-full border border-line bg-surface-3 p-3 text-ink-subtle">
        <IconShield className="size-6" />
      </span>
      <h1 className="font-display text-xl font-semibold text-ink">
        This is the tenant site
      </h1>
      <p className="text-sm text-ink-muted">
        {profile.fullName} is staff, and the management screens are not
        published here. They are on the internal dashboard, which reads the
        same database — nothing is out of date and nothing needs syncing.
      </p>
      {CFG_INTERNAL_DASHBOARD_URL ? (
        <Link
          href={CFG_INTERNAL_DASHBOARD_URL}
          className="mt-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          Open the internal dashboard
        </Link>
      ) : null}
      <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-subtle">
        Signing out and back in changes nothing — it is the address that
        differs, not your access.
      </p>
    </div>
  );
}
