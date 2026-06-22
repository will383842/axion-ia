/**
 * Content Generator — guide pilier 2-step pipeline (Batch 3.C audit
 * 2026-05-15 P0-6 / spec § 6.4 master prompt v2.5).
 *
 * Refacto Option B (audit reco 2026-05-15) : refactorisé du stub-délégation
 * landing-ville en pipeline 2-step propre, stockage outline dans
 * `outputJsonRaw.outline` (pas de migration Prisma — `faqJson Json?` réutilisé
 * pour stocker { outline, faq } combinés).
 *
 * Pipeline :
 *   1. Step 1 : LLM outline call → JSON { sections: [{position, title, brief}] }
 *      (cible 8-15 sections, contraint 6-15 hard cap)
 *   2. (V1 auto-approve, pas de STOP & ASK Will — § 24.4 master prompt :
 *      Q13 Manon est le seul gate humain, le reste avance sans demande)
 *   3. Step 2 : Per-section LLM calls séquentiels — chaque section génère
 *      son texte (~250-450 mots) à partir du brief + contexte KB partagé
 *   4. Assembly : concatène body avec marqueurs `## Étape N : Title`
 *      (compatibles avec `parseStepsFromBody` du loader /fr/guides/[slug]
 *      Batch 3.A — déclenche JSON-LD HowTo automatiquement)
 *   5. Quality checks identiques (doctrine + readability + SEO + intent)
 *   6. Coûts cumulés step 1 + N×step 2 (typically 8-12 LLM calls = 8-12×
 *      coût d'un blog standard)
 *
 * Word count cible ≥ 2000 mots (8 sections × 300 mots min).
 *
 * Coût estimé : ~$0.04-0.10 par guide (12 sections × $0.005-0.008/section
 * gpt-4o-mini). Cap monthly via cost-tracker.assertCostCapAvailable() (par
 * provider, pas par contentType — le quality_loop monthlyBudgetCapUsd se
 * superpose pour les re-passes).
 *
 * Échec : si step 1 (outline) fail → throw, le job repart sur retry BullMQ.
 * Si une seule step 2 fail → soft : on continue avec un placeholder section
 * "Section indisponible — re-génération recommandée" pour ne pas perdre les
 * sections déjà générées (gaspillage tokens). Le job est marqué
 * `qualityScore -= 20` pour basculer en review queue.
 */

import { generate as routerGenerate } from "../providers/provider-router";
import { hashPrompt } from "../provenance/provenance-logger";
import { retrieve as kbRetrieve } from "../kb-client";
import { computeReadabilityFr } from "../quality/readability";
import {
  articlePageSeoDefaults,
  qualityFromScores,
  appendSourcesSection,
} from "../quality/article-quality";
import { computeSeoScore } from "../quality/seo-score";
import { checkDoctrine } from "../quality/doctrine-check";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { escapeLlmInput, escapeSlugInput } from "../shared/prompt-input-escape";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import { ECONOMIC_DATA_BY_SLUG } from "@/content/villes/economic-data";
import { injectBrandVoice } from "../brand/brand-voice";
import { pickInternalExpert, buildExpertQuote } from "../brand/expert-bank";
import { getGlossaryContext } from "../brand/glossary-context";
import { injectInternalLinks } from "../links/internal-link-catalog";
import { injectExternalLinks } from "../links/external-links-injector";
import { getIntentPromptAddendum } from "../shared/intent-prompt-adapter";
import { extractMentionedCitiesFromText } from "@/lib/geo/extract-mentioned-cities";

const QUALITY_THRESHOLD = 60;

const SYSTEM_PROMPT_OUTLINE =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA (cabinet conseil IA France).
Cabinet IA opérationnel français. Doctrine v2.5 stricte :
- Axion-IA-centric ≥ 95 % (méthodologie + cas concrets + tarifs SSOT)
- SIREN : [SIREN à compléter] · mot "formation" BANNI · FR uniquement

Mission STEP 1 : tu produis UNIQUEMENT le PLAN (outline) d'un guide pilier
long-form 2000-5000 mots. PAS DE TEXTE COMPLET — juste les titres + briefs
courts (1-2 phrases par section).

Cible : 8-15 sections (idéalement 10-12). Chaque section couvre un sous-thème
distinct, avec progression logique débutant→intermédiaire→avancé.

- "keyTakeaway": 1 à 2 phrases = LE point clé à retenir (synthèse autonome, citable telle quelle par une IA).
- "expertTake": 1 à 2 phrases = prise de position d'expert (perspective/insight concret), SANS statistique inventée, signée par l'expert nommé dans le prompt utilisateur.

