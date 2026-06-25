/**
 * Expansion d'outline par TRANCHES (architecture multi-appels content-gen).
 *
 * Contexte (audit content-gen profond 2026-06-25) : le mono-appel JSON faisait
 * écrire le modèle court (~350-850 mots, finish_reason stop) car il devait
 * produire title+meta+FAQ+body en un objet. On scinde la rédaction du corps en
 * plusieurs appels, chacun ne développant que `chunkSize` sections de l'outline.
 * Moins de sections par appel = plus de tokens/attention par section = sections
 * pleines (130-190 mots) et corps long (1200-1500 mots pour 8 sections en 2×4).
 *
 * Ce helper fait UNE passe d'expansion complète (toutes les tranches) et
 * concatène le HTML. La boucle qualité (retry sur score) reste côté générateur :
 * il rappelle ce helper avec un `feedback` enrichi si le score est insuffisant.
 *
 * Réutilisé par tous les générateurs blog (rollout 2026-06-25) pour une qualité
 * homogène.
 */
import { generate as routerGenerate } from "../providers/provider-router";
import { parseLlmJson } from "./parse-llm-json";

export interface OutlineSection {
  readonly h2: string;
  readonly brief: string;
}

export interface ExpandOutlineChunkedOpts {
  readonly jobId: string;
  readonly contentType: string;
  readonly outline: ReadonlyArray<OutlineSection>;
  /** Nombre de sections par appel (4 → 8 sections = 2 appels). */
  readonly chunkSize: number;
  /** System prompt de rédaction du corps (règles AEO/grounding/anti-hype). */
  readonly expandSystem: string;
  /**
   * Construit le user prompt d'une tranche. `chunkText` = l'outline numéroté de
   * la tranche ; `isFirst`/`isLast` permettent d'ajuster intro/transition.
   */
  readonly buildUserPrompt: (args: {
    chunkText: string;
    isFirst: boolean;
    isLast: boolean;
    sectionStart: number;
  }) => string;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface ExpandOutlineChunkedResult {
  readonly bodyHtml: string;
  readonly costUsd: number;
  readonly tokensInput: number;
  readonly tokensOutput: number;
  /** Nombre d'appels LLM effectués (= nb de tranches). */
  readonly calls: number;
}

/**
 * Développe l'outline en bodyHtml en `ceil(outline.length / chunkSize)` appels
 * LLM séquentiels, puis concatène. Une tranche dont le JSON est invalide
 * contribue une chaîne vide (le générateur verra un corps court et pourra
 * retenter via sa boucle qualité).
 */
export async function expandOutlineChunked(
  opts: ExpandOutlineChunkedOpts,
): Promise<ExpandOutlineChunkedResult> {
  const chunks: OutlineSection[][] = [];
  for (let i = 0; i < opts.outline.length; i += opts.chunkSize) {
    chunks.push(opts.outline.slice(i, i + opts.chunkSize) as OutlineSection[]);
  }

  let bodyHtml = "";
  let costUsd = 0;
  let tokensInput = 0;
  let tokensOutput = 0;
  let calls = 0;

  for (let c = 0; c < chunks.length; c++) {
    const sectionStart = c * opts.chunkSize;
    const chunk = chunks[c] ?? [];
    const chunkText = chunk
      .map((s, i) => `${sectionStart + i + 1}. ${s.h2} — ${s.brief}`)
      .join("\n");

    const res = await routerGenerate({
      jobId: opts.jobId,
      contentType: opts.contentType,
      role: "text",
      systemPrompt: opts.expandSystem,
      userPrompt: opts.buildUserPrompt({
        chunkText,
        isFirst: c === 0,
        isLast: c === chunks.length - 1,
        sectionStart,
      }),
      maxTokens: opts.maxTokens ?? 5000,
      temperature: opts.temperature ?? 0.7,
    });
    calls++;
    costUsd += res.costUsd;
    tokensInput += res.tokensInput;
    tokensOutput += res.tokensOutput;

    let chunkBody = "";
    try {
      const parsed = parseLlmJson<{ bodyHtml?: string }>(res.output);
      chunkBody = parsed.bodyHtml ?? "";
    } catch {
      chunkBody = "";
    }
    if (chunkBody) bodyHtml += (bodyHtml ? "\n" : "") + chunkBody;
  }

  return { bodyHtml, costUsd, tokensInput, tokensOutput, calls };
}
