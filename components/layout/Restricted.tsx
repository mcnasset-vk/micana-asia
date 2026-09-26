"use client";

import Link from "next/link";

import { useDashboard } from "@/components/providers/DashboardProvider";
import { IconLock } from "@/components/ui/icons";
import { BUSINESS_LINE_LABELS, ROLE_LABELS } from "@/lib/types";

/**
 * Access notice. This is a UI courtesy only — the real guard is row-level
 * security in Postgres, so a scoped user cannot read another division's rows
 * even by calling the API directly.
 */
export function Restricted() {
  const { profile } = useDashboard();
  const ownLine = profile.businessLine;
  // Someone holding a whole division has no single line to name, so fall back
  // to the division itself rather than saying "a single module".
  const scope = ownLine
    ? BUSINESS_LINE_LABELS[ownLine]
    : profile.role === "mdna" || profile.role === "mec"
      ? `the ${ROLE_LABELS[profile.role]} division`
      : null;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-14 text-center shadow-sm">
      <span className="rounded-full border border-line bg-surface-3 p-3 text-ink-subtle">
        <IconLock className="size-6" />
      </span>
      <h1 className="font-display text-xl font-semibold text-ink">
        Not your section
      </h1>
      <p className="text-sm text-ink-muted">
        {profile.fullName} is scoped to{" "}
        <strong className="text-ink">{scope ?? "no section yet"}</strong> and
        cannot view this one.
      </p>
      {scope ? (
        <Link
          href="/"
          className="mt-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          Go to my dashboard
        </Link>
      ) : null}
      <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-subtle">
        This restriction is enforced by the database, not just this screen.
      </p>
    </div>
  );
}
