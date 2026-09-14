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
  return repliOrganisme(identite);
}

/**
 * Le repli lui-même — l'adresse de l'organisme. Une seule expression, lue par
 * `resolveLieuDocument` pour IMPRIMER et par `pieceImprimeRepliOrganisme` pour
 * RECONNAÎTRE une pièce qui l'a imprimé : les deux ne peuvent pas diverger.
 */
function repliOrganisme(identite: AdressesOrganisme): string {
  return identite.adresseExercice || identite.adresseSiege || "—";
}

/** Ce qui manque au lieu d'une session pour qu'un document l'imprime vraiment. */
export type DefautLieuDocument = "aucun_lieu" | "lieu_sans_adresse";

const rempli = (v: string | null | undefined): boolean => (v ?? "").trim().length > 0;

/**
 * 🔴 I17-01 (audit initial Qualiopi, 2026-09-14) — le repli ci-dessus imprime
 * l'adresse de l'organisme sur la convention, la convocation et la feuille
 * d'émargement d'une session sans lieu. Ce prédicat dit QUAND la pièce ne dit
 * pas où se tient la formation. Il est lu par le refus d'émettre
 * (`refusEmissionLieu`) et par l'alerte `session_sans_lieu`.
 *
 * - `aucun_lieu` : EXACTEMENT la condition du repli — `formatLieu` rend `null`.
 *   Le même appel, jamais une seconde liste de champs : deux prédicats jumeaux
 *   divergent au premier changement (verrouillé par le spec voisin) ;
 * - `lieu_sans_adresse` : pas de repli, mais la pièce n'imprime ni adresse ni
 *   ville — « Sur site », « Salle B2 », un intitulé, un code postal seul. Le
 *   critère vaut avec ou sans `lieuType` (relecture #1086, constat 3).
 *
 * `null` : le lieu imprimé dit où — une adresse ou une ville —, ou il n'a pas à
 * le dire : « Nos locaux » (l'adresse de l'organisme y est la bonne) et
 * « Distanciel » (le lien manquant relève de `session_distanciel_sans_lien`).
 * Sans type, un lien de visio seul s'imprime « Distanciel — hôte » : même cas.
 */
export function defautLieuDocument(session: LieuFields): DefautLieuDocument | null {
  if (formatLieu(session) === null) return "aucun_lieu";
  if (session.lieuType === "nos_locaux" || session.lieuType === "distanciel") return null;
  if (rempli(session.lieuAdresse) || rempli(session.lieuVille)) return null;
  const seulementUnLien =
    session.lieuType == null &&
    !rempli(session.lieuIntitule) &&
    !rempli(session.lieuCodePostal) &&
    !rempli(session.lieuSalle);
  return seulementUnLien ? null : "lieu_sans_adresse";
}

/**
 * 🔴 I17-01, relecture #1086 constat 1 — REFUSER la pièce qui mentirait.
 *
 * L'alerte seule laissait la pièce fausse NAÎTRE puis rester au dossier : un
 * auditeur qui compare la convention à la réalité de la session la trouvait.
 * Chaque point qui imprime ce lieu (producteurs, tirage d'émargement,
 * autorisation de captation) appelle donc ce refus avant de générer — garde
 * statique : `emission-refusee-sans-lieu.spec.ts`.
 *
 * Rend le MOTIF à afficher (l'action le renvoie en `error`, le worker le
 * journalise), ou `null` si la pièce peut être émise.
 *
 * ⛔ DÉCISION DE WILL (2026-09-14) : le refus ne vise QUE les sessions en
 * PRÉSENTIEL ou HYBRIDES. Une session 100 % DISTANCIELLE n'est jamais refusée
 * ici — ni alertée par `session_sans_lieu` —, même sans aucun champ de lieu ; son
 * manque (le lien) a son alerte propre. Une session sans lieu « dans nos
 * locaux » se débloque en un geste : choisir « Nos locaux ».
 *
 * ⚠️ Ce refus ne touche AUCUNE pièce déjà émise : il empêche d'en produire une
 * nouvelle, fausse. Les pièces vivantes déjà fausses restent signalées par
 * l'alerte, jusqu'à leur annulation (`pieceImprimeRepliOrganisme`).
 */
export function refusEmissionLieu(
  session: LieuFields & { modalite: "presentiel" | "distanciel" | "hybride" },
): string | null {
  if (session.modalite === "distanciel") return null;
  const defaut = defautLieuDocument(session);
  if (defaut === "aucun_lieu") {
    return "Émission refusée : la session n'a aucun lieu de déroulement, et la pièce imprimerait à la place l'adresse de l'organisme. Sur la fiche de session, choisissez le type de lieu — « Nos locaux », « Sur site » avec l'adresse et la ville du client, ou « Distanciel » —, puis relancez la génération.";
  }
  if (defaut === "lieu_sans_adresse") {
    return "Émission refusée : le lieu de la session n'a ni adresse ni ville, et la pièce ne dirait pas où se tient la formation. Sur la fiche de session, saisissez l'adresse et la ville du lieu (ou choisissez « Nos locaux »), puis relancez la génération.";
  }
  return null;
}

/**
 * Types de pièces qui IMPRIMENT le lieu de déroulement par `resolveLieuDocument`
 * ou `resolveLieuConvocation`. Lu par l'alerte pour retrouver les pièces déjà
 * émises sur le repli. Tenu à jour avec la garde `emission-refusee-sans-lieu`.
 */
export const TYPES_PIECES_AVEC_LIEU = [
  "convention",
  "convention_tripartite",
  "contrat",
  "convocation",
  "emargement",
  "programme",
  "organisation_action",
  "autorisation_captation",
] as const;

/**
 * 🔴 I17-01, relecture #1086 constat 1 — une pièce DÉJÀ émise a-t-elle imprimé
 * l'adresse de l'organisme faute de lieu ?
 *
 * Lit l'instantané de rendu que `generateDocument` pose dans
 * `metadata.renderData` : le `lieu` imprimé ET l'`identite` de l'organisme au
 * moment de l'émission. La pièce a imprimé le repli si et seulement si son lieu
 * est exactement `repliOrganisme(identite figée)` — la même expression que
 * celle qui l'a produit, et l'identité d'alors, pas celle d'aujourd'hui.
 *
 * ⚠️ LIMITE : une pièce sans instantané (émise avant le 2026-07-30, commit
 * `fd9ca9b72`) est indétectable sans schéma, et rend `false`. Une convocation
 * émise sans aucune adresse connue n'a pas imprimé de ligne : `false` aussi.
 */
export function pieceImprimeRepliOrganisme(metadata: unknown): boolean {
  const objet = (v: unknown): Record<string, unknown> | null =>
    typeof v === "object" && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  const renderData = objet(objet(metadata)?.["renderData"]);
  const data = objet(renderData?.["data"]);
  const identite = objet(renderData?.["identite"]);
  const lieu = data?.["lieu"];
  if (typeof lieu !== "string" || identite === null) return false;
  const lire = (cle: string): string | undefined =>
    typeof identite[cle] === "string" ? (identite[cle] as string) : undefined;
  const adresseExercice = lire("adresseExercice");
  const adresseSiege = lire("adresseSiege");
  const repli = repliOrganisme({
    ...(adresseExercice !== undefined ? { adresseExercice } : {}),
    ...(adresseSiege !== undefined ? { adresseSiege } : {}),
  });
  return repli !== "—" && lieu === repli;
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
