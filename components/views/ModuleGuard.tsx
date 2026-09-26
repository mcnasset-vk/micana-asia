"use client";

import { Restricted } from "@/components/layout/Restricted";
import { useDashboard } from "@/components/providers/DashboardProvider";
import type { ModuleKey } from "@/lib/types";

/**
 * Renders children only when the current user may view this section.
 *
 * `"division"` is not a module anyone can be scoped to — it marks a page that
 * spans several business lines, so it is offered only to those who can see all
 * of them: the super admin and MDNA Admin. A single-line CIO would otherwise
 * get zeroes for everything outside their scope, which reads as "nothing is
 * happening" rather than "this is not yours".
 */
export function ModuleGuard({
  module,
  children,
}: {
  module: ModuleKey | "division";
  children: React.ReactNode;
}) {
  const { canView, isSuperAdmin, profile } = useDashboard();

  const allowed =
    module === "division"
      ? isSuperAdmin || profile.role === "mdna"
      : canView(module);

  return allowed ? <>{children}</> : <Restricted />;
}
