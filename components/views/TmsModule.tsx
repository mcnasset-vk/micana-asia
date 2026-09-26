"use client";

import { StaffElsewhere } from "@/components/layout/StaffElsewhere";
import { useDashboard } from "@/components/providers/DashboardProvider";

import { TmsLandlordView } from "./TmsLandlordView";
import { TmsTenantView } from "./TmsTenantView";

/**
 * Picks the page for whoever is signed in.
 *
 * Two audiences are published at this address and no others: the tenant who
 * lives in a room, and the landlord who owns units. Each gets their own page
 * wherever they land, including on a direct link, which is what makes
 * following an old bookmark lead somewhere sensible.
 *
 * Everyone else — an agent, the super admin, a member of another division —
 * gets the notice. There is no `children` to fall through to any more: the
 * agent screens are not part of this deployment, so there is nothing here for
 * a management persona to be shown. That is the whole point of the split. The
 * screens are on the internal dashboard, against this same database.
 */
export function TmsModule() {
  const { profile } = useDashboard();

  if (profile.role === "tms") {
    if (profile.businessLine === "tms_tenant") return <TmsTenantView />;
    if (profile.businessLine === "tms_landlord") return <TmsLandlordView />;
  }

  return <StaffElsewhere />;
}