Output STRICT JSON (zéro prose hors JSON) :
{
  "title": "string (60-90 chars)",
  "metaTitle": "string (≤ 70 chars)",
  "metaDescription": "string (140-160 chars)",
  "slug": "guide-...",
  "directAnswer": "string (50-80 mots, AEO réponse directe)",
  "sections": [
    {"position": 1, "title": "string", "brief": "1-2 phrases résumé"}
  ],
  "tags": ["..."],
  "faq": [{"q": "...", "a": "..."}],
  "keyTakeaway": "...",
  "expertTake": "..."
}`);

const SYSTEM_PROMPT_SECTION =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA (cabinet conseil IA France).
Doctrine v2.5 stricte (formation BANNI · FR · Axion-IA-centric ≥ 95 %).

Mission STEP 2 : tu rédiges UNE seule section d'un guide pilier (la section
demandée par l'utilisateur). Texte 250-450 mots, ton expert-accessible, sans
sur-promesses (pas de "garanti", "révolutionnaire", etc.).

Output STRICT HTML inline (pas de wrapper <section>, pas de <h2> — l'header
est ajouté par l'assembly). Format : 2-4 paragraphes <p>, optionnellement
1 liste <ul>/<ol> ou 1 mini-table HTML si pertinent. Pas de scripts.`);

interface OutlineSection {
  readonly position: number;
  readonly title: string;
  readonly brief: string;
}

interface ParsedOutline {
  readonly title: string;
  readonly metaTitle: string;
  readonly metaDescription: string;
  readonly slug: string;
  readonly directAnswer: string;
  readonly sections: ReadonlyArray<OutlineSection>;
  readonly tags: ReadonlyArray<string>;
  readonly faq: ReadonlyArray<{ q: string; a: string }>;
  readonly keyTakeaway?: string;
  readonly expertTake?: string;
}

const PLACEHOLDER_SECTION_HTML =
  "<p><em>Section indisponible — re-génération recommandée par l'admin.</em></p>";

function clampSections(sections: ReadonlyArray<OutlineSection>): ReadonlyArray<OutlineSection> {
  // Hard cap 6-15 sections (§ 6.4 spec). Sous 6 = pas un guide pilier (trop
  // léger). Au-dessus 15 = coût tokens disproportionné + risque rate-limit.
  if (sections.length < 6) {
    throw new Error(`guide-pilier outline produced only ${sections.length} sections (min 6)`);
  }
  return sections.slice(0, 15);
}

