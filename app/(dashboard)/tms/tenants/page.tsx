import { ModuleGuard } from "@/components/views/ModuleGuard";
import { TmsModule } from "@/components/views/TmsModule";
import { TmsTenantManagementView } from "@/components/views/TmsTenantManagementView";

export default function TmsTenantsPage() {
  return (
    <ModuleGuard module="tms">
      {/* TmsModule sends a tenant to their own page rather than here, even on
          a direct link. */}
      <TmsModule>
        <TmsTenantManagementView />
      </TmsModule>
    </ModuleGuard>
  );
}
