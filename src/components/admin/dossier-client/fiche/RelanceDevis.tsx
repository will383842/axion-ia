/**
 * Emplacement du lot B9 : seul ce lot modifie ce fichier.
 * Lot 0 (socle) : relance d'un devis (brouillon garé « à valider ») ; rend null, sans lecture en base.
 */

import type { ContexteFiche } from "./contexte";

export function RelanceDevis(props: {
  ctx: ContexteFiche;
  devis: ReadonlyArray<{
    id: string;
    numero: string;
    statut: string;
    montantTotalHtCents: number;
    createdAt: Date;
  }>;
}): React.ReactElement | null {
  void props;
  return null;
}
