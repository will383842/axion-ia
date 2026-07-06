// Helpers d'affichage purs pour les avis (nom auteur public, ligne méta).
// Fichier PUR — importable client ET serveur, sans dépendance DB.

import { clientSectorLabel } from "@/content/sectors";

export interface ReviewDisplayFields {
  authorFirstName: string;
  authorLastInitial: string;
  companyName?: string | null;
  clientSector?: string | null;
  cityName?: string | null;
}

/** Identité publique : prénom + initiale (ex. "Marie D."). */
export function reviewAuthorName(
  r: Pick<ReviewDisplayFields, "authorFirstName" | "authorLastInitial">,
): string {
  return `${r.authorFirstName} ${r.authorLastInitial}`.trim();
}

/** Ligne méta : entreprise · secteur · ville (parties disponibles). */
export function reviewMetaLine(r: ReviewDisplayFields): string {
  return [r.companyName, r.clientSector ? clientSectorLabel(r.clientSector) : null, r.cityName]
    .filter((v): v is string => Boolean(v))
    .join(" · ");
}
