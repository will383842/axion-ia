/**
 * Qualiopi — Formation Engine T4 : Évaluation qualité via IA.
 *
 * Appelle `anthropicProvider.generate()` (IProvider) avec le system prompt
 * d'évaluation (cache_control ephemeral côté Anthropic) et le contenu à évaluer.
 *
 * Parsing défensif : si la réponse n'est pas du JSON valide ou si un score est
 * manquant, score = 0 pour le critère. Si le parsing échoue globalement :
 * scoreGlobal = 0, valide = false, commentaire = message d'erreur.
 *
 * Champs exacts lus dans `GenerationResponse` (anthropic.ts) :
 *   output, tokensInput, tokensOutput, costUsd, model
 */

import { anthropicProvider } from "@/server/content-gen/providers/anthropic";
import { buildEvalSystemPrompt, buildEvalUserPrompt } from "@/server/qualiopi/engine/prompts";
import { computeWeightedScore } from "@/server/qualiopi/engine/scoring";
import type { GrilleCriteres } from "@/server/qualiopi/engine/grille-schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EvaluateFormationInput {
  formationId: string;
  contenu: string;
  criteres: GrilleCriteres;
  scorePlancher: number;
}

export interface EvaluateFormationResult {
  scoreGlobal: number;
  parCritere: Record<string, number>;
  valide: boolean;
  commentaire: string;
  /** Métadonnées de traçabilité (AI Act) */
  _meta: {
    model: string;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
  };
}

// ── Parsing défensif de la réponse IA ────────────────────────────────────────

/**
 * Extrait un JSON depuis la réponse brute. Tente un nettoyage minimal
 * (suppression de blocs markdown ```json...```).
 */
function extractJson(raw: string): Record<string, unknown> | null {
  // Nettoyage éventuel de blocs markdown
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extrait un score numérique depuis une valeur inconnue.
 * Clampé à [0, 100]. Retourne 0 si absent ou non parsable.
 */
function extractScore(val: unknown): number {
  if (typeof val === "number") return Math.max(0, Math.min(100, Math.round(val)));
  if (typeof val === "string") {
    const n = parseFloat(val);
    if (!isNaN(n)) return Math.max(0, Math.min(100, Math.round(n)));
  }
  return 0;
}

// ── Évaluation principale ─────────────────────────────────────────────────────

/**
 * Évalue la qualité pédagogique d'un contenu de formation via IA (Claude).
 *
 * - Appelle `anthropicProvider.generate()` avec un `jobId` synthétique pour
 *   la traçabilité cost-tracker.
 * - Le system prompt intègre la grille (cache hit Anthropic).
 * - Parse la réponse JSON de manière défensive.
 * - Calcule le score global pondéré via `computeWeightedScore`.
 * - En cas d'échec de parsing : scoreGlobal=0, valide=false.
 */
export async function evaluateFormationQuality(
  input: EvaluateFormationInput,
): Promise<EvaluateFormationResult> {
  const { formationId, contenu, criteres, scorePlancher } = input;

  const systemPrompt = buildEvalSystemPrompt(criteres);
  const userPrompt = buildEvalUserPrompt(contenu, criteres);

  // jobId synthétique pour traçabilité cost-tracker (AXI-EVAL-<formationId>)
  const jobId = `AXI-EVAL-${formationId}`;

  let rawOutput: string;
  let model: string;
  let tokensInput: number;
  let tokensOutput: number;
  let costUsd: number;

  try {
    const response = await anthropicProvider.generate({
      jobId,
      contentType: "qualiopi_evaluation",
      role: "text",
      systemPrompt,
      userPrompt,
      maxTokens: 1024,
      temperature: 0,
    });

    // Champs exacts de GenerationResponse (lus dans IProvider.ts + anthropic.ts)
    rawOutput = response.output;
    model = response.model;
    tokensInput = response.tokensInput;
    tokensOutput = response.tokensOutput;
    costUsd = response.costUsd;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      scoreGlobal: 0,
      parCritere: Object.fromEntries(criteres.map((c) => [c.id, 0])),
      valide: false,
      commentaire: `Erreur lors de l'appel IA : ${msg}`,
      _meta: { model: "unknown", tokensInput: 0, tokensOutput: 0, costUsd: 0 },
    };
  }

  // Parsing défensif
  const parsed = extractJson(rawOutput);
  if (!parsed) {
    return {
      scoreGlobal: 0,
      parCritere: Object.fromEntries(criteres.map((c) => [c.id, 0])),
      valide: false,
      commentaire: `Réponse IA non parsable (format JSON attendu). Réponse brute : ${rawOutput.slice(0, 200)}`,
      _meta: { model, tokensInput, tokensOutput, costUsd },
    };
  }

  // Extraction des scores par critère
  const parCritere: Record<string, number> = {};
  for (const critere of criteres) {
    parCritere[critere.id] = extractScore(parsed[critere.id]);
  }

  // Commentaire global
  const commentaire =
    typeof parsed["commentaire"] === "string"
      ? parsed["commentaire"]
      : "Aucun commentaire fourni par l'évaluateur IA.";

  // Score global pondéré
  const scoreGlobal = computeWeightedScore(parCritere, criteres);
  const valide = scoreGlobal >= scorePlancher;

  return {
    scoreGlobal,
    parCritere,
    valide,
    commentaire,
    _meta: { model, tokensInput, tokensOutput, costUsd },
  };
}
