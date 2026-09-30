/**
 * Le PORT DES DONNÉES du circuit visio : tout ce que les étapes lisent et
 * écrivent en base et dans R2, derrière une interface.
 *
 * Pourquoi un port : les étapes contiennent les RÈGLES (ce qui part chez
 * OpenAI, ce qui est gardé, ce qui est effacé). Les tests les exercent avec
 * un port en mémoire ; la chaîne de Gate D les exerce avec
 * `depot-donnees.ts` (Prisma) sur une vraie base. Les textes sont DÉCHIFFRÉS
 * par le port à la lecture et CHIFFRÉS par lui à l'écriture
 * (`chiffrer-parole`) : une étape ne voit jamais une colonne `enc:v1:`.
 */

import type { FaitType } from "../../../prisma/generated/client";
import type { Periode, SegmentStocke } from "./dialogue";
import type { ContactDeLaBase, FaitDeLaBase, ProjetDeLaBase } from "./contexte";
import type { EtatCompteRendu } from "./etat-compte-rendu";
import type { Tx } from "./prise-d-etape";
import type { FaitVerifie } from "./verification/verifier-faits";

export interface TrancheATraiter {
  readonly id: string;
  readonly piste: "client" | "axion";
  readonly numero: number;
  readonly debutCaptureEpochMs: number;
  readonly dureeMs: number | null;
  readonly niveauFinMuet: boolean | null;
  readonly statut: "en_reception" | "complete" | "incomplete" | "transcrite" | "echec" | "purgee";
  readonly empreinteAnnoncee: string | null;
}

export interface EnregistrementATraiter {
  readonly id: string;
  readonly rencontreId: string;
  readonly nature: "visio" | "dictee";
  readonly statut: string;
  readonly debut: Date;
  readonly fin: Date | null;
  readonly motifArret: string | null;
  readonly fenetresHorsAccord: readonly Periode[];
  /** Instant de référence des horodatages (début réel de la rencontre, sinon début de capture). */
  readonly origineMs: number;
  /** Will a confirmé qu'un enregistrement de moins de 90 s doit être traité. */
  readonly courtConfirme: boolean;
  /** Will a vérifié que personne n'est entré sans accord (session close par le serveur). */
  readonly fenetresVerifiees: boolean;
  readonly tranches: readonly TrancheATraiter[];
}

export interface SegmentAEcrire {
  readonly ordre: number;
  readonly piste: "client" | "axion";
  readonly debutMs: number;
  readonly finMs: number;
  readonly locuteurBrut: string | null;
  /** Vide pour un segment hors accord : sa parole n'est jamais gardée. */
  readonly texte: string;
  readonly horsAccord: boolean;
}

export interface DonneesPrecontrole {
  readonly enregistrementId: string;
  readonly transcriptionId: string;
  readonly nature: "visio" | "dictee";
  readonly dureeMs: number;
  /** « Accord obtenu » cliqué, en ms depuis l'origine ; `null` si inconnu. */
  readonly accordDeclareMs: number | null;
  readonly segments: readonly SegmentStocke[];
  /** Voix déjà pourvues d'une preuve retrouvée (rejeu idempotent). */
  readonly preuvesDejaEcrites: number;
}

export interface DonneesRencontre {
  readonly id: string;
  readonly titre: string;
  readonly source: string;
  readonly clientId: string | null;
  readonly debut: Date;
  readonly dureeMs: number;
}

export interface DonneesExtraction {
  readonly rencontre: DonneesRencontre;
  readonly transcriptionId: string;
  readonly segments: readonly SegmentStocke[];
  readonly pistes: { readonly client: "OK" | "MUETTE"; readonly axion: "OK" | "MUETTE" };
  readonly formulaire: ReadonlyArray<{ readonly question: string; readonly reponse: string }>;
  readonly contacts: readonly ContactDeLaBase[];
  readonly projets: readonly ProjetDeLaBase[];
  readonly faitsClient: readonly FaitDeLaBase[];
  /** Mode de la nouvelle version (réextraire si une version existe déjà). */
  readonly mode: "initial" | "reextraire";
}

