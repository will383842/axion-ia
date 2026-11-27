/**
 * Relevé mensuel des apporteurs : types du contenu figé (`formatVersion = 1`) et des lignes lues.
 *
 * Module PUR, sans Prisma ni `server-only` (le worker l'atteint par `tsx`). Tous les montants sont
 * des CENTIMES ENTIERS. Le contenu ne porte AUCUNE donnée personnelle : ni nom de contact, ni
 * e-mail, ni téléphone, ni IBAN (RGPD, art. 5.1.c) ; seule la dénomination de l'entreprise
 * présentée figure sur une ligne. Le relevé n'est PAS une facture.
 */

export const FORMAT_VERSION_RELEVE = 1;

/** Mention reprise en tête et en pied du relevé et de son e-mail. */
export const MENTION_PAS_UNE_FACTURE =
  "Document d'information, qui n'est pas une facture. Seules les autofactures et les avoirs joints à vos e-mails précédents font foi (contrat, article 5.1 et annexe 2).";

/** Mention reprise des pièces en franchise de TVA. */
export const MENTION_293B = "TVA non applicable, article 293 B du CGI";

/**
 * Liste FERMÉE des règles affichables. Posées au calcul de la commission (lot R) : le relevé les
 * LIT, il ne les recalcule jamais. `formation_3j_plus` est réservé et jamais affiché (Q7).
 */
export const CODES_REGLE_AFFICHABLES = [
  "forfait_palier",
  "prorata_remise",
  "forfait_sessions",
  "taux_ht",
  "plafond_base",
  "parrainage_10",
  "tarif_avant_date_effet",
  "journee_ia",
] as const;
export type CodeRegleAffichable = (typeof CODES_REGLE_AFFICHABLES)[number];
export const CODE_REGLE_RESERVE = "formation_3j_plus";

// ── Entrées (lignes DÉJÀ lues en base ; ce module n'accède à aucune base) ────────────────────

export interface CommissionLue {
  /** Sert seulement à ne jamais compter deux fois une ligne ; n'entre pas dans le contenu. */
  readonly id: string;
  readonly activite: string;
  readonly palier: string | null;
  readonly parrainage: boolean;
  readonly statut: string;
  readonly montantCents: number | null;
  readonly factureHtCents: number | null;
  readonly prixPublicHtCents: number | null;
  /** Dénomination de l'entreprise présentée (jamais un contact). */
  readonly entreprise: string | null;
  readonly factureClientNumero: string | null;
  readonly factureClientDate: Date | null;
  /** Date d'encaissement intégral du client (`paiementsIntegrauxParFacture`). */
  readonly encaissementIntegralAt: Date | null;
  readonly autofactureNumero: string | null;
  readonly autofactureEmiseAt: Date | null;
  readonly avoirNumero: string | null;
  readonly autofactureAttenteMotif: string | null;
  readonly autofactureAttenteDepuis: Date | null;
  readonly litigeDepuis: Date | null;
  readonly verseeAt: Date | null;
  readonly creeAt: Date;
  readonly majAt: Date;
  /** Posé au calcul de la commission (lot R) ; `null` avant. */
  readonly regleAppliquee: string | null;
  readonly versionContrat: string | null;
}

export interface PieceLue {
  readonly numero: string;
  /** « facture » | « avoir ». */
  readonly genre: string;
  readonly regimeTva: "franchise_293b" | "assujetti";
  /** `null` : pièce reprise à la migration, totaux inconnus. */
  readonly totalHtCents: number | null;
  readonly totalTvaCents: number | null;
  readonly totalTtcCents: number | null;
  /** Avoir : l'autofacture rectifiée. */
  readonly factureRectifiee: string | null;
  readonly emiseAt: Date;
}

export interface EntreeReleve {
  /** Mois de Paris « AAAA-MM », CLOS à `preparationAt`. */
  readonly periode: string;
  readonly preparationAt: Date;
  /**
   * Contrat exact pour le lot 3c : toute commission de l'apporteur ayant un évènement (émission,
   * avoir, virement, attente d'autofacture) dans `[1er janvier de l'année de la période ; coupure[`,
   * PLUS toute commission facturée et non virée à la coupure, QUELLE QUE SOIT l'année d'émission
   * (une autofacture de décembre N−1 virée en janvier N figure en C ; impayée, elle reste en D1).
   * Filtrer sur la seule année d'émission ferait disparaître ces lignes sans signal.
   */
  readonly commissions: readonly CommissionLue[];
  /** Toutes les pièces AXI-APP de l'apporteur. */
  readonly pieces: readonly PieceLue[];
}

// ── Contenu figé ───────────────────────────────────────────────────────────────────────────────

export interface RegleLue {
  readonly code: CodeRegleAffichable;
  readonly libelle: string;
}

export type StatutLigne =
  | { readonly code: "facturee"; readonly echeanceLe: string }
  | { readonly code: "versee"; readonly verseeLe: string };

