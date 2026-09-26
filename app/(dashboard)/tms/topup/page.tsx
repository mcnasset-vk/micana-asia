import { ModuleGuard } from "@/components/views/ModuleGuard";
import { TmsTopupView } from "@/components/views/TmsTopupView";
import { gatewayConfigured } from "@/lib/payments/gateway";

/** Tenant-facing, so outside TmsModule for the reason given in ../pay. */
export default async function TmsTopupPage({
  searchParams,
}: {
  searchParams: Promise<{ returned?: string }>;
}) {
  const { returned = "" } = await searchParams;

  return (
    <ModuleGuard module="tms">
      <TmsTopupView online={gatewayConfigured()} returned={returned} />
    </ModuleGuard>
  );
}