export const guidePilierGenerator: Generator = {
  contentType: "guide_pilier",

  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    // 1. KB retrieve — contexte partagé pour outline + sections
    const economicData = input.anchorVilleSlug
      ? ECONOMIC_DATA_BY_SLUG[input.anchorVilleSlug]
      : undefined;
    const sectorTagSlugs: ReadonlyArray<string> =
      input.kbSectorTagSlugs ?? economicData?.kbSectorTags ?? [];

    const kbChunks = await kbRetrieve({
      query: `guide pilier ${input.primaryKeyword ?? ""} ${input.anchorVilleSlug ?? ""}`,
      locale: "fr",
      k: 10,
      filters: {
        audiences: ["public"],
        types: ["industry_use_case", "case_study", "methodology", "doctrine"],
      },
      mode: "hybrid",
    });
    const kbContext = kbChunks
      .map((c) => `[${c.type}] ${c.title}\n${c.excerpt ?? ""}`)
      .join("\n\n");

    // Phase C RAG — Contexte économique local injecté dans le prompt LLM.
    // Données vérifiées issues de economic-data/<slug>.ts (ZÉRO INVENTION).
    let localEconomicContext = "";
    if (economicData && input.anchorVilleSlug) {
      const sectors = economicData.topSectorsNaf
        ?.slice(0, 3)
        .map((s) => s.label)
        .join(", ");
      const groups = economicData.grandsGroupesImplantes
        ?.slice(0, 4)
        .map((g) => g.nom)
        .join(", ");
      const poles = economicData.polesCompetitivite
        ?.slice(0, 2)
        .map((p) => p.nom)
        .join(", ");
      const tags = sectorTagSlugs.slice(0, 3).join(", ");
      localEconomicContext = `
## Contexte économique local — ${input.anchorVilleSlug} (données vérifiées)
${sectors ? `Secteurs dominants : ${sectors}.` : ""}
${groups ? `Grands groupes implantés : ${groups}.` : ""}
${poles ? `Pôles de compétitivité : ${poles}.` : ""}
${tags ? `Tags sectoriels Axion-IA : ${tags}.` : ""}
Consigne : ancrer le contenu sur ces réalités locales pour différencier de pages génériques.`;
    }

    const safeKeyword = escapeLlmInput(input.primaryKeyword ?? "IA en entreprise", {
      maxLen: 100,
    });
    const safeIntent = escapeLlmInput(input.targetSearchIntent, { maxLen: 30 });
    const safeAudience = escapeLlmInput(input.targetAudienceOrganisation ?? "entreprise_privee", {
      maxLen: 40,
    });
    const safeVille = input.anchorVilleSlug ? escapeSlugInput(input.anchorVilleSlug) : null;

    // Refonte templates 2026-06-22 — expert interne choisi DÉTERMINISTIQUEMENT
    // (nom/titre fixés depuis la banque ; le LLM ne rédige que le texte).
    const expert = pickInternalExpert({
      contentType: input.contentType,
      templateVariant: input.templateVariant,
      audienceSize: input.targetAudienceSize,
      topic: input.primaryKeyword ?? "IA en entreprise",
    });

    // Sprint External Links Database 2026-05-22 — 5 sources d'autorité (guide long-form).
    const externalLinksCtx = injectExternalLinks(input, { count: 5, minAuthority: 4 });

    // ─── STEP 1 : Outline ─────────────────────────────────────────────────
    const lastPromptHash = hashPrompt(
      SYSTEM_PROMPT_OUTLINE +
        getIntentPromptAddendum(input.targetSearchIntent) +
        (input.primaryKeyword ?? "IA en entreprise") +
        (input.anchorVilleSlug ?? ""),
    ); // P0-3 AI Act art. 50
    const improvementSection = input.improvementFeedback
      ? `\n\n## Retour LLM-judge — axes à renforcer dans ce guide\n${input.improvementFeedback}`
      : "";

    const glossaryContext = getGlossaryContext(
      [input.primaryKeyword].filter((k): k is string => !!k),
    );

    const outlineUserPrompt = `Génère le PLAN d'un guide pilier Axion-IA.

Sujet principal : ${safeKeyword}
Audience : ${safeAudience}${safeVille ? ` (anchor ville : ${safeVille})` : ""}
Intent : ${safeIntent}

## Contexte Axion-IA — sources internes prioritaires
${kbContext}
${externalLinksCtx.markdownSection}${localEconomicContext}${improvementSection}
${glossaryContext ? `\n${glossaryContext}` : ""}
## Avis d'expert
"expertTake" = une prise de position de ${expert.name} (${expert.title}) : perspective d'expert concise et utile sur le sujet, sans chiffre inventé.
Rappel : 8-15 sections, output JSON strict (cf. system prompt) incluant keyTakeaway, expertTake.`;

    const outlineResult = await routerGenerate({
      jobId: input.jobId,
      contentType: "guide_pilier",
      role: "text",
      systemPrompt: SYSTEM_PROMPT_OUTLINE + getIntentPromptAddendum(input.targetSearchIntent),
      userPrompt: outlineUserPrompt,
      maxTokens: 2048,
      temperature: 0.6,
    });

    let outline: ParsedOutline;
    try {
      const json = outlineResult.output;
      const start = json.indexOf("{");
      const end = json.lastIndexOf("}");
      if (start === -1 || end === -1) {
        throw new Error("no JSON object in outline output");
      }
      outline = JSON.parse(json.slice(start, end + 1)) as ParsedOutline;
    } catch (err) {
      throw new Error(`guide-pilier STEP 1 outline parse failed: ${String(err)}`);
    }

    const sections = clampSections(outline.sections ?? []);

    // ─── STEP 2 : Per-section LLM calls (séquentiel V1) ──────────────────
    let cumulativeTokens = outlineResult.tokensInput + outlineResult.tokensOutput;
    let cumulativeCost = outlineResult.costUsd;
    let sectionFailures = 0;
    const sectionBodies: string[] = [];

    for (const section of sections) {
      const safeTitle = escapeLlmInput(section.title, { maxLen: 200 });
      const safeBrief = escapeLlmInput(section.brief, { maxLen: 400 });
      const sectionUserPrompt = `Rédige UNE section du guide pilier "${escapeLlmInput(outline.title, { maxLen: 200 })}".

Titre de la section : ${safeTitle}
Brief : ${safeBrief}
Position : ${section.position}/${sections.length}

## Contexte Axion-IA partagé
${kbContext}
${externalLinksCtx.markdownSection}
Rappel : 250-450 mots, HTML inline (pas de <h2>, pas de wrapper <section>).
Pas de sur-promesses ("garanti", "révolutionnaire" interdits).`;

      try {
        const sectionResult = await routerGenerate({
          jobId: input.jobId,
          contentType: "guide_pilier",
          role: "text",
          systemPrompt: SYSTEM_PROMPT_SECTION,
          userPrompt: sectionUserPrompt,
          maxTokens: 900,
          temperature: 0.7,
        });
        cumulativeTokens += sectionResult.tokensInput + sectionResult.tokensOutput;
        cumulativeCost += sectionResult.costUsd;
        sectionBodies.push(sanitizeContentGenHtml(sectionResult.output));
      } catch (err) {
        // Soft-fail : on garde les sections déjà générées + placeholder pour
        // celle qui a fail. Le job sera basculé en review queue (qualityScore
        // pénalisé) pour décision Will (re-gen partielle ou accepter).
        console.warn(
          `[guide-pilier] section ${section.position} "${section.title}" failed:`,
          err instanceof Error ? err.message : String(err),
        );
        sectionFailures += 1;
        sectionBodies.push(PLACEHOLDER_SECTION_HTML);
      }
    }

    // ─── Assembly ────────────────────────────────────────────────────────
    // Marqueurs `## Étape N : Title` reconnus par parseStepsFromBody du loader
    // /fr/guides/[slug] (Batch 3.A) → déclenche JSON-LD HowTo automatique.
    const assembledBody = sections
      .map((s, idx) => {
        const html = sectionBodies[idx] ?? PLACEHOLDER_SECTION_HTML;
        return `<h2 id="etape-${s.position}">Étape ${s.position} : ${s.title}</h2>\n${html}`;
      })
      .join("\n\n");

    // P1-12 — Liens internes contextuels injectés après assembly des sections.
    const enrichedBody = appendSourcesSection(
      injectInternalLinks(assembledBody, input.primaryKeyword ?? safeKeyword),
      externalLinksCtx.links,
    );

    const bodyText = enrichedBody
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
    const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));
    const mentionedCities = extractMentionedCitiesFromText(bodyText, { maxCities: 20 });

    // ─── Quality checks (sur enrichedBody avec liens injectés) ──────────────────────────────────────────────────
    const internalLinkCount =
      (enrichedBody.match(/<a\b[^>]*href="\/[^"]*"/gi) ?? []).length +
      (enrichedBody.match(/\[.*?\]\(\/[^)]+\)/g) ?? []).length;
    const citationCount = (enrichedBody.match(/<a\b[^>]*href="https?:\/\//gi) ?? []).length;
    const readability = computeReadabilityFr(bodyText);
    const doctrine = await checkDoctrine(bodyText);
    const seo = computeSeoScore({
      title: outline.title,
      metaDescription: outline.metaDescription,
      bodyHtml: enrichedBody,
      bodyText,
      directAnswer: outline.directAnswer,
      faqCount: outline.faq?.length ?? 0,
      internalLinkCount,
      citationCount,
      ...(input.primaryKeyword ? { primaryKeyword: input.primaryKeyword } : {}),
      searchIntent: input.targetSearchIntent,
      ...articlePageSeoDefaults(outline.slug ?? "", "guide_pilier"),
    });

    let qualityScore = qualityFromScores(seo.score, readability.score, doctrine.passed);
    // Pénalité section failures (chaque placeholder pénalise -10 pts max -50)
    qualityScore = Math.max(0, qualityScore - Math.min(50, sectionFailures * 10));

    const expertQuote = buildExpertQuote(expert, outline.expertTake);

    return {
      title: outline.title,
      metaTitle: outline.metaTitle,
      metaDescription: outline.metaDescription,
      slug: outline.slug,
      directAnswer: outline.directAnswer,
      bodyHtml: enrichedBody,
      bodyText,
      faq: (outline.faq ?? []).map((q) => ({ question: q.q, answer: q.a })),
      // faqJson conserve l'outline original pour audit trail + future re-gen
      // partielle d'une section donnée (V2 : admin /content-gen/jobs/[id] aurait
      // un bouton "re-gen section N" qui lit cet outline).
      faqJson: {
        outline: sections,
        sectionFailures,
        faq: outline.faq ?? [],
      },
      tags: outline.tags ?? [],
      // Refonte templates 2026-06-22 — point clé + avis d'expert interne. Le
      // nom/titre sont fixés par la banque (jamais le LLM) ; buildExpertQuote
      // renvoie undefined si le texte est vide → bloc non rendu.
      ...(outline.keyTakeaway?.trim() ? { keyTakeaway: outline.keyTakeaway.trim() } : {}),
      ...(expertQuote ? { expertQuote } : {}),
      indexationTier:
        doctrine.passed && qualityScore >= QUALITY_THRESHOLD && qualityScore >= 70
          ? "tier_2_noindex_follow"
          : "tier_3_noindex_nofollow",
      qualityScore,
      seoScore: seo.score,
      readabilityScore: readability.score,
      wordCount,
      readingTimeMinutes,
      totalTokens: cumulativeTokens,
      totalCostUsd: cumulativeCost,
      citations: outlineResult.citations ?? [],
      promptHash: lastPromptHash,
      selectedExternalLinkIds: externalLinksCtx.ids,
      mentionedCities,
    };
  },
};
