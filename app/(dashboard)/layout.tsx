import { redirect } from "next/navigation";

import { DrillDownProvider } from "@/components/drilldown/DrillDownProvider";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardProvider } from "@/components/providers/DashboardProvider";
import { getCurrentProfile, getDashboardData } from "@/lib/data";
import {
  gatewayConfigured,
  reconcileOverdueAttempts,
} from "@/lib/payments/gateway";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/today";

import { PendingAccess } from "./PendingAccess";

// Session-dependent, and "days remaining" must not freeze at build time.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  // proxy.ts normally catches this; the check is repeated here because a
  // signed-in auth user without a profile row still has no role to act on.
  if (!profile) redirect("/login?reason=no-profile");

  // Signed in, but not yet given a scope by the super admin.
  if (profile.role === "pending") return <PendingAccess profile={profile} />;

  // An online payment whose checkout has lapsed and which nobody asked about
  // would hold its months forever: the gateway sends nothing for a session
  // that merely expires. Settled here, before the data is read, so the screen
  // that follows shows the months free again. RLS scopes it to the caller's
  // own attempts; for everyone outside TMS the two queries find nothing.
  if (gatewayConfigured()) {
    await reconcileOverdueAttempts(await createClient()).catch((cause) => {
      console.error("gateway sweep", cause);
    });
  }

  const data = await getDashboardData();

  return (
    <DashboardProvider data={data} now={today()} profile={profile}>
      <DrillDownProvider>
        <AppShell>{children}</AppShell>
      </DrillDownProvider>
    </DashboardProvider>
  );
}
