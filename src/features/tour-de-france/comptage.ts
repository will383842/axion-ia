/**
 * Tour France IA : compter les demandes par ville, sans doublon (PR-2a).
 *
 * « 5 demandes ouvrent une ville » : le compteur doit être HONNÊTE. Une demande ne compte pas si :
 *   · la même personne a déjà demandé pour cette ville (clé `ville:empreinte de l'adresse`) ;
 *   · une autre personne de la même entreprise a déjà demandé (clé `ville:empreinte du domaine`,
 *     domaine PROFESSIONNEL seulement : deux adresses gmail sont deux personnes) ;
 *   · le même téléphone a déjà demandé (clé `ville:empreinte des 9 derniers chiffres`).
 *
 * Les clés sont posées sur la ligne et rendues UNIQUES par la base : deux demandes simultanées ne
 * passent pas toutes les deux (la seconde reçoit une erreur d'unicité et devient un « doublon »,
 * voir `enregistrer.ts`). Ce module ne fait que fabriquer les clés et mettre le compteur en forme.
 *
 * Chaque clé est `ville:HMAC` (voir `chiffrement.ts`) : ni adresse, ni domaine, ni numéro lisible.
 * La clé « personne » est calculée sur l'adresse RAMENÉE à sa forme canonique (`adressePourCle` :
 * sans « +étiquette », sans points chez gmail) : `alice+1@…` et `alice+2@…` sont la même personne.
 *
 * Le seuil d'affichage et le plafond d'une ville sont des constantes réglables. Les fonctions de
 * clé ne lisent que la variable d'environnement `PII_ENCRYPTION_KEY`.
 */

import { domaineDe, natureAdresse } from "@/lib/email/nature-adresse";
import {
  LIBELLE_CLE_DOMAINE,
  LIBELLE_CLE_PERSONNE,
  LIBELLE_CLE_TELEPHONE,
  empreinteTour,
} from "./chiffrement";
import { CLE_VILLE_DU_SIEGE, normaliserSaisieVille } from "./villes";

/** Le compteur public ne montre une ville qu'à partir de ce nombre de demandes comptées. */
export const SEUIL_AFFICHAGE_COMPTEUR = 3;

/** Le nombre de demandes qui ouvre une ville : le texte ne dépasse jamais « 5 sur 5 ». */
export const SEUIL_PAR_VILLE = 5;

/** Au plus ce nombre de villes dans le compteur public. */
export const MAX_LIGNES_COMPTEUR = 6;

export interface EntreeCles {
  readonly villeCle: string;
  /** L'adresse normalisée (minuscules). */
  readonly email: string;
  /**
   * Les 9 derniers chiffres du téléphone, ou `null` (jamais stockés : seulement pour la clé). Les
   * demandes de l'étape 1 n'en ont plus (le téléphone vient à l'étape 2) : toujours `null`.
   */
  readonly telephoneFin: string | null;
}

/**
 * L'adresse sous sa forme canonique, pour la clé « une demande par personne » : minuscules, sans
 * « +étiquette » dans la partie locale, sans points chez gmail ; `googlemail.com` vaut `gmail.com`.
 * Ne sert QU'À la clé : l'adresse enregistrée et l'empreinte de recherche restent celles saisies.
 * PUR.
 */
export function adressePourCle(email: string): string {
  const adresse = email.trim().toLowerCase();
  const arobase = adresse.lastIndexOf("@");
  if (arobase < 1) return adresse;
  let local = adresse.slice(0, arobase);
  let domaine = adresse.slice(arobase + 1);
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (domaine === "googlemail.com") domaine = "gmail.com";
  if (domaine === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domaine}`;
}

export interface ClesComptage {
  readonly personne: string | null;
  readonly domaine: string | null;
  readonly telephone: string | null;
}

/**
 * Les clés de comptage d'une demande. Une clé absente (`null`) ne bloque rien : depuis le 29/10, la
 * clé téléphone est toujours `null` (le téléphone n'est plus demandé à la mini-demande).
 */
export function clesDeComptage(e: EntreeCles): ClesComptage {
  const adresse = adressePourCle(e.email);
  const pro = natureAdresse(adresse) === "pro";
  const domaine = pro ? domaineDe(adresse) : "";
  return {
    personne:
      adresse !== "" ? `${e.villeCle}:${empreinteTour(LIBELLE_CLE_PERSONNE, adresse)}` : null,
    domaine: domaine !== "" ? `${e.villeCle}:${empreinteTour(LIBELLE_CLE_DOMAINE, domaine)}` : null,
    telephone:
      e.telephoneFin !== null
        ? `${e.villeCle}:${empreinteTour(LIBELLE_CLE_TELEPHONE, e.telephoneFin)}`
        : null,
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
    // La ville du siège ne s'affiche jamais, même si quelqu'un la tape.
    if (
      g.villeCle === CLE_VILLE_DU_SIEGE ||
      normaliserSaisieVille(g.villeNom) === CLE_VILLE_DU_SIEGE
    )
      continue;
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
