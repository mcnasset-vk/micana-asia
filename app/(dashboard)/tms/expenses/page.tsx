import { ModuleGuard } from "@/components/views/ModuleGuard";
import { TmsExpensesView } from "@/components/views/TmsExpensesView";
import { TmsModule } from "@/components/views/TmsModule";

export default function TmsExpensesPage() {
  return (
    <ModuleGuard module="tms">
      <TmsModule>
        <TmsExpensesView />
      </TmsModule>
    </ModuleGuard>
  );
}
