"use client";

import Link from "next/link";

import { signOut } from "@/app/login/actions";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { BUSINESS_LINE_LABELS, ROLE_LABELS } from "@/lib/types";

/** Signed-in identity, a way into account settings, and sign out. */
export function UserMenu() {
  const { profile, isSuperAdmin } = useDashboard();

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/account"
        title="Account settings"
        className="hidden rounded-lg px-2 py-1 text-right transition hover:bg-surface-3 sm:block"
      >
        <span className="block text-xs font-medium leading-tight text-ink">
          {profile.fullName}
        </span>
        <span className="block text-[0.6875rem] leading-tight text-ink-subtle">
          {isSuperAdmin
            ? "Super Admin"
            : profile.businessLine
              ? BUSINESS_LINE_LABELS[profile.businessLine]
              : ROLE_LABELS[profile.role]}
        </span>
      </Link>

      <Link
        href="/account"
        className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-muted transition hover:bg-surface-3 hover:text-ink sm:hidden"
      >
        Account
      </Link>

      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-muted transition hover:bg-surface-3 hover:text-ink"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
