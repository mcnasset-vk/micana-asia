"use client";

import { Restricted } from "@/components/layout/Restricted";
import { useDashboard } from "@/components/providers/DashboardProvider";

import { TmsModule } from "./TmsModule";

/**
 * The landing page adapts to who is signed in.
 *
 * This deployment carries one division, so the routing is shorter than the
 * dashboard's: TmsModule picks the persona page from the business line — the
 * agent's desk, a landlord's properties, a tenant's own tenancy.
 *
 * The super admin lands on the same module rather than on a summary of
 * everything, because here there is nothing else to summarise.
 *
 * Anyone else is shown the restricted notice rather than an empty dashboard.
 * In the group dashboard a non-TMS role has their own division to land on; in
 * this one they have none, and row level security would answer every query
 * with nothing — which reads as a broken page rather than as "not for you".
 */
export function HomeView() {
  const { profile, isSuperAdmin } = useDashboard();

  if (isSuperAdmin || profile.role === "tms") return <TmsModule />;

  return <Restricted />;
}
