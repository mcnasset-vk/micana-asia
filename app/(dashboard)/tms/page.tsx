import { ModuleGuard } from "@/components/views/ModuleGuard";
import { TmsModule } from "@/components/views/TmsModule";

export default function TmsPage() {
  return (
    <ModuleGuard module="tms">
      <TmsModule />
    </ModuleGuard>
  );
}
