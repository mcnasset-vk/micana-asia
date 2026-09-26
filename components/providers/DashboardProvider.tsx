"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { DashboardData } from "@/lib/data";
import type { ModuleKey, UserProfile } from "@/lib/types";

interface DashboardContextValue {
  /** Records the signed-in user is allowed to see. Filtered by RLS, not here. */
  data: DashboardData;
  /** Today's date, resolved once on the server so SSR and hydration agree. */
  now: string;
  profile: UserProfile;
  isSuperAdmin: boolean;
  /** May use the invoice generator. Super admin always may. */
  canIssueInvoices: boolean;
  /** Mirrors private.micana_is_operator(). Writes are operator-only. */
  isMicanaOperator: boolean;
  /** Mirrors private.tms_is_agent(). Writes are agent-only. */
  isTmsAgent: boolean;
  canView: (module: ModuleKey) => boolean;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({
  data,
  now,
  profile,
  children,
}: {
  data: DashboardData;
  now: string;
  profile: UserProfile;
  children: ReactNode;
}) {
  const value = useMemo<DashboardContextValue>(
    () => ({
      data,
      now,
      profile,
      isSuperAdmin: profile.role === "super_admin",
      canIssueInvoices:
        profile.role === "super_admin" || profile.canIssueInvoices,
      isMicanaOperator:
        profile.role === "super_admin" ||
        (profile.role === "micana" &&
          (profile.businessLine === null ||
            profile.businessLine === "operator")),
      isTmsAgent:
        profile.role === "super_admin" ||
        (profile.role === "tms" &&
          (profile.businessLine === null || profile.businessLine === "agent")),
      // Mirrors private.can_access in the database. This only decides what the
      // interface offers — RLS is what actually enforces it.
      // One division here, so the question is only whether the caller is in
      // it. The group dashboard answers this across six modules; this
      // deployment carries one, and a role that is not tms has nothing to see.
      canView: (module) =>
        profile.role === "super_admin" ||
        (profile.role === "tms" && module === "tms"),
    }),
    [data, now, profile],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used inside <DashboardProvider>");
  }
  return ctx;
}
