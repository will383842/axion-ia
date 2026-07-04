import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";

export const dynamic = "force-dynamic";

export default function DoublonsPage() {
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Revue des doublons"
        description="Anti-doublon fort par SIREN/SIRET (aucune fusion auto). Cette file ne contient QUE les quasi-doublons SANS SIREN (contacts scrapés isolés) à valider manuellement — jamais de fusion silencieuse."
      />
      <AdminEmptyState
        title="Aucun doublon à arbitrer"
        description="Les entreprises sont dédupliquées par SIREN (upsert) ; les succursales sont des établissements, pas des doublons."
      />
    </AdminPageShell>
  );
}
