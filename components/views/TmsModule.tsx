"use client";

import type { ReactNode } from "react";

import { useDashboard } from "@/components/providers/DashboardProvider";

import { TmsAgentView } from "./TmsAgentView";
import { TmsLandlordView } from "./TmsLandlordView";
import { TmsTenantView } from "./TmsTenantView";

/**
 * Picks the TMS page for whoever is signed in, the way MicanaModule picks one
 * from the line.
 *
 * A tenant and a landlord each get their own page wherever they land,
 * including on a direct link to /tms/expenses. Hiding those links in the
 * sidebar is a convenience; this is what makes following one anyway lead
 * somewhere sensible rather than to a management screen holding a single row.
 *
 * `children` — the four agent screens — is only ever reached by an agent or
 * the super admin. Everyone else is diverted above it, so a persona page can
 * never be one navigation away from the screen it replaced.
 */
export function TmsModule({ children }: { children?: ReactNode }) {
  const { profile } = useDashboard();

  if (profile.role === "tms") {
    if (profile.businessLine === "tms_tenant") return <TmsTenantView />;
    if (profile.businessLine === "tms_landlord") return <TmsLandlordView />;
  }

  return <>{children ?? <TmsAgentView />}</>;
}
