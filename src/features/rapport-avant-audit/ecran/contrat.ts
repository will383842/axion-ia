/**
 * Écran « Rapport d'analyse » de la fiche client — le CONTRAT avec le reste du chantier
 * (2026-11-02).
 *
 * L'écran ne connaît NI la table `rapports_avant_audit`, NI l'action `lancerRapportAvantAudit`,
 * NI les sorties (`baseEnMarkdown`, `baseEnJson`, `ficheEnMarkdown`, `genererPdfClient`) : elles
 * vivent dans deux autres PR (« persistance » et « sorties ») pas encore fusionnées. Tout l'écran
 * est écrit contre l'interface `AccesRapports` ci-dessous ; le raccord avec le vrai code se fait
 * dans UNE seule fonction (`brancher.ts`), une fois les deux PR fusionnées.
 *
 * Implémentations :
 *   · `memoire.ts` — en mémoire, pour les tests ;
 *   · `brancher.ts` — aujourd'hui l'accès « pas encore installé » (rien à lire, rien à lancer) ;
 *     demain le vrai code.
 *
 * ⛔ Aucune méthode ici n'écrit sur la fiche du client. La complétion de la fiche passe par la
 * porte existante (`updateClientAction`), depuis `actions.ts`, sur clic explicite.
 */

import type { BaseAudit } from "../base-audit-schema";

/** Où en est un rapport. `termine` et `incomplet` ont une base VALIDÉE (contrat respecté). */
export const STATUTS_RAPPORT = [
  "en_attente",
  "en_cours",
  "termine",
  "incomplet",
  "echoue",
] as const;
export type StatutRapport = (typeof STATUTS_RAPPORT)[number];

/** Un rapport dont la base a passé le contrat : on peut la lire et la télécharger. */
export const STATUTS_AVEC_BASE: ReadonlyArray<StatutRapport> = ["termine", "incomplet"];
/** Un rapport qui tourne encore. */
export const STATUTS_EN_COURS: ReadonlyArray<StatutRapport> = ["en_attente", "en_cours"];

/** Une version du rapport d'un client, telle que l'écran l'affiche (sans le contenu). */
export interface ResumeRapport {
  readonly id: string;
  /** 1, 2, 3… dans l'ordre des lancements pour CE client. */
  readonly version: number;
  readonly statut: StatutRapport;
  /** Libellé de l'étape en cours (« Recherches et analyses »), ou `null` avant la première. */
  readonly etape: string | null;
  readonly etapesFaites: number;
  readonly etapesTotal: number;
  readonly jetonsEntree: number;
  readonly jetonsSortie: number;
  readonly lanceLe: Date;
  readonly termineLe: Date | null;
  /** Nom lisible de qui l'a lancé, ou `null`. */
  readonly lancePar: string | null;
  /**
   * Date de la réponse la plus récente PRISE EN COMPTE par ce rapport. `null` : inconnue —
   * l'écran se rabat alors sur `lanceLe`.
   */
  readonly reponsesJusquau: Date | null;
  /** Message lisible si le rapport a échoué ou s'est arrêté avant la fin, sinon `null`. */
  readonly erreur: string | null;
  /** Date du clic « Valider le PDF client », ou `null` : le PDF n'est pas téléchargeable. */
  readonly pdfValideLe: Date | null;
  readonly pdfValidePar: string | null;
}

/** Ce que l'écran propose au téléchargement. */
export const FORMATS_TELECHARGEMENT = ["base-json", "base-md", "fiches-md", "pdf-client"] as const;
export type FormatTelechargement = (typeof FORMATS_TELECHARGEMENT)[number];

/** Un fichier prêt à partir en pièce jointe. */
export interface FichierRapport {
  /** Nom proposé au téléchargement, sans chemin (« base-audit-v3.json »). */
  readonly nom: string;
  /** Type MIME, avec le jeu de caractères pour un texte. */
  readonly type: string;
  readonly contenu: string | Uint8Array;
}

export type PropositionFiche = BaseAudit["propositions_fiche"][number];

export type ResultatAcces = { readonly ok: true } | { readonly ok: false; readonly raison: string };

export interface AccesRapports {
  /**
   * Faux tant que le vrai code (PR « persistance » et « sorties ») n'est pas raccordé : l'écran
   * le dit, et le bouton reste éteint.
   */
  readonly branche: boolean;
  /** Les rapports du client, le PLUS RÉCENT d'abord. Liste vide : aucun rapport. */
  listerRapports(clientId: string): Promise<ReadonlyArray<ResumeRapport>>;
  /** La base d'audit VALIDÉE d'un rapport de CE client ; `null` sinon (autre client, pas finie). */
  lireBase(clientId: string, rapportId: string): Promise<BaseAudit | null>;
  /** Les propositions « Compléter la fiche » d'un rapport de CE client (vide si aucune). */
  lirePropositions(clientId: string, rapportId: string): Promise<ReadonlyArray<PropositionFiche>>;
  /**
   * Le fichier demandé, ou `null` (rapport inconnu, pas fini, ou — pour `pdf-client` — PDF pas
   * encore validé). L'écran vérifie aussi ces conditions avant d'appeler.
   */
  telecharger(
    clientId: string,
    rapportId: string,
    format: FormatTelechargement,
  ): Promise<FichierRapport | null>;
  /** Marque le PDF client comme validé (date et auteur). N'ENVOIE RIEN à personne. */
  validerPdf(clientId: string, rapportId: string, par: string): Promise<ResultatAcces>;
  /** Lance une nouvelle version du rapport. Rend vite : le travail se fait en arrière-plan. */
  lancer(
    clientId: string,
    par: string,
  ): Promise<
    | { readonly ok: true; readonly rapportId: string }
    | { readonly ok: false; readonly raison: string }
  >;
}
