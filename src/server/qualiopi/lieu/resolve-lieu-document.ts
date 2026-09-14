/**
 * Qualiopi — Lieu à imprimer sur un document légal.
 *
 * 🔴 Convention, convention tripartite, contrat, feuille d'émargement et lettre
 * de mission écrivaient tous, en dur :
 *
 *     lieu: identite.adresseExercice || identite.adresseSiege || "—"
 *
 * c'est-à-dire l'adresse de l'ORGANISME, quel que soit l'endroit où la formation
 * se déroulait réellement. Pour une intra donnée chez le client — le cas le plus
 * courant — la convention annonçait donc un lieu faux. Le lieu est pourtant une
 * condition de déroulement au sens de l'art. L.6353-1, et l'objet même de
 * l'indicateur Qualiopi 9. La convocation, elle, prévoyait un champ `lieu` que
 * personne n'alimentait : le stagiaire recevait une convocation sans adresse.
 *
 * Ce module tranche en un seul endroit, pour que les cinq pièces d'un même
 * dossier ne puissent plus se contredire.
 *
 * Module PUR — testable sans base.
 */

import { formatLieu, type LieuFields } from "@/server/qualiopi/lieu/format-lieu";

/** Partie de `OrganismeIdentite` utile ici (évite d'importer tout le type). */
export interface AdressesOrganisme {
  adresseExercice?: string;
  adresseSiege?: string;
}

/**
 * Lieu de déroulement à imprimer.
 *
 * Priorité au lieu RÉEL de la session. À défaut — session antérieure à la saisie
 * du lieu, ou lieu laissé vide — on conserve le repli historique sur l'adresse
 * de l'organisme : c'est exact pour une formation donnée dans nos locaux, et le
 * changer rétroactivement ferait diverger les documents déjà remis des documents
 * réémis pour les mêmes sessions.
 */
export function resolveLieuDocument(session: LieuFields, identite: AdressesOrganisme): string {
  const lieuReel = formatLieu(session);
  if (lieuReel !== null) return lieuReel;
  return identite.adresseExercice || identite.adresseSiege || "—";
}

/** Ce qui manque au lieu d'une session pour qu'un document l'imprime vraiment. */
export type DefautLieuDocument = "aucun_lieu" | "sur_site_sans_adresse";

/**
 * 🔴 I17-01 (audit initial Qualiopi, 2026-09-14) — le repli ci-dessus est
 * SILENCIEUX. Une session présentielle ou hybride sans lieu imprime l'adresse de
 * l'organisme sur la convention, la convocation et la feuille d'émargement, et
 * rien ne le signalait. On ne bloque pas l'émission (les documents déjà remis
 * doivent rester réémissibles à l'identique) : on le DIT, par l'alerte
 * `session_sans_lieu`, qui lit ce prédicat.
 *
 * - `aucun_lieu` : EXACTEMENT la condition du repli — `formatLieu` rend `null`.
 *   Le même appel, jamais une seconde liste de champs : deux prédicats jumeaux
 *   divergent au premier changement (verrouillé par le spec voisin) ;
 * - `sur_site_sans_adresse` : pas de repli, mais le document n'imprime que
 *   « Sur site » (éventuellement un intitulé ou une salle) sans dire où.
 *
 * `null` : le lieu imprimé est un vrai lieu — ou « Nos locaux », pour lequel
 * l'adresse de l'organisme est la bonne.
 */
export function defautLieuDocument(session: LieuFields): DefautLieuDocument | null {
  if (formatLieu(session) === null) return "aucun_lieu";
  if (session.lieuType === "sur_site") {
    const rempli = (v: string | null | undefined): boolean => (v ?? "").trim().length > 0;
    if (!rempli(session.lieuAdresse) && !rempli(session.lieuVille)) {
      return "sur_site_sans_adresse";
    }
  }
  return null;
}

/**
 * Variante pour la convocation, dont le champ `lieu` est OPTIONNEL et masqué en
 * distanciel : on ne veut pas y écrire « — », qui afficherait une ligne « Lieu :
 * — » à un stagiaire. `undefined` ⇒ le gabarit n'imprime pas la ligne.
 */
export function resolveLieuConvocation(
  session: LieuFields,
  identite: AdressesOrganisme,
): string | undefined {
  const lieu = resolveLieuDocument(session, identite);
  return lieu === "—" ? undefined : lieu;
}

/** Champs `lieu*` à sélectionner dans une requête Prisma sur `TrainingSession`. */
export const LIEU_DOCUMENT_SELECT = {
  lieuType: true,
  lieuIntitule: true,
  lieuAdresse: true,
  lieuCodePostal: true,
  lieuVille: true,
  lieuSalle: true,
  lieuVisioUrl: true,
} as const;
