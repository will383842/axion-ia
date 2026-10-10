/**
 * La pastille d'étape d'une personne (Candidatures unifiées L8a) — composant
 * SERVEUR. Le mot vient de `features/etapes/etapes.ts`, dans le vocabulaire du
 * monde de la personne ; la précision s'écrit en petit dessous.
 */

import { AdminBadge } from "@/components/admin/ui";
import type { Etape } from "@/features/etapes/etapes";

export function PastilleEtape({ etape }: { etape: Etape }): React.ReactElement {
  return (
    <span className="admin-pastille-etape">
      <AdminBadge tone={etape.ton}>{etape.libelle}</AdminBadge>
      {etape.precision ? <span className="admin-meta-small">{etape.precision}</span> : null}
    </span>
  );
}
