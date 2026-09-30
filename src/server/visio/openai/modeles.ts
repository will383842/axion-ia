/**
 * Les MODÈLES OpenAI du circuit visio — constantes uniques (ADR 0055 ;
 * LOTS-EXECUTION §1.2 et §1.3).
 *
 * Jamais une variable d'environnement : changer de modèle se fait par une PR,
 * fondée sur une mesure (campagne O-2a), jamais par un réglage. Et AUCUN
 * repli automatique vers un autre modèle : une sortie refusée ou tronquée est
 * une erreur (`passe.ts`), pas une raison d'essayer ailleurs
 * (`__tests__/aucun-repli-vers-un-autre-modele.spec.ts`).
 *
 * Module PUR.
 */

/**
 * Transcription : seul modèle (avec `whisper-1`) qui rende des segments
 * HORODATÉS, et de la famille GPT-4o (plus juste que Whisper V2). Ses
 * étiquettes de voix (`A`, `B`…) sur la piste client détectent seules qu'il y
 * a plusieurs personnes côté client.
 */
export const MODELE_TRANSCRIPTION = "gpt-4o-transcribe-diarize" as const;

/** Rédaction (P1 à P6, lecture des réponses, e-mail de suivi). */
export const MODELE_REDACTION = "gpt-6-sol" as const;

/** Tous les modèles que le circuit a le droit d'appeler. */
export const MODELES_VISIO = [MODELE_TRANSCRIPTION, MODELE_REDACTION] as const;
export type ModeleVisio = (typeof MODELES_VISIO)[number];

/** Langue demandée à la transcription (SUPPOSÉ accepté : essai de fumée de la PR 6). */
export const LANGUE_TRANSCRIPTION = "fr" as const;

/** Les passes qui appellent l'API Responses. */
export const PASSES_IA = [
  "extraire",
  "rattacher",
  "consolider",
  "ebaucher",
  "rediger",
  "questionnaire",
  "lire_reponses",
  "email_suivi",
] as const;
export type PasseIA = (typeof PASSES_IA)[number];

/** L'extraction (P1) est la seule passe difficile : effort `high`. */
export const EFFORT_PAR_PASSE: Readonly<Record<PasseIA, "low" | "medium" | "high">> = {
  extraire: "high",
  rattacher: "medium",
  consolider: "medium",
  ebaucher: "medium",
  rediger: "medium",
  questionnaire: "medium",
  lire_reponses: "medium",
  email_suivi: "medium",
};

/** `max_output_tokens` : 32 000 pour P1, 16 000 pour les autres. */
export const MAX_SORTIE_PAR_PASSE: Readonly<Record<PasseIA, number>> = {
  extraire: 32_000,
  rattacher: 16_000,
  consolider: 16_000,
  ebaucher: 16_000,
  rediger: 16_000,
  questionnaire: 16_000,
  lire_reponses: 16_000,
  email_suivi: 16_000,
};

/**
 * Estimations passées au plafond de dépense AVANT l'appel (§1.4) : 0,03 $ par
 * tranche de transcription ; 0,50 $ pour P1 ; 0,20 $ pour les autres passes.
 */
export const ESTIMATION_TRANCHE_USD = 0.03;
export const ESTIMATION_PASSE_USD: Readonly<Record<PasseIA, number>> = {
  extraire: 0.5,
  rattacher: 0.2,
  consolider: 0.2,
  ebaucher: 0.2,
  rediger: 0.2,
  questionnaire: 0.2,
  lire_reponses: 0.2,
  email_suivi: 0.2,
};

/** Délai visé « Arrêter → compte rendu à valider » pour un appel d'une heure (mesuré en O-1). */
export const DELAI_COMPTE_RENDU_MIN = 25;
