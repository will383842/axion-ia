import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import type { EtatHorodatageDevis } from "@/server/qualiopi/devis/console-chaine-devis";

const TON = {
  obtenu: "success",
  attente: "warning",
  echec: "destructive",
  illisible: "warning",
  non_configure: "neutral",
} as const;

/** Pastille « Horodatage : … » (lecture seule). */
export function PastilleHorodatage({ etat }: { etat: EtatHorodatageDevis }): React.ReactElement {
  return (
    <p className="mb-[var(--space-admin-3)]" data-testid="pastille-horodatage">
      <AdminBadge tone={TON[etat.genre]} dot>
        {etat.libelle}
      </AdminBadge>
    </p>
  );
}
