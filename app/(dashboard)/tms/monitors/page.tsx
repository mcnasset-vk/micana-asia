import { ModuleGuard } from "@/components/views/ModuleGuard";
import { TmsModule } from "@/components/views/TmsModule";
import { TmsMonitorsView } from "@/components/views/TmsMonitorsView";

export default function TmsMonitorsPage() {
  return (
    <ModuleGuard module="tms">
      <TmsModule>
        <TmsMonitorsView />
      </TmsModule>
    </ModuleGuard>
  );
}