/** Un fait du jour relu en base pour les passes P2 à P5 (sans citation). */
export interface FaitDuJour {
  readonly id: string;
  readonly ref: string;
  readonly type: FaitType;
  readonly statut: string;
  readonly porteeDeclaree: "entreprise" | "projet";
  readonly projetRef: string | null;
  readonly enonce: string;
  readonly citation: string | null;
  readonly valeurs: readonly string[];
  readonly locuteur: "client" | "axion" | null;
  readonly confiance: string;
}

export interface DonneesPasses {
  readonly rencontre: DonneesRencontre;
  readonly compteRenduId: string;
  readonly statutCompteRendu: string;
  readonly etat: EtatCompteRendu | null;
  readonly faitsDuJour: readonly FaitDuJour[];
  readonly projets: readonly ProjetDeLaBase[];
  /** Faits VALIDÉS du client, antérieurs à la rencontre, d'autres rencontres. */
  readonly faitsConnus: readonly FaitDeLaBase[];
}

export interface DonneesVerificationFaits {
  readonly rencontre: DonneesRencontre;
  readonly compteRenduId: string;
  readonly etat: EtatCompteRendu;
  readonly segments: readonly SegmentStocke[];
  readonly enregistrementId: string | null;
  /** Faits DÉJÀ validés de cette rencontre (d'une version précédente). */
  readonly faitsValidesDeLaRencontre: ReadonlyArray<{
    readonly id: string;
    readonly type: FaitType;
    readonly cle: string;
    readonly citationDebutMs: number | null;
  }>;
}

export interface FaitAEcrire extends FaitVerifie {
  readonly doublonDeFaitId: string | null;
}

/**
 * Un enregistrement dont le son est ENCORE dans R2 — un CANDIDAT à la purge,
 * pas une purge due : `purgerAudio` applique `audioAPurgerMaintenant` à chacun
 * (B1 : enregistrement par enregistrement, jamais toute la rencontre).
 */
export interface AudioAPurger {
  readonly enregistrementId: string;
  readonly trancheIds: readonly string[];
  readonly cles: readonly string[];
  readonly statut: string;
  readonly audioAPurgerAvant: Date | null;
  /** Une transcription de CET enregistrement est source d'un compte rendu validé. */
  readonly compteRenduValide: boolean;
}

export interface PortDonnees {
  readonly enregistrementActif: (rencontreId: string) => Promise<boolean>;
  /**
   * Une personne de la fiche du client, ou un participant de la rencontre,
   * s'est-elle opposée à l'IA (art. 21, `oppositionIaLe`) ? Relu AVANT chaque
   * étape qui appelle OpenAI : une opposition arrivée pendant une suspension,
   * ou un rattachement à une fiche qui en porte une, arrête le circuit.
   */
  readonly oppositionIa: (rencontreId: string) => Promise<boolean>;
  /** Opposition constatée : les enregistrements terminés passent « abandonné » (purge due). */
  readonly abandonnerPourOpposition: (rencontreId: string) => Promise<void>;

  // ── transcrire ──
  /**
   * TOUS les enregistrements non actifs de la rencontre, du plus ancien au plus
   * récent : après « Arrêter » puis une relance, les deux parties de l'appel
   * sont transcrites (jamais seulement la dernière). Leurs horodatages partent
   * de la MÊME origine (début réel, sinon début du premier enregistrement).
   */
  readonly aTranscrire: (rencontreId: string) => Promise<readonly EnregistrementATraiter[]>;
  /** Octets CLAIRS d'une tranche (morceaux lus dans R2, déchiffrés, empreinte vérifiée). */
  readonly lireSonTranche: (trancheId: string) => Promise<Buffer>;
  readonly ouvrirTranscription: (
    tx: Tx,
    a: {
      readonly enregistrementId: string;
      readonly empreinteEntree: string;
      readonly modele: string;
      readonly langue: string;
    },
  ) => Promise<string>;
  readonly ecrireSegmentsTranche: (
    tx: Tx,
    a: {
      readonly transcriptionId: string;
      readonly trancheId: string;
      readonly segments: readonly SegmentAEcrire[];
    },
  ) => Promise<void>;
  readonly retenirTranscription: (
    tx: Tx,
    a: {
      readonly enregistrementId: string;
      readonly transcriptionId: string;
      readonly dureeAudioSecondes: number;
    },
  ) => Promise<void>;
  readonly marquerEnregistrement: (
    tx: Tx,
    enregistrementId: string,
    statut: string,
  ) => Promise<void>;

