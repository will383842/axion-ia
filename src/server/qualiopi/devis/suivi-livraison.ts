/**
 * Suivi du devis après signature — « à contresigner » / « en livraison » /
 * « livré ». Fonctions PURES : l'étape est DÉDUITE de `statut` et des deux
 * jalons `livraison_debut_at` / `livre_at` (colonnes de la migration
 * 20261104120000_devis_formules). Aucune valeur d'énumération Prisma ajoutée.
 */

/** Un devis livré sort de la vue au-delà de cette fenêtre (pas des données). */
export const FENETRE_LIVRES_JOURS = 30;

export type EtapeSuiviDevis = "a_contresigner" | "en_livraison" | "livre";

export interface DevisPourSuivi {
  statut: string;
  aContresigner?: boolean;
  livraisonDebutAt?: Date | null;
  livreAt?: Date | null;
}

const STATUTS_ACCEPTES = ["accepte", "transforme_convention"] as const;

function estAccepte(statut: string): boolean {
  return (STATUTS_ACCEPTES as readonly string[]).includes(statut);
}

export function etapeSuiviDevis(d: DevisPourSuivi, maintenant: Date): EtapeSuiviDevis | null {
  if (d.aContresigner === true && (d.statut === "envoye" || d.statut === "expire")) {
    return "a_contresigner";
  }
  if (!estAccepte(d.statut) || !d.livraisonDebutAt) return null;
  if (!d.livreAt) return "en_livraison";
  const ageMs = maintenant.getTime() - d.livreAt.getTime();
  return ageMs <= FENETRE_LIVRES_JOURS * 24 * 60 * 60 * 1000 ? "livre" : null;
}

export function peutDemarrerLivraison(d: DevisPourSuivi): boolean {
  return d.statut === "accepte" && !d.livraisonDebutAt;
}

export function peutMarquerLivre(d: DevisPourSuivi): boolean {
  return estAccepte(d.statut) && !!d.livraisonDebutAt && !d.livreAt;
}
