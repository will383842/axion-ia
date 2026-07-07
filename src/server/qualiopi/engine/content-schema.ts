/**
 * Qualiopi — Formation Engine : Schéma Zod du CONTENU PÉDAGOGIQUE DÉTAILLÉ.
 *
 * Module PUR — aucun import Prisma/Next/DB. Importable depuis le worker, les
 * builders de supports, les seeds et les tests sans dépendance server-side.
 *
 * ⚠️ CONTRAT CENTRAL DU CHANTIER « EXCELLENCE FORMATIONS » :
 * Avant ce module, le moteur générait un contenu détaillé en markdown libre qui
 * n'était JAMAIS persisté de façon exploitable (tronqué à 10k dans une
 * FileValidation), donc les supports (slides, livret, exercices) ne pouvaient
 * lire que les TITRES du programme → supports « squelette ».
 *
 * Ce schéma définit une structure RICHE et EXPLOITABLE, persistée dans
 * `Formation.programmeDetaille.contenuDetaille`, que les builders de supports
 * consomment pour produire de vrais livrables (diaporama rédigé, cahier
 * d'exercices AVEC corrigés, guide d'animation minute par minute, quiz…).
 *
 * Chaque séquence porte :
 *  - des concepts expliqués (pas juste nommés),
 *  - un exemple concret sectoriel,
 *  - des points de vigilance,
 *  - un exercice réalisable AVEC son corrigé,
 *  - une note d'animation formateur,
 *  - des adaptations présentiel / distanciel (chantier modalité).
 */

import { z } from "zod";

// ── Concept expliqué ──────────────────────────────────────────────────────────

export const ConceptCleSchema = z.object({
  titre: z.string().min(2),
  /** Explication rédigée (2-5 phrases), pas un simple intitulé. */
  explication: z.string().min(20),
});

export type ConceptCle = {
  titre: string;
  explication: string;
};

// ── Exercice + corrigé ────────────────────────────────────────────────────────

export const ExerciceSchema = z.object({
  consigne: z.string().min(10),
  dureeMin: z.number().int().min(1).max(240),
  /** Corrigé / éléments de réponse attendus — réservé au formateur. */
  corrige: z.string().min(10),
  /** Critères de réussite observables (alignés sur les objectifs). */
  criteresReussite: z.array(z.string().min(3)).default([]),
});

export type Exercice = {
  consigne: string;
  dureeMin: number;
  corrige: string;
  criteresReussite: string[];
};

// ── Question de quiz (évaluation formative) ───────────────────────────────────

export const QuizItemSchema = z
  .object({
    question: z.string().min(8),
    /** 2 à 5 options de réponse. */
    options: z.array(z.string().min(1)).min(2).max(5),
    /** Index (0-based) de la bonne réponse dans `options`. */
    bonneReponseIndex: z.number().int().min(0),
    /** Explication pédagogique de la bonne réponse. */
    explication: z.string().min(10),
  })
  // L'index de bonne réponse DOIT pointer dans `options` (sinon corrigé faux).
  .superRefine((q, ctx) => {
    if (q.bonneReponseIndex >= q.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `bonneReponseIndex (${q.bonneReponseIndex}) hors de options (${q.options.length})`,
        path: ["bonneReponseIndex"],
      });
    }
  });

export type QuizItem = {
  question: string;
  options: string[];
  bonneReponseIndex: number;
  explication: string;
};

// ── Séquence pédagogique détaillée ────────────────────────────────────────────

export const SequenceContenuSchema = z.object({
  titre: z.string().min(2),
  dureeMin: z.number().int().min(1).max(480),
  /** Concepts clés expliqués (1-6). */
  concepts: z.array(ConceptCleSchema).min(1),
  /** Exemple concret ancré dans un contexte métier réel (obligatoire). */
  exempleConcret: z.string().min(20),
  /** Pièges / points de vigilance (peut être vide). */
  pointsVigilance: z.array(z.string().min(5)).default([]),
  /** Exercice pratique avec corrigé (optionnel pour une séquence purement théorique). */
  exercice: ExerciceSchema.optional(),
  /** Note d'animation destinée au formateur (posture, questions à poser…). */
  noteFormateur: z.string().min(10),
  /** Adaptation présentiel (atelier salle, binômes…) si pertinent. */
  adaptationPresentiel: z.string().optional(),
  /** Adaptation distanciel (breakout, doc partagé, pause écran…) si pertinent. */
  adaptationDistanciel: z.string().optional(),
});