export interface LigneReleve {
  /** « AAAA-MM-JJ », jour de Paris. */
  readonly dateEmission: string;
  /** `null` pour le parrainage (art. 4.6 : rien sur le filleul). */
  readonly entreprise: string | null;
  readonly prestation: string | null;
  readonly factureClient: { readonly numero: string; readonly date: string | null } | null;
  readonly encaissementIntegralLe: string | null;
  readonly baseHtCents: number | null;
  readonly prixPublicHtCents: number | null;
  readonly montantHtCents: number;
  readonly regle: RegleLue | null;
  /** Règle absente : numéro de l'autofacture dont le décompte la porte. */
  readonly renvoiDecompte: string | null;
  /** « Contrat v2.8 », ou `null` (rien n'est affiché). */
  readonly versionContrat: string | null;
  readonly parrainage: boolean;
  readonly pieceNumero: string;
  readonly statut: StatutLigne | null;
}

export interface PieceReleve {
  readonly numero: string;
  readonly emiseLe: string;
  readonly regimeTva: "franchise_293b" | "assujetti" | null;
  readonly mention293b: boolean;
  readonly htCents: number;
  readonly tvaCents: number;
  readonly ttcCents: number;
  /** Avoir : l'autofacture rectifiée. */
  readonly renvoiFacture: string | null;
}

export interface VirementReleve {
  readonly reference: string;
  readonly verseLe: string;
  /** TTC de l'autofacture moins TTC des avoirs imputés (peut être 0). */
  readonly montantTtcCents: number;
  /** Net nul : « réglé par compensation (art. 12.4) ». */
  readonly compensation: boolean;
}

export interface ReportFactureNonViree {
  readonly pieceNumero: string;
  readonly emiseLe: string;
  readonly echeanceLe: string;
  readonly nbLignes: number;
  readonly htCents: number;
}

export interface ReportEnAttenteAutofacture {
  readonly entreprise: string | null;
  readonly prestation: string | null;
  readonly montantHtCents: number;
  readonly motif: string | null;
  readonly depuisLe: string;
}

export interface ReportIndicatif {
  /** Jour de la préparation : D3 n'a pas de date de sortie, il est figé à ce jour. */
  auJour: string;
  lignes: Array<{
    entreprise: string | null;
    prestation: string | null;
    statut: "a_qualifier" | "en_attente_vigilance" | "litige";
    montantHtCents: number | null;
  }>;
}

export interface ContenuReleveV1 {
  readonly formatVersion: 1;
  readonly periode: string;
  readonly coupureAt: string;
  readonly mention: string;
  /** Aucune ligne en A, B ni C : version courte « aucun mouvement ce mois-ci ». */
  readonly aucunMouvement: boolean;
  readonly facturees: {
    readonly lignes: LigneReleve[];
    readonly pieces: PieceReleve[];
  };
  readonly avoirs: {
    readonly lignes: LigneReleve[];
    readonly pieces: PieceReleve[];
  };
  readonly virements: VirementReleve[];
  readonly sousTotaux: {
    readonly facturees: { readonly nb: number; readonly htCents: number };
    readonly versees: { readonly nb: number; readonly htCents: number };
  };
  readonly totaux: {
    readonly factureHtCents: number;
    /** Magnitude des avoirs (positive). */
    readonly avoirHtCents: number;
    readonly netHtCents: number;
    readonly tvaCents: number;
    readonly ttcCents: number;
    readonly vireTtcCents: number;
  };
  readonly report: {
    readonly facturesNonVirees: ReportFactureNonViree[];
    readonly enAttenteAutofacture: ReportEnAttenteAutofacture[];
    readonly indicatif: ReportIndicatif;
  };
  readonly cumulAnnee: {
    readonly annee: number;
    readonly factureHtCents: number;
    readonly avoirHtCents: number;
    readonly netHtCents: number;
    readonly netTtcCents: number;
    readonly vireTtcCents: number;
  };
}

export interface AnomalieReleve {
  readonly code:
    | "piece_manquante"
    | "piece_sans_totaux"
    | "avoir_sans_piece"
    | "regle_inconnue"
    | "montant_non_entier"
    | "virement_negatif"
    | "emission_incoherente";
  readonly detail: string;
}

export interface ResultatCalculReleve {
  readonly contenu: ContenuReleveV1;
  /** Non bloquantes pour le calcul ; l'écran de vérification les montre. */
  readonly anomalies: AnomalieReleve[];
}

/** Totaux dénormalisés pour les statistiques (jamais relus pour réémettre). */
export interface TotauxDenormalises {
  readonly nbLignes: number;
  readonly facturesHtCents: number;
  readonly avoirsHtCents: number;
  readonly viresTtcCents: number;
  readonly enAttenteHtCents: number;
  readonly cumulAnneeHtCents: number;
}
