/**
 * Content Generator — Landing ville × section SECTEURS ÉCONOMIQUES DOMINANTS (Sprint v7 Phase 5+).
 *
 * Génère 100-200 mots sur les secteurs économiques dominants d'une ville,
 * partageable entre les 5 verticales. Format standardisé :
 * "À {ville}, les secteurs porteurs incluent {list}. Pour ces secteurs,
 *  l'IA opérationnelle permet de {cross-vertical use cases}."
 *
 * Speakable selector : `.speakable-secteurs`
 */

import { z } from "zod";
import { generate as routerGenerate } from "../providers/provider-router";
import { hashPrompt } from "../provenance/provenance-logger";
import { retrieve as kbRetrieve } from "../kb-client";
import { parseLlmJson } from "../shared/parse-llm-json";
import { escapeLlmInput } from "../shared/prompt-input-escape";

// ---------------------------------------------------------------------------
// Output schema (Zod)
// ---------------------------------------------------------------------------

const SecteursSchema = z.object({
  content: z
    .string()
    .min(50, "content trop court (min 50 chars)")
    .max(1500, "content trop long (max 1500 chars)"),
  speakable_selectors: z.array(z.string()).min(1),
});

export type SecteursResult = z.infer<typeof SecteursSchema>;

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export interface VilleSecteursParams {
  readonly ville: {
    readonly nameFr: string;
    readonly regionFr: string;
    readonly population?: number;
    readonly insee?: string;
  };
  readonly verticale: string;
}

// ---------------------------------------------------------------------------
// Quality threshold
// ---------------------------------------------------------------------------

const QUALITY_THRESHOLD = 55;

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Génère la section "Secteurs économiques dominants" pour une page ville × verticale.
 *
 * Retourne `null` si la génération échoue ou dépasse le budget coût.
 */
export async function generateVilleSecteurs(
  params: VilleSecteursParams,
): Promise<SecteursResult | null> {
  const { ville, verticale } = params;

  // 1. RAG — KB retrieve
  const kbFacts = await kbRetrieve({
    query: `secteurs économiques dominants ${ville.nameFr} ${verticale} PME industrie`,
    locale: "fr",
    k: 5,
    filters: {
      audiences: ["public"],
      types: ["industry_use_case", "methodology"],
    },
    mode: "fts",
  }).catch(() => []);

  const factsContext =
    kbFacts.length > 0
      ? `\n\nFAITS VÉRIFIÉS KB:\n${kbFacts.map((f) => `- ${f.excerpt ?? f.title}`).join("\n")}`
      : "";

  // 2. Escape inputs
  const safeVille = escapeLlmInput(ville.nameFr, { maxLen: 80 });
  const safeRegion = escapeLlmInput(ville.regionFr, { maxLen: 80 });
  const safeVerticale = escapeLlmInput(verticale, { maxLen: 60 });

  const systemPrompt = `Tu es expert SEO/AEO/GEO 2026 + content writer brand Axion-IA (consulting IA opérationnelle FR).

Contexte : page ville ${safeVille} (${safeRegion}), verticale ${safeVerticale}.

INTERDICTIONS STRICTES (cause de rejet auto si violé) :
- NDA, contact@axion-ia.com, durée d'audit fixe en jours
- Mentions partenariats fictifs avec des entreprises locales
- Clients fictifs nommés
- Adresse postale précise à ${safeVille}
- Promesses chiffrées non-justifiables (ROI X% sans contexte)

OBLIGATIONS :
- Mention naturelle "${safeVille}" 2-3 fois (pas keyword stuffing)
- Brand voice : sobre, factuel, opérationnel
- Output JSON strict : { "content": "...", "speakable_selectors": ["..."] }`;

  const userPrompt = `Génère une section "Secteurs économiques dominants" pour la ville ${safeVille} (${safeRegion}), applicable à la verticale ${safeVerticale}.

OBJECTIF : 100-200 mots décrivant les secteurs économiques porteurs de cette ville/région et les cas d'usage IA cross-verticale pertinents.

## Format obligatoire
Commence par : "À ${safeVille}, les secteurs porteurs incluent [liste naturelle de 3-5 secteurs]."
Continue avec : "Pour ces secteurs, l'IA opérationnelle permet de [2-3 cas d'usage concrets liés à la verticale ${safeVerticale}]."
Termine avec : 1-2 phrases sur la spécificité locale qui justifie l'intervention Axion-IA.

## Contraintes
- Secteurs basés sur la réalité économique connue de ${safeVille}/${safeRegion} (industrie, services, commerce, logistique, santé, agriculture selon la ville)
- Cas d'usage IA : factuels, rattachés à la verticale ${safeVerticale}, sans promesses chiffrées inventées
- Pas de noms d'entreprises spécifiques (décrire le secteur, pas les acteurs nommés)
- Ton informatif et opérationnel (pas de marketing-speak)
${factsContext}

## Output attendu (JSON strict, sans balise markdown)
{
  "content": "100-200 mots prose HTML (balises <p> autorisées, pas de H2/H3)",
  "speakable_selectors": [".speakable-secteurs"]
}`;

  const promptHash = hashPrompt(systemPrompt + userPrompt);

  // 3. LLM call
  const MAX_ITERATIONS = 2;
  const BUDGET_CAP_USD = 0.05;
  let accumulatedCostUsd = 0;
  let bestResult: SecteursResult | null = null;
  let bestScore = -1;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const llmResult = await routerGenerate({
      jobId: `secteurs-${ville.insee ?? safeVille}-${safeVerticale}`,
      contentType: "landing_ville",
      role: "text",
      systemPrompt,
      userPrompt,
      maxTokens: 600,
      temperature: iteration === 0 ? 0.4 : 0.25,
      preferredProvider: "anthropic",
    }).catch(() => null);

    if (!llmResult) break;
    accumulatedCostUsd += llmResult.costUsd;

    let parsed: SecteursResult;
    try {
      parsed = SecteursSchema.parse(parseLlmJson(llmResult.output));
    } catch {
      if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
      continue;
    }

    // Score basé sur la longueur cible
    const words = parsed.content
      .replace(/<[^>]+>/g, " ")
      .split(/\s+/)
      .filter(Boolean).length;
    const score =
      words >= 100 && words <= 200 ? QUALITY_THRESHOLD + 10 : words >= 70 ? QUALITY_THRESHOLD : 30;

    if (score > bestScore) {
      bestScore = score;
      bestResult = parsed;
    }

    if (score >= QUALITY_THRESHOLD) break;
    if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
  }

  void promptHash; // AI Act art. 50 audit trail
  return bestResult;
}