export type SequenceContenu = {
  titre: string;
  dureeMin: number;
  concepts: ConceptCle[];
  exempleConcret: string;
  pointsVigilance: string[];
  exercice?: Exercice;
  noteFormateur: string;
  adaptationPresentiel?: string;
  adaptationDistanciel?: string;
};

// ── Module détaillé ───────────────────────────────────────────────────────────

export const ModuleContenuSchema = z.object({
  moduleId: z.string().min(1),
  titre: z.string().min(2),
  /** Accroche d'ouverture du module (pourquoi c'est utile). */
  introduction: z.string().min(20),
  sequences: z.array(SequenceContenuSchema).min(1),
  /** Synthèse / points clés à retenir en fin de module. */
  synthese: z.string().min(20),
  /** Quiz d'évaluation formative (2-6 questions) — peut être vide. */
  quiz: z.array(QuizItemSchema).default([]),
});

export type ModuleContenu = {
  moduleId: string;
  titre: string;
  introduction: string;
  sequences: SequenceContenu[];
  synthese: string;
  quiz: QuizItem[];
};

// ── Contenu détaillé complet d'une formation ──────────────────────────────────

/**
 * Racine persistée dans `programmeDetaille.contenuDetaille`.
 * `version` permet d'invalider/migrer le format sans casser les anciennes
 * formations (les builders testent la présence + version).
 */
export const CONTENU_DETAILLE_VERSION = 1 as const;

export const ContenuDetailleSchema = z.object({
  version: z.literal(CONTENU_DETAILLE_VERSION),
  /** Modalité pour laquelle le contenu a été rédigé (traçabilité). */
  modalite: z.enum(["presentiel", "distanciel", "hybride"]),
  modules: z.array(ModuleContenuSchema).min(1),
  /** Modèle IA + date de génération (AI Act — traçabilité). */
  genereAvec: z.string().optional(),
  genereLe: z.string().optional(),
});

export type ContenuDetaille = {
  version: typeof CONTENU_DETAILLE_VERSION;
  modalite: "presentiel" | "distanciel" | "hybride";
  modules: ModuleContenu[];
  genereAvec?: string;
  genereLe?: string;
};

// ── Normalisation défensive de la sortie LLM ──────────────────────────────────

/**
 * Convertit récursivement les `null` en `undefined` et retire les clés d'objet
 * à valeur `null`. INDISPENSABLE avant `safeParse` : les LLM renvoient très
 * souvent les champs optionnels à `null` plutôt que de les omettre, or Zod
 * `.optional()`/`.default()` acceptent `undefined` mais REJETTENT `null`. Sans
 * ce nettoyage, un seul `null` (ex. `adaptationDistanciel: null`) ferait échouer
 * la validation du module entier. Ne mute pas l'entrée.
 */
export function stripNullsDeep(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) {
    return value.map(stripNullsDeep).filter((v) => v !== undefined);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripNullsDeep(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value;
}

// ── Helpers de lecture (utilisés par les builders de supports) ────────────────

/**
 * Extrait le `contenuDetaille` d'un `programmeDetaille` Prisma (Json) s'il est
 * présent ET valide ET à la bonne version. Retourne `null` sinon (fallback
 * squelette côté builder). Ne throw jamais — lecture défensive.
 */
export function readContenuDetaille(programmeDetaille: unknown): ContenuDetaille | null {
  if (programmeDetaille === null || typeof programmeDetaille !== "object") return null;
  const candidate = (programmeDetaille as Record<string, unknown>)["contenuDetaille"];
  if (candidate === undefined || candidate === null) return null;
  const parsed = ContenuDetailleSchema.safeParse(candidate);
  return parsed.success ? (parsed.data as ContenuDetaille) : null;
}

/** True si la formation possède un contenu détaillé riche exploitable. */
export function hasContenuDetaille(programmeDetaille: unknown): boolean {
  return readContenuDetaille(programmeDetaille) !== null;
}
