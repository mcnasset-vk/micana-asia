import { ModuleGuard } from "@/components/views/ModuleGuard";
import { TmsRoomRentalView } from "@/components/views/TmsRoomRentalView";
import { gatewayConfigured } from "@/lib/payments/gateway";

/**
 * Not wrapped in TmsModule, unlike the four management pages.
 *
 * TmsModule exists to divert a tenant AWAY from screens built for an agent.
 * This screen is built for the tenant, so diverting them off it would send
 * them back to their dashboard the moment they tried to pay.
 *
 * An agent or landlord who follows the link gets the same view rendering their
 * own (empty) charge list, which is honest: there is nothing for them to pay.
 *
 * `returned` is the reference the gateway's return page arrived with. The
 * view looks it up in the ledger; the URL proves nothing by itself.
 */
export default async function TmsPayPage({
  searchParams,
}: {
  searchParams: Promise<{ returned?: string }>;
}) {
  const { returned = "" } = await searchParams;

  return (
    <ModuleGuard module="tms">
      <TmsRoomRentalView online={gatewayConfigured()} returned={returned} />
    </ModuleGuard>
  );
}
