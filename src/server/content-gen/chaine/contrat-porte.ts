/**
 * Contrat d'interface entre la chaîne éditoriale IA et la porte qualité (C4, § 8
 * de `CONCEPTION-CHAINE-EDITORIALE-IA.md`).
 *
 * Types et fonctions PURES : la porte (`evaluerPorte`) n'est pas écrite ici, et
 * rien n'est branché. Ce fichier fixe ce que la chaîne lui envoie, ce qu'elle
 * rend, comment un verdict devient des refus enregistrables, et la décision qui
 * suit (réécriture ciblée, abandon, report, relecture humaine).
 *
 * Les noms de critères (B01…B17, W01…W10) et de verdicts sont ceux de la porte :
 * la chaîne ne les renomme pas.
 */

import {
  CRITERES_BLOQUANTS,
  codePourCritere,
  type CodeRefus,
  type CritereBloquant,
} from "./codes-refus";

// ─── Constantes (valeurs de départ des conceptions) ──────────────────────────

/** Note minimale pour publier (relevée à 90 par la porte si l'indexation est faible). */
export const SEUIL_PUBLICATION_DEPART = 85;
/** Sous cette note, le verdict est `bloque`. */
export const SEUIL_BLOQUE = 70;
/** Réécritures ciblées au plus par contenu (3 passages au total). */
export const MAX_REECRITURES = 2;
/** Plafond de coût par contenu lancé, en dollars. Même compteur que la chaîne. */
export const PLAFOND_COUT_USD = 3;

export const VERDICTS_PORTE = ["publiable", "a_corriger", "bloque"] as const;
export type VerdictPorte = (typeof VERDICTS_PORTE)[number];

export const AVERTISSEMENTS = [
  "W01",
  "W02",
  "W03",
  "W04",
  "W05",
  "W06",
  "W07",
  "W08",
  "W09",
  "W10",
] as const;
export type Avertissement = (typeof AVERTISSEMENTS)[number];

export type IdCritere = CritereBloquant | Avertissement;

export function estCritereBloquant(valeur: unknown): valeur is CritereBloquant {
  return typeof valeur === "string" && (CRITERES_BLOQUANTS as readonly string[]).includes(valeur);
}

/** Classement unique des bloquants (§ 5 de la porte). */
export type ClasseCritere = "dur" | "corrigeable" | "derogeable" | "report";

export const CLASSE_CRITERE: Readonly<Record<CritereBloquant, ClasseCritere>> = {
  B01: "dur",
  B02: "dur",
  B03: "dur",
  B04: "dur",
  B05: "derogeable",
  B06: "derogeable",
  B07: "derogeable",
  B08: "corrigeable",
  B09: "dur",
  B10: "corrigeable",
  B11: "corrigeable",
  B12: "dur",
  B13: "corrigeable",
  B14: "dur",
  B15: "dur",
  B16: "corrigeable",
  B17: "report",
};

// ─── Appel de la porte (chaîne → porte) ──────────────────────────────────────

/** Un fait du dossier de preuves (R3), tel que transmis à la porte. */
export interface FaitPreuve {
  readonly enonce: string;
  readonly extrait: string;
  readonly url: string;
  readonly editeur: string;
  /** Date de publication de la source, ISO 8601. */
  readonly datePublication: string;
}

export interface BriefPorte {
  /** Requête principale normalisée (une requête = une URL). */
  readonly requetePrincipale: string;
  readonly intention: "information" | "comparaison" | "decision";
}

/** Ce que la chaîne envoie à la porte, une fois par contenu final (R8). */
export interface EntreePorte {
  readonly contenuId: string;
  readonly titre: string;
  readonly metaDescription: string;
  readonly corps: string;
  readonly dossierPreuves: readonly FaitPreuve[];
  readonly brief: BriefPorte;
  /** 1 pour le premier passage, 2 et 3 pour les réécritures. */
  readonly tentative: number;
}

// ─── Réponse de la porte (porte → chaîne) ────────────────────────────────────

/** `non_evalue` : source indisponible. Pour un bloquant, cela bloque (échec fermé). */
export type EtatCritere = "ok" | "echec" | "non_evalue";

export interface ResultatCritere {
  readonly id: IdCritere;
  readonly etat: EtatCritere;
  /** Preuve enregistrée (extrait, mesure). */
  readonly preuve: string;
  /** Raison en français simple. */
  readonly raison: string;
  /** Section en cause : sans elle, la cause n'est pas localisable. */
  readonly section?: string;
  /** Précision de cause permise par `CORRESPONDANCE_BNN` (ex. B11 → longueur). */
  readonly precision?: CodeRefus;
}

export interface SortiePorte {
  readonly versionPorte: string;
  readonly verdict: VerdictPorte;
  /** Note sur 100. */
  readonly note: number;
  readonly criteres: readonly ResultatCritere[];
}

/** L'appel peut échouer : la chaîne ne publie alors jamais (échec fermé). */
export type ResultatAppelPorte =
  | { readonly etat: "ok"; readonly sortie: SortiePorte }
  | { readonly etat: "erreur"; readonly message: string };

