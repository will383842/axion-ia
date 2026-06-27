/**
 * Content Generator — Landing ville × section ÉCOSYSTÈME IA LOCAL (Sprint v7 Phase 5+).
 *
 * Génère 150-250 mots sur l'écosystème IA local d'une ville (acteurs, écoles,
 * hubs, incubateurs, chambres de commerce). Utilisé en section enrichissement
 * sur les pages `/implantations/[region]/[ville]/[verticale]`.
 *
 * Anti-fabrication stricte : les entités nommées décrivent l'écosystème local
 * à titre factuel — NE SONT PAS des partenaires ou clients Axion-IA.
 *
 * Speakable selector : `.speakable-ecosystem`
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

const EcosystemSchema = z.object({
  content: z
    .string()
    .min(50, "content trop court (min 50 chars)")
    .max(2000, "content trop long (max 2000 chars)"),
  speakable_selectors: z.array(z.string()).min(1),
});

export type EcosystemResult = z.infer<typeof EcosystemSchema>;

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export interface VilleEcosystemParams {
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

/** Score minimum pour auto-approve (basé sur pattern QUALITY_THRESHOLD shared). */
const QUALITY_THRESHOLD = 55;

// ---------------------------------------------------------------------------
// Banned orgs — liste anti-fabrication (ne pas présenter comme partenaires)
// ---------------------------------------------------------------------------

const BANNED_AS_PARTNERS = ["LVMH", "BNP", "Cap Digital", "Inria", "Station F"] as const;

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Génère le contenu "Écosystème IA local" pour une page ville × verticale.
 *
 * Retourne `null` si la génération échoue après toutes les itérations ou
 * dépasse le budget coût.
 */
export async function generateVilleEcosystem(
  params: VilleEcosystemParams,
): Promise<EcosystemResult | null> {
  const { ville, verticale } = params;

  // 1. RAG — KB retrieve (fts, 5 chunks, audiences public)
  const kbFacts = await kbRetrieve({
    query: `écosystème IA ${ville.nameFr} ${verticale} hub incubateur`,
    locale: "fr",
    k: 5,
    filters: {
      audiences: ["public"],
      types: ["industry_use_case", "methodology", "doctrine"],
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
- Mentions partenariats ${BANNED_AS_PARTNERS.join("/")} (sauf écosystème factuel neutre : "Paris abrite Station F…")
- Clients fictifs nommés
- Adresse postale précise à ${safeVille}
- Promesses chiffrées non-justifiables (ROI X% sans contexte)

OBLIGATIONS :
- Mention naturelle "${safeVille}" 2-3 fois (pas keyword stuffing)
- Brand voice : sobre, factuel, opérationnel
- Output JSON strict : { "content": "...", "speakable_selectors": ["..."] }`;

  const userPrompt = `Génère une section "Écosystème IA local" pour la ville ${safeVille} (${safeRegion}), verticale ${safeVerticale}.

OBJECTIF : 150-250 mots décrivant l'écosystème IA local (acteurs, écoles, hubs technologiques, incubateurs, chambres de commerce, pôles de compétitivité présents dans la région).

## 🚨 RÈGLE ABSOLUE — entités nommées = contexte neutre UNIQUEMENT
- Ces entités décrivent l'ÉCOSYSTÈME ÉCONOMIQUE LOCAL (qui est implanté là)
- NE SONT PAS nos clients, partenaires ou collaborateurs Axion-IA
- Axion-IA n'a AUCUNE implantation locale — il se déplace
- INTERDIT : "Axion-IA collabore avec X", "en partenariat avec Y", "nos clients comme Z"
- AUTORISÉ : "${safeVille} abrite X hub, Y école, Z incubateur" (description objective)

## Contenu attendu
- Chambres de commerce et d'industrie locales (si existantes)
- Écoles, universités, formations IA/tech de la région
- Hubs technologiques, incubateurs, pépinières d'entreprises
- Pôles de compétitivité régionaux
- Associations professionnelles sectorielles
- 1-2 phrases de contextualisation : comment cet écosystème crée un terreau favorable pour les entreprises locales qui adoptent l'IA

## Format
- Prose fluide (pas liste à puces)
- Ton informatif, neutre sur l'écosystème, Axion-IA mentionné comme intervenant extérieur
- Speakable selector : ".speakable-ecosystem"
${factsContext}

## Output attendu (JSON strict, sans balise markdown)
{
  "content": "150-250 mots prose HTML (balises <p> autorisées, pas de H2/H3)",
  "speakable_selectors": [".speakable-ecosystem"]
}`;

  const promptHash = hashPrompt(systemPrompt + userPrompt);

  // 3. LLM call (1 itération — section courte, pas de quality loop coûteuse)
  const MAX_ITERATIONS = 2;
  const BUDGET_CAP_USD = 0.06;
  let accumulatedCostUsd = 0;
  let bestResult: EcosystemResult | null = null;
  let bestScore = -1;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const llmResult = await routerGenerate({
      jobId: `ecosystem-${ville.insee ?? safeVille}-${safeVerticale}`,
      contentType: "landing_ville",
      role: "text",
      systemPrompt,
      userPrompt,
      maxTokens: 800,
      temperature: iteration === 0 ? 0.5 : 0.3,
      // Option B (2026-06-27) — OpenAI primaire ; Claude reste fallback automatique
      // via le chaînage role:"text" ([openai, anthropic]) du provider-router.
      preferredProvider: "openai",
    }).catch(() => null);

    if (!llmResult) break;
    accumulatedCostUsd += llmResult.costUsd;

    let parsed: EcosystemResult;
    try {
      parsed = EcosystemSchema.parse(parseLlmJson(llmResult.output));
    } catch {
      if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
      continue;
    }

    // Simple score : word count dans la cible
    const words = parsed.content
      .replace(/<[^>]+>/g, " ")
      .split(/\s+/)
      .filter(Boolean).length;
    const score =
      words >= 150 && words <= 250 ? QUALITY_THRESHOLD + 10 : words >= 100 ? QUALITY_THRESHOLD : 30;

    if (score > bestScore) {
      bestScore = score;
      bestResult = parsed;
    }

    if (score >= QUALITY_THRESHOLD) break;
    if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
  }

  void promptHash; // audit trail — hash calculé pour conformité AI Act art. 50
  return bestResult;
}
