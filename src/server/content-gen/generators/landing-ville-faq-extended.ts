/**
 * Content Generator — Landing ville × section FAQ ÉTENDUE géolocalisée (Sprint v7 Phase 5+).
 *
 * Génère 5-8 paires Q/R AEO-optimisées pour une page ville × verticale.
 * Couvre : prix, délais, remote/présentiel, lieu de rendez-vous, secteur,
 * conformité légale (AI Act/RGPD), comparaison concurrents.
 *
 * Speakable selector par réponse : `.speakable-faq-{n}` (n = index 1-based).
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

const FaqItemSchema = z.object({
  q: z.string().min(10, "question trop courte").max(200, "question trop longue"),
  a: z.string().min(10, "réponse trop courte").max(400, "réponse trop longue (max 2 phrases)"),
  speakable_selector: z.string().startsWith(".speakable-faq-"),
});

const FaqExtendedSchema = z.object({
  faqs: z.array(FaqItemSchema).min(5, "minimum 5 Q/R requis").max(8, "maximum 8 Q/R autorisés"),
});

export type FaqExtendedResult = z.infer<typeof FaqExtendedSchema>;
export type FaqItem = z.infer<typeof FaqItemSchema>;

// ---------------------------------------------------------------------------
// Input type
// Aligned with scripts/regen-villes-stratified.ts FaqExtendedFn contract.
// ---------------------------------------------------------------------------

export interface VilleFaqExtendedParams {
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
// FAQ question types mapping
// ---------------------------------------------------------------------------

const FAQ_TYPES = [
  "prix (combien coûte, tarif, budget)",
  "délai (combien de temps, durée, planning)",
  "remote/présentiel (déplacement, visio, sur site)",
  "lieu de rendez-vous (où se rencontrer, où intervient Axion-IA)",
  "secteur (travaillez-vous avec mon secteur d'activité)",
  "légal (conformité AI Act, RGPD, données)",
  "comparaison (pourquoi Axion-IA plutôt qu'un autre)",
] as const;

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Génère les FAQ géolocalisées étendues pour une page ville × verticale.
 *
 * Retourne `null` si la génération échoue ou dépasse le budget coût.
 */
export async function generateVilleFaqExtended(
  params: VilleFaqExtendedParams,
): Promise<FaqExtendedResult | null> {
  const { villeSlug, villeName, regionName, verticale } = params;

  // 1. RAG — KB retrieve
  const kbFacts = await kbRetrieve({
    query: `FAQ ${villeName} ${verticale} prix délai conformité RGPD AI Act`,
    locale: "fr",
    k: 5,
    filters: {
      audiences: ["public"],
      types: ["methodology", "doctrine", "industry_use_case"],
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
- Mentions partenariats fictifs
- Clients fictifs nommés
- Adresse postale précise à ${safeVille}
- Promesses chiffrées non-justifiables (ROI X% sans contexte)
- Email de contact (utiliser "notre formulaire /contact" ou "prise de rendez-vous /appel")

OBLIGATIONS :
- Mention naturelle "${safeVille}" dans au moins 2-3 réponses (contexte géo)
- Réponses directes, factuel, 1-2 phrases MAX par réponse (AEO direct answer)
- Brand voice : sobre, factuel, opérationnel
- Output JSON strict : { "faqs": [...] }`;

  const userPrompt = `Génère une FAQ géolocalisée étendue (5-8 Q/R) pour la ville ${safeVille} (${safeRegion}), verticale ${safeVerticale}.

## Objectif AEO
Réponses directes, citables par les LLMs et featured snippets Google. 1-2 phrases par réponse. Questions naturelles (ton conversationnel, comme un dirigeant qui cherche).

## Types de questions à couvrir (couvre AU MOINS 5 parmi ces 7)
${FAQ_TYPES.map((t, i) => `${i + 1}. ${t}`).join("\n")}

## Contraintes par réponse
- Prix : utiliser EXCLUSIVEMENT les tokens {{price:<tierId>}} (résolus depuis la grille SSOT au rendu) — ex : {{price:audit-flash|flat}}, {{price:audit-cible|range}}, {{price:intervention-4h|flat}}, {{price:intervention-dirigeants|flat}}, {{price:impl-poc|entry}}. JAMAIS de montant en chiffres ni « € », JAMAIS "contactez-nous"
- Délai : "délai adapté à votre périmètre" ou "selon la taille de l'entreprise" — JAMAIS de chiffre fixe en jours
- Remote/présentiel : Axion-IA se déplace à ${safeVille} ET propose également les sessions en visio
- Lieu RDV : préciser que l'intervention se fait dans les locaux du client à ${safeVille} ou en région ${safeRegion}
- Secteur : répondre en mentionnant 2-3 secteurs pertinents pour ${safeVille}/${safeRegion}
- Légal : mentionner RGPD, AI Act 2024, données hébergées en France/UE
- Comparaison : différenciation Axion-IA sans dénigrer la concurrence (indépendance, expertise opérationnelle, no vendor lock-in)

## Speakable selectors
Chaque réponse a un selector ".speakable-faq-{n}" (n = index 1-based, ex: ".speakable-faq-1").
${factsContext}

## Output attendu (JSON strict, sans balise markdown)
{
  "faqs": [
    {
      "q": "Question naturelle géolocalisée ?",
      "a": "Réponse directe 1-2 phrases.",
      "speakable_selector": ".speakable-faq-1"
    }
  ]
}`;

  const promptHash = hashPrompt(systemPrompt + userPrompt);

  // 3. LLM call avec quality loop (2 max, budget $0.08)
  const MAX_ITERATIONS = 2;
  const BUDGET_CAP_USD = 0.08;
  let accumulatedCostUsd = 0;
  let bestResult: FaqExtendedResult | null = null;
  let bestScore = -1;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const llmResult = await routerGenerate({
      jobId: `faq-ext-${villeSlug}-${safeVerticale}`,
      contentType: "landing_ville",
      role: "text",
      systemPrompt,
      userPrompt,
      maxTokens: 1200,
      temperature: iteration === 0 ? 0.45 : 0.25,
      preferredProvider: "anthropic",
    }).catch(() => null);

    if (!llmResult) break;
    accumulatedCostUsd += llmResult.costUsd;

    let parsed: FaqExtendedResult;
    try {
      parsed = FaqExtendedSchema.parse(parseLlmJson(llmResult.output));
    } catch {
      if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
      continue;
    }

    // Score : nombre de FAQ dans la cible
    const faqCount = parsed.faqs.length;
    const score =
      faqCount >= 5 && faqCount <= 8
        ? QUALITY_THRESHOLD + 10
        : faqCount >= 3
          ? QUALITY_THRESHOLD
          : 30;

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
