import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { ExportPanel } from "./ExportPanel";

export const dynamic = "force-dynamic";

export default function ExportsPage() {
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Exports segmentés"
        description="3 fichiers CSV (exploitables / partiels / à compléter) + colonnes de conformité. Re-filtre opt-out + non-diffusible à la génération. Réservé dpo/admin."
      />
      <ExportPanel />
    </AdminPageShell>
  );
}