/** Critères bloquants qui ne sont pas « ok » (en échec ou non évalués). */
function defautsBloquants(sortie: SortiePorte): ResultatCritere[] {
  return sortie.criteres.filter((c) => estCritereBloquant(c.id) && c.etat !== "ok");
}

/**
 * Seul chemin vers la publication : appel réussi, verdict `publiable`, aucun
 * bloquant en défaut (B17 compris), note valide. Tout le reste est refusé.
 */
export function publicationAutorisee(resultat: ResultatAppelPorte): boolean {
  if (resultat.etat !== "ok") return false;
  const { sortie } = resultat;
  if (!Number.isFinite(sortie.note) || sortie.note < 0 || sortie.note > 100) return false;
  return sortie.verdict === "publiable" && defautsBloquants(sortie).length === 0;
}

// ─── Enregistrement des refus (porte → ContenuRefus) ─────────────────────────

/** Une ligne de refus, prête à être écrite par `ContenuRefus` (§ 7.1). */
export interface RefusEnregistrable {
  readonly role: "porte";
  readonly code: CodeRefus;
  /** Critère exact (Bnn) : distingue B03 de B04 malgré un code commun. */
  readonly critere: CritereBloquant;
  readonly raison: string;
  readonly preuve: string;
  readonly section?: string;
  readonly tentative: number;
  readonly versionPorte: string;
  readonly coutUsd: number;
  readonly versionPrompt?: string;
  readonly versionBrief?: string;
}

export interface ContexteRefus {
  readonly tentative: number;
  /** Coût déjà dépensé sur ce contenu. */
  readonly coutUsd: number;
  readonly versionPrompt?: string;
  readonly versionBrief?: string;
}

/**
 * Un refus par bloquant en défaut. B17 est exclu : c'est un report. Les
 * avertissements ne sont jamais des refus.
 */
export function refusDepuisVerdict(sortie: SortiePorte, ctx: ContexteRefus): RefusEnregistrable[] {
  const refus: RefusEnregistrable[] = [];
  for (const c of defautsBloquants(sortie)) {
    if (!estCritereBloquant(c.id) || CLASSE_CRITERE[c.id] === "report") continue;
    refus.push({
      role: "porte",
      code: codePourCritere(c.id, c.precision),
      critere: c.id,
      raison: c.raison,
      preuve: c.preuve,
      ...(c.section !== undefined ? { section: c.section } : {}),
      tentative: ctx.tentative,
      versionPorte: sortie.versionPorte,
      coutUsd: ctx.coutUsd,
      ...(ctx.versionPrompt !== undefined ? { versionPrompt: ctx.versionPrompt } : {}),
      ...(ctx.versionBrief !== undefined ? { versionBrief: ctx.versionBrief } : {}),
    });
  }
  return refus;
}

// ─── Décision après verdict (cycle du § 4) ───────────────────────────────────

export interface CorrectionLocalisee {
  readonly critere: CritereBloquant;
  readonly section?: string;
  readonly code: CodeRefus;
}

export interface EtatCycle {
  readonly reecrituresFaites: number;
  readonly coutUsd: number;
}

export type ActionApresVerdict =
  | { readonly action: "relecture_humaine" }
  | { readonly action: "reporter" }
  | {
      readonly action: "reecrire";
      readonly corrections: readonly CorrectionLocalisee[];
    }
  | { readonly action: "abandonner"; readonly code: CodeRefus };

/**
 * Ce que fait la chaîne d'un verdict. Ordre des règles :
 * 1. B17 seul en défaut → report (jamais de réécriture ni d'abandon) ;
 * 2. publiable et sans défaut → relecture humaine (jamais de publication directe) ;
 * 3. plafond de réécritures ou de coût atteint → abandon `plafond_atteint` ;
 * 4. bloquant dur sans section en cause → abandon (cause non localisable) ;
 * 5. sinon → réécriture ciblée des sections en cause.
 * Une dérogation humaine (B05, B06, B07) se décide hors de cette fonction.
 */
export function actionApresVerdict(sortie: SortiePorte, etat: EtatCycle): ActionApresVerdict {
  const defauts = defautsBloquants(sortie);
  if (defauts.length > 0 && defauts.every((c) => c.id === "B17")) return { action: "reporter" };
  if (sortie.verdict === "publiable" && defauts.length === 0) {
    return { action: "relecture_humaine" };
  }
  if (etat.reecrituresFaites >= MAX_REECRITURES || etat.coutUsd >= PLAFOND_COUT_USD) {
    return { action: "abandonner", code: "plafond_atteint" };
  }
  const refus = defauts.filter(
    (c): c is ResultatCritere & { id: CritereBloquant } =>
      estCritereBloquant(c.id) && CLASSE_CRITERE[c.id] !== "report",
  );
  const durNonLocalise = refus.find(
    (c) => CLASSE_CRITERE[c.id] === "dur" && c.section === undefined,
  );
  if (durNonLocalise) {
    return {
      action: "abandonner",
      code: codePourCritere(durNonLocalise.id, durNonLocalise.precision),
    };
  }
  return {
    action: "reecrire",
    corrections: refus.map((c) => ({
      critere: c.id,
      ...(c.section !== undefined ? { section: c.section } : {}),
      code: codePourCritere(c.id, c.precision),
    })),
  };
}
