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
