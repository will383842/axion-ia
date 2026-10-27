/**
 * Tour France IA : compter les demandes par ville, sans doublon (PR-2a).
 *
 * « 5 demandes ouvrent une ville » : le compteur doit être HONNÊTE. Une demande ne compte pas si :
 *   · la même personne a déjà demandé pour cette ville (clé `ville:empreinte de l'e-mail`) ;
 *   · une autre personne de la même entreprise a déjà demandé (clé `ville:domaine`, domaine
 *     PROFESSIONNEL seulement : deux adresses gmail sont deux personnes) ;
 *   · le même téléphone a déjà demandé (clé `ville:9 derniers chiffres`).
 *
 * Les clés sont posées sur la ligne et rendues UNIQUES par la base : deux demandes simultanées ne
 * passent pas toutes les deux (la seconde reçoit une erreur d'unicité et devient un « doublon »,
 * voir `enregistrer.ts`). Ce module ne fait que fabriquer les clés et mettre le compteur en forme.
 *
 * Module PUR : le seuil d'affichage et le plafond d'une ville sont des constantes réglables.
 */

import { domaineDe, natureAdresse } from "@/lib/email/nature-adresse";

/** Le compteur public ne montre une ville qu'à partir de ce nombre de demandes comptées. */
export const SEUIL_AFFICHAGE_COMPTEUR = 3;

/** Le nombre de demandes qui ouvre une ville : le texte ne dépasse jamais « 5 sur 5 ». */
export const SEUIL_PAR_VILLE = 5;

/** Au plus ce nombre de villes dans le compteur public. */
export const MAX_LIGNES_COMPTEUR = 6;

/** Longueur maximale du domaine dans une clé (colonne `cle_comptage_domaine`). */
const LONGUEUR_MAX_DOMAINE = 253;

export interface EntreeCles {
  readonly villeCle: string;
  /** `hashEmailForLookup(email)`. */
  readonly emailHash: string | null;
  /** L'adresse normalisée (minuscules). */
  readonly email: string;
  /** Les 9 derniers chiffres du téléphone, ou `null`. */
  readonly telephoneFin: string | null;
}

export interface ClesComptage {
  readonly personne: string | null;
  readonly domaine: string | null;
  readonly telephone: string | null;
}

/** Les trois clés de comptage d'une demande. Une clé absente (`null`) ne bloque rien. PUR. */
export function clesDeComptage(e: EntreeCles): ClesComptage {
  const pro = natureAdresse(e.email) === "pro";
  const domaine = pro ? domaineDe(e.email).slice(0, LONGUEUR_MAX_DOMAINE) : "";
  return {
    personne: e.emailHash !== null ? `${e.villeCle}:${e.emailHash}` : null,
    domaine: domaine !== "" ? `${e.villeCle}:${domaine}` : null,
    telephone: e.telephoneFin !== null ? `${e.villeCle}:${e.telephoneFin}` : null,
  };
}

/** Un groupe de demandes comptées pour une ville (résultat d'un `groupBy`). */
export interface GroupeVille {
  readonly villeCle: string;
  /** Nom du référentiel, ou `null` (ville inconnue ou ambiguë : jamais affichée). */
  readonly villeNom: string | null;
  readonly total: number;
}

export interface LigneCompteur {
  readonly ville: string;
  /** Le nombre de demandes comptées, plafonné à `SEUIL_PAR_VILLE`. */
  readonly total: number;
  /** Le texte prêt à afficher : « Lyon : 3 demandes sur 5 ». */
  readonly texte: string;
}

/**
 * Les lignes du compteur public : les villes qui ont un NOM et au moins `SEUIL_AFFICHAGE_COMPTEUR`
 * demandes comptées, de la plus demandée à la moins demandée (puis par nom), six au plus. PUR.
 */
export function lignesCompteur(groupes: ReadonlyArray<GroupeVille>): LigneCompteur[] {
  const lignes: LigneCompteur[] = [];
  for (const g of groupes) {
    if (g.villeNom === null || g.total < SEUIL_AFFICHAGE_COMPTEUR) continue;
    const total = Math.min(g.total, SEUIL_PAR_VILLE);
    lignes.push({
      ville: g.villeNom,
      total,
      texte: `${g.villeNom} : ${total} demandes sur ${SEUIL_PAR_VILLE}`,
    });
  }
  return lignes
    .sort((a, b) => b.total - a.total || a.ville.localeCompare(b.ville, "fr"))
    .slice(0, MAX_LIGNES_COMPTEUR);
}
