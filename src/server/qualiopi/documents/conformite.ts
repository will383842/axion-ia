/**
 * Qualiopi — Garde-fous de conformité documentaire.
 *
 * Problème résolu : l'identité de l'organisme (SIRET, NDA, adresse du siège…)
 * est lue depuis `SiteSetting` (cat. qualiopi) avec des défauts VIDES. Les
 * templates faisaient `{identite.siret ? <FieldRow/> : null}` → un identifiant
 * obligatoire absent DISPARAISSAIT en silence, produisant un document légal
 * non conforme qui passait quand même les tests.
 *
 * Ce module bloque la génération des documents À VALEUR JURIDIQUE / FISCALE
 * (facture, convention, convention tripartite, contrat) si un champ obligatoire
 * de l'OF est vide. Les documents internes (attestations, kits, suivi) ne sont
 * PAS bloqués : leurs templates signalent visuellement l'absence via
 * `FieldRow required` (« Non renseigné » en rouge) plutôt que de la masquer.
 *
 * Pur (aucun accès DB) — testable unitairement.
 */

import type { DocumentType } from "../../../../prisma/generated/client";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

/** Champs d'identité OF susceptibles d'être exigés. */
type ChampIdentite = "raisonSociale" | "siret" | "nda" | "qualiopi" | "adresseSiege";

/** Libellés humains pour les messages d'erreur. */
const LABELS: Record<ChampIdentite, string> = {
  raisonSociale: "raison sociale",
  siret: "SIRET",
  nda: "numéro de déclaration d'activité (NDA)",
  qualiopi: "numéro de certification Qualiopi",
  adresseSiege: "adresse du siège",
};

/**
 * Champs obligatoires par type de document. Seuls les documents engageant
 * juridiquement ou fiscalement l'OF sont listés (les autres ne sont pas
 * bloquants). Source : art. L441-9 C. com. (facture B2B), art. 242 nonies A
 * CGI, art. L.6353-1/-2 C. trav. (convention/contrat).
 */
const CHAMPS_OBLIGATOIRES: Partial<Record<DocumentType, ChampIdentite[]>> = {
  // Facture : mentions vendeur obligatoires (identité + adresse + SIRET).
  facture: ["raisonSociale", "siret", "nda", "adresseSiege"],
  // Convention / contrat : identité de l'OF prestataire.
  //
  // 🔴 `qualiopi` a été RETIRÉ de ces trois listes (audit certification
  // 2026-07-25). Motif : le numéro de certification n'est pas une mention
  // obligatoire de la convention ou du contrat de formation — les art.
  // L.6353-1/-2 C. trav. en régissent le CONTENU (nature, durée, effectif,
  // prix, modalités), pas la certification du prestataire. Qualiopi conditionne
  // l'accès aux FONDS MUTUALISÉS (OPCO, CPF, France Travail), ce que l'OPCO
  // vérifie de son côté.
  //
  // L'exiger ici créait une impasse : l'arrêté du 6 juin 2019 impose d'avoir
  // mis en œuvre une action de formation pour déclencher l'audit initial ;
  // délivrer cette action suppose une convention ; la convention était refusée
  // faute d'un numéro qui n'existe qu'APRÈS la certification. Un organisme
  // nouvellement créé ne pouvait donc jamais démarrer.
  //
  // Le numéro reste imprimé sur les documents dès qu'il est renseigné
  // (cf. `QualiopiPage`, en-tête et pied de page).
  convention: ["raisonSociale", "siret", "nda", "adresseSiege"],
  convention_tripartite: ["raisonSociale", "siret", "nda", "adresseSiege"],
  contrat: ["raisonSociale", "siret", "nda", "adresseSiege"],
};

/** Un champ est « renseigné » s'il est une chaîne non vide après trim. */
function estRenseigne(valeur: string | undefined): boolean {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

/**
 * Retourne la liste des champs obligatoires MANQUANTS pour ce type de document
 * (libellés humains). Vide = conforme. Ne lève jamais.
 */
export function champsIdentiteManquants(identite: OrganismeIdentite, type: DocumentType): string[] {
  const requis = CHAMPS_OBLIGATOIRES[type];
  if (!requis) return [];
  return requis.filter((champ) => !estRenseigne(identite[champ])).map((champ) => LABELS[champ]);
}

/** `true` si le type de document est soumis au garde-fou bloquant. */
export function exigeIdentiteComplete(type: DocumentType): boolean {
  return Boolean(CHAMPS_OBLIGATOIRES[type]);
}

/**
 * Erreur de conformité : identité OF incomplète pour un document à valeur
 * juridique/fiscale. Portée par `assertOrganismeComplet`.
 */
export class OrganismeIncompletError extends Error {
  constructor(
    public readonly type: DocumentType,
    public readonly manquants: string[],
  ) {
    super(
      `[conformité] Génération du document « ${type} » refusée : ` +
        `identité de l'organisme incomplète (champ(s) manquant(s) : ${manquants.join(", ")}). ` +
        `Renseigner ces valeurs dans les paramètres Qualiopi avant d'émettre un document légal.`,
    );
    this.name = "OrganismeIncompletError";
  }
}

/**
 * Lève `OrganismeIncompletError` si l'identité de l'OF est incomplète pour un
 * document à valeur juridique/fiscale (facture, convention, tripartite,
 * contrat). No-op pour les autres types. À appeler AVANT le rendu PDF.
 *
 * ⚠️ La chaîne de génération principale (`generateDocument`) n'appelle PLUS
 * cette fonction : elle utilise `evaluerIdentite` et déclasse le document en
 * SPÉCIMEN plutôt que de refuser. Conservée pour les appelants qui veulent un
 * refus dur (facturation 1-to-1) et pour les tests.
 */
export function assertOrganismeComplet(identite: OrganismeIdentite, type: DocumentType): void {
  const manquants = champsIdentiteManquants(identite, type);
  if (manquants.length > 0) {
    throw new OrganismeIncompletError(type, manquants);
  }
}

/**
 * Verdict de conformité d'identité, sans exception.
 *
 * Remplace le couple « bloquer ou laisser passer en silence » par un troisième
 * état : le document est produit, mais **déclassé en SPÉCIMEN** et marqué comme
 * tel (filigrane + bandeau listant les champs manquants + `metadata.specimen`
 * en base). Deux propriétés en découlent :
 *
 *   1. plus rien ne bloque — toute la chaîne reste exerçable, y compris avant
 *      l'obtention du SIRET, du NDA ou de la certification ;
 *   2. aucun document incomplet ne peut être confondu avec une pièce valable,
 *      ce qui était le risque que ce module existe pour écarter.
 *
 * `conforme: true` ⇒ document officiel normal.
 */
export function evaluerIdentite(
  identite: OrganismeIdentite,
  type: DocumentType,
): { conforme: boolean; manquants: string[]; motif: string | null } {
  const manquants = champsIdentiteManquants(identite, type);
  if (manquants.length === 0) return { conforme: true, manquants: [], motif: null };
  return {
    conforme: false,
    manquants,
    motif:
      `Identité de l'organisme incomplète — ${manquants.join(", ")}. ` +
      `Document émis en SPÉCIMEN, sans valeur juridique. ` +
      `Renseignez ces valeurs dans Qualiopi › Configuration pour émettre un document officiel.`,
  };
}