  // ── précontrôler ──
  /** Une entrée par enregistrement transcrit de la rencontre, du plus ancien au plus récent. */
  readonly pourPrecontrole: (rencontreId: string) => Promise<readonly DonneesPrecontrole[]>;
  readonly marquerApresRefus: (
    tx: Tx,
    transcriptionId: string,
    ordres: readonly number[],
  ) => Promise<void>;
  readonly ecrirePreuvesAccord: (
    tx: Tx,
    a: {
      readonly rencontreId: string;
      readonly enregistrementId: string;
      readonly accords: ReadonlyArray<{ readonly texte: string; readonly reponseMs: number }>;
    },
  ) => Promise<void>;
  readonly noterAuJournal: (
    tx: Tx,
    enregistrementId: string,
    entree: Readonly<Record<string, unknown>>,
  ) => Promise<void>;

  // ── extraire ──
  readonly pourExtraction: (rencontreId: string) => Promise<DonneesExtraction | null>;
  readonly creerCompteRendu: (
    tx: Tx,
    a: {
      readonly rencontreId: string;
      readonly transcriptionId: string | null;
      readonly mode: "initial" | "reextraire" | "reecrire" | "completer_apres_rattachement";
      readonly modele: string | null;
      readonly promptHash: string;
      readonly schemaVersion: number;
      readonly etat: EtatCompteRendu;
    },
  ) => Promise<string>;
  /** Pas un rendez-vous client (entretien, échange personnel) : tout est effacé, sans compte rendu. */
  readonly effacerSansCompteRendu: (tx: Tx, rencontreId: string) => Promise<void>;

  // ── vérifier les faits ──
  readonly pourVerificationFaits: (
    compteRenduId: string,
  ) => Promise<DonneesVerificationFaits | null>;
  readonly ecrireFaits: (
    tx: Tx,
    a: {
      readonly compteRenduId: string;
      readonly rencontreId: string;
      readonly clientId: string | null;
      readonly constateLe: Date;
      readonly faits: readonly FaitAEcrire[];
    },
  ) => Promise<ReadonlyArray<readonly [string, string]>>;

  // ── passes P2 à P5, vérification du compte rendu ──
  readonly pourPasses: (compteRenduId: string) => Promise<DonneesPasses | null>;
  readonly majEtat: (tx: Tx, compteRenduId: string, etat: EtatCompteRendu) => Promise<void>;
  readonly finaliserCompteRendu: (
    tx: Tx,
    a: {
      readonly compteRenduId: string;
      readonly rencontreId: string;
      readonly contenu: string;
      readonly etat: EtatCompteRendu;
      readonly modele: string | null;
    },
  ) => Promise<void>;
  readonly rejeterCompteRendu: (tx: Tx, compteRenduId: string) => Promise<void>;

  // ── purge de l'audio ──
  /** Les CANDIDATS (son encore présent, enregistrement terminé) ; le tri « dû » est fait par l'étape. */
  readonly audiosAPurger: (rencontreId: string) => Promise<readonly AudioAPurger[]>;
  readonly supprimerObjet: (cle: string) => Promise<void>;
  readonly objetExiste: (cle: string) => Promise<boolean>;
  readonly marquerAudioPurge: (tx: Tx, a: AudioAPurger, le: Date) => Promise<void>;
}
