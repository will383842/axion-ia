/**
 * Écran « Pilotage SEO & IA », onglet Requêtes : regroupement par requête. Module PUR.
 */
import { positionMoyenne } from "../donnees/agregats";
import { classerIntention, type Intention } from "../opportunites/intention";

/**
 * Sous ce seuil d'impressions sur la période, une requête n'est pas affichée : une requête
 * rare peut contenir un nom de personne ou une donnée personnelle (cf. `donnees/personnel.ts`).
 */
export const PLANCHER_IMPRESSIONS_REQUETE = 3;

export interface LigneRequetePage {
  readonly requete: string;
  readonly chemin: string;
  readonly impressions: number;
  readonly clics: number;
  readonly positionSum: number;
}

export interface LigneRequeteEcran {
  readonly requete: string;
  readonly intention: Intention;
  readonly impressions: number;
  readonly clics: number;
  readonly position: number | null;
  readonly pageProprietaire: string;
  readonly nbPages: number;
  /** Plusieurs pages du site se disputent la même requête. */
  readonly cannibalisation: boolean;
}

export function composerRequetes(lignes: ReadonlyArray<LigneRequetePage>): LigneRequeteEcran[] {
  const parRequete = new Map<string, LigneRequetePage[]>();
  for (const l of lignes) {
    const liste = parRequete.get(l.requete);
    if (liste) liste.push(l);
    else parRequete.set(l.requete, [l]);
  }
  const sortie: LigneRequeteEcran[] = [];
  for (const [requete, pages] of parRequete) {
    const impressions = pages.reduce((s, p) => s + p.impressions, 0);
    if (impressions < PLANCHER_IMPRESSIONS_REQUETE) continue;
    const proprio = pages.reduce((a, b) => (b.impressions > a.impressions ? b : a));
    const avecImpressions = pages.filter((p) => p.impressions > 0).length;
    sortie.push({
      requete,
      intention: classerIntention(requete).intention,
      impressions,
      clics: pages.reduce((s, p) => s + p.clics, 0),
      position: positionMoyenne(
        pages.reduce((s, p) => s + p.positionSum, 0),
        impressions,
      ),
      pageProprietaire: proprio.chemin,
      nbPages: pages.length,
      cannibalisation: avecImpressions > 1,
    });
  }
  return sortie.sort((a, b) => b.impressions - a.impressions || a.requete.localeCompare(b.requete));
}
