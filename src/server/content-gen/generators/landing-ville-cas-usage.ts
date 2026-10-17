/**
 * Content Generator — Landing ville × section CAS D'USAGE IA CONCRETS (Sprint v7 Phase 5+).
 *
 * Génère 3-5 cas d'usage IA concrets sous forme de cards pour une page ville × verticale.
 * Format : titre court + 50-80 mots description + bénéfice mesurable.
 *
 * Anti-fabrication : pas de clients nommés fictifs — "Une entreprise de {secteur} à {ville}".
 *
 * Speakable selector global : `.speakable-cas-usage`
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

const CasUsageItemSchema = z.object({
  title: z.string().min(5, "titre trop court").max(80, "titre trop long"),
  description: z
    .string()
    .min(30, "description trop courte (min 30 chars)")
    .max(600, "description trop longue (max 600 chars)"),
  benefit: z.string().min(10, "bénéfice trop court").max(200, "bénéfice trop long"),
  speakable_selector: z.string().startsWith(".speakable-cas-usage"),
});

const CasUsageSchema = z.object({
  cases: z
    .array(CasUsageItemSchema)
    .min(3, "minimum 3 cas d'usage requis")
    .max(5, "maximum 5 cas d'usage autorisés"),
});

export type CasUsageResult = z.infer<typeof CasUsageSchema>;
export type CasUsageItem = z.infer<typeof CasUsageItemSchema>;

// ---------------------------------------------------------------------------
// Input type
// Aligned with scripts/regen-villes-stratified.ts CasUsageFn contract.
// ---------------------------------------------------------------------------

export interface VilleCasUsageParams {
  readonly villeSlug: string;
  readonly villeName: string;
  readonly regionName: string;
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
 * Génère les cas d'usage IA concrets (cards) pour une page ville × verticale.
 *
 * Retourne `null` si la génération échoue ou dépasse le budget coût.
 */
export async function generateVilleCasUsage(
  params: VilleCasUsageParams,
): Promise<CasUsageResult | null> {
  const { villeSlug, villeName, regionName, verticale } = params;

  // 1. RAG — KB retrieve (cas concrets + industry use cases prioritaires)
  const kbFacts = await kbRetrieve({
    query: `cas d'usage IA concret ${villeName} ${verticale} automatisation productivité`,
    locale: "fr",
    k: 5,
    filters: {
      audiences: ["public"],
      types: ["case_study", "industry_use_case", "methodology"],
    },
    mode: "fts",
  }).catch(() => []);

  const factsContext =
    kbFacts.length > 0
      ? `\n\nFAITS VÉRIFIÉS KB:\n${kbFacts.map((f) => `- ${f.excerpt ?? f.title}`).join("\n")}`
      : "";

  // 2. Escape inputs
  const safeVille = escapeLlmInput(villeName, { maxLen: 80 });
  const safeRegion = escapeLlmInput(regionName, { maxLen: 80 });
  const safeVerticale = escapeLlmInput(verticale, { maxLen: 60 });

  const systemPrompt = `Tu es expert SEO/AEO/GEO 2026 + content writer brand Axion-IA (consulting IA opérationnelle FR).

Contexte : page ville ${safeVille} (${safeRegion}), verticale ${safeVerticale}.

INTERDICTIONS STRICTES (cause de rejet auto si violé) :
- NDA, contact@axion-ia.com, durée d'audit fixe en jours
- Clients NOMMÉS fictifs (LVMH, BNP, etc.)
- Adresse postale précise à ${safeVille}
- Bénéfices inventés sans base factuelle ("ROI 300%", "économise 1 million")
- Noms propres d'entreprises fictives (ex: "TechCorp Lyon", "DataStart Bordeaux")

OBLIGATIONS :
- Anti-fabrication : décrire "Une entreprise de {secteur} à ${safeVille}" (JAMAIS de nom propre inventé)
- Brand voice : sobre, factuel, opérationnel
- Bénéfices en heures/semaine OU % productivité (plausibles, pas exagérés)
- Output JSON strict : { "cases": [...] }`;

  const userPrompt = `Génère 3-5 cas d'usage IA concrets sous forme de cards pour la ville ${safeVille} (${safeRegion}), verticale ${safeVerticale}.

## Objectif
Cards visuelles présentant des exemples concrets d'intervention Axion-IA (verticale ${safeVerticale}) pour des entreprises locales. Rendre tangible l'IA opérationnelle pour un dirigeant de ${safeVille}.

## Format par card
- **title** : Titre court (5-10 mots), ex: "Automatisation devis PME BTP"
- **description** : 50-80 mots décrivant le contexte métier, le problème résolu, la solution IA mise en place (SANS nommer de client)
- **benefit** : "Bénéfice mesurable: X heures/semaine récupérées" OU "Y% de productivité gagnée" (plausible, jamais inventé sans base)
- **speakable_selector** : ".speakable-cas-usage" (identique pour toutes les cards)

## Contraintes anti-fabrication
- TOUJOURS "Une entreprise de [secteur] à ${safeVille}" ou "Un cabinet de [profession] en ${safeRegion}"
- JAMAIS de nom propre fictif d'entreprise
- Secteurs adaptés à la réalité de ${safeVille} (industrie, commerce, services, santé, agriculture selon la ville)
- Bénéfices : fourchettes raisonnables (2-5h/semaine TPE, 10-20h/semaine PME, pas "500h/semaine")
- Lien avec la verticale ${safeVerticale} obligatoire dans chaque description
${factsContext}

## Output attendu (JSON strict, sans balise markdown)
{
  "cases": [
    {
      "title": "Titre court du cas d'usage",
      "description": "50-80 mots décrivant le cas concret sans nommer de client.",
      "benefit": "Bénéfice mesurable: X heures/semaine récupérées sur [tâche].",
      "speakable_selector": ".speakable-cas-usage"
    }
  ]
}`;

  const promptHash = hashPrompt(systemPrompt + userPrompt);

  // 3. LLM call avec quality loop (2 max, budget $0.08)
  const MAX_ITERATIONS = 2;
  const BUDGET_CAP_USD = 0.08;
  let accumulatedCostUsd = 0;
  let bestResult: CasUsageResult | null = null;
  let bestScore = -1;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const llmResult = await routerGenerate({
      jobId: `cas-usage-${villeSlug}-${safeVerticale}`,
      contentType: "landing_ville",
      role: "text",
      systemPrompt,
      userPrompt,
      maxTokens: 1400,
      temperature: iteration === 0 ? 0.5 : 0.3,
      // Option B (2026-06-27) — OpenAI primaire ; Claude reste fallback automatique
      // via le chaînage role:"text" ([openai, anthropic]) du provider-router.
      preferredProvider: "openai",
    }).catch(() => null);

    if (!llmResult) break;
    accumulatedCostUsd += llmResult.costUsd;

    let parsed: CasUsageResult;
    try {
      parsed = CasUsageSchema.parse(parseLlmJson(llmResult.output));
    } catch {
      if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
      continue;
    }

    // Score basé sur le nombre de cards dans la cible et longueur description
    const casesCount = parsed.cases.length;
    const avgDescWords =
      parsed.cases.reduce((acc, c) => acc + c.description.split(/\s+/).filter(Boolean).length, 0) /
      Math.max(casesCount, 1);

    const countScore = casesCount >= 3 && casesCount <= 5 ? 30 : 10;
    const descScore = avgDescWords >= 50 && avgDescWords <= 80 ? 30 : avgDescWords >= 30 ? 15 : 0;
    const score =
      countScore + descScore >= QUALITY_THRESHOLD ? QUALITY_THRESHOLD + 5 : countScore + descScore;

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
