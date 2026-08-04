/**
 * Seed ContentTemplate — 9 templates V1 (1 par ContentType).
 *
 * Sprint 1 Day 1 = STUB minimaux (systemPrompt placeholder).
 * Sprint 2 Day 3-7 = remplit systemPrompt complet depuis les sub-prompts
 *   `.claude/skills/axionia-content-generator/prompts/*.md` (megapack).
 *
 * Variantes landing ville × 6 ajoutées Sprint 2 Day 1 (default + secteur-industrie
 * + secteur-tertiaire + secteur-public + taille-tpe + taille-eti).
 */

import type { PrismaClient } from "../../generated/client";

const STUB_SYSTEM_PROMPT_PREFIX = `Tu es Manon, plume éditoriale d'Axion-IA (SAS française).
Doctrine v2.5 — AxionIA-centric ≥ 95 %, FR uniquement, anti-doorway HCU 2024,
WCAG 2.2 AA, pas du mot "formation".

Sub-prompt complet à charger Sprint 2 Day 3 depuis :
.claude/skills/axionia-content-generator/prompts/<type>.md (megapack).`;

const STUB_USER_PROMPT_TEMPLATE = `<<spec à remplir Sprint 2 Day 3 — variables Mustache {{ville}}, {{audience}}, etc.>>`;

const STUB_OUTPUT_SCHEMA_ZOD = `z.object({ title: z.string(), excerpt: z.string(), body: z.string() })`;

export async function seedContentTemplates(prisma: PrismaClient): Promise<number> {
  const templates = [
    {
      slug: "landing-ville-default-v1",
      contentType: "landing_ville" as const,
      variant: "default",
      name: "Page ville (par défaut)",
    },
    {
      slug: "blog-article-v1",
      contentType: "blog_article" as const,
      variant: null,
      name: "Article de blog générique",
    },
    {
      slug: "blog-from-rss-v1",
      contentType: "blog_from_rss" as const,
      variant: null,
      name: "Article depuis une actualité (RSS)",
    },
    {
      slug: "blog-from-keywords-v1",
      contentType: "blog_from_keywords" as const,
      variant: null,
      name: "Article depuis des mots-clés",
    },
    {
      slug: "blog-from-title-v1",
      contentType: "blog_from_title" as const,
      variant: null,
      name: "Article depuis un titre saisi",
    },
    {
      slug: "comparison-v1",
      contentType: "comparison" as const,
      variant: null,
      name: "Comparatif d'outils et de services",
    },
    {
      slug: "guide-pilier-v1",
      contentType: "guide_pilier" as const,
      variant: null,
      name: "Guide pilier (contenu de fond)",
    },
    {
      slug: "qa-derived-v1",
      contentType: "qa_derived" as const,
      variant: null,
      name: "Question-réponse dérivée (automatique)",
    },
    {
      slug: "faq-standalone-v1",
      contentType: "faq_standalone" as const,
      variant: null,
      name: "FAQ autonome (page dédiée)",
    },
  ];

  let count = 0;
  for (const t of templates) {
    await prisma.contentTemplate.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        contentType: t.contentType,
        variant: t.variant,
        version: 1,
        isActive: true,
        name: t.name,
        description: `Template stub V1 — Sprint 1 Day 1 AGT-A (system prompt complet en Sprint 2 Day 3).`,
        systemPrompt: STUB_SYSTEM_PROMPT_PREFIX,
        userPromptTemplate: STUB_USER_PROMPT_TEMPLATE,
        outputSchemaZod: STUB_OUTPUT_SCHEMA_ZOD,
        variables: {},
        expansionMode: "manual",
      },
      update: {
        // Sprint 2 Day 3 écrasera systemPrompt avec les vrais prompts megapack.
        // Pour Sprint 1, on ne touche pas au systemPrompt si déjà présent.
        contentType: t.contentType,
        variant: t.variant,
        name: t.name,
        isActive: true,
      },
    });
    count++;
  }
  return count;
}
