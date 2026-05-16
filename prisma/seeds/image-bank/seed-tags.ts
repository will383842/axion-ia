/**
 * Image-bank — Seed tags (10 tags de base FR + EN).
 * Idempotent via upsert.
 */

import type { PrismaClient } from "@prisma/client";

type TagSeed = { slug: string; name: { fr: string; en: string } };

const TAGS: ReadonlyArray<TagSeed> = [
  { slug: "ia-operationnelle", name: { fr: "IA opérationnelle", en: "Operational AI" } },
  { slug: "claude-anthropic", name: { fr: "Claude Anthropic", en: "Claude Anthropic" } },
  { slug: "audit-ia", name: { fr: "Audit IA", en: "AI audit" } },
  { slug: "automatisation", name: { fr: "Automatisation", en: "Automation" } },
  { slug: "chatbot", name: { fr: "Chatbot", en: "Chatbot" } },
  { slug: "agent-ia", name: { fr: "Agent IA", en: "AI agent" } },
  { slug: "no-code", name: { fr: "No-code", en: "No-code" } },
  { slug: "rgpd", name: { fr: "RGPD", en: "GDPR" } },
  {
    slug: "transformation-digitale",
    name: { fr: "Transformation digitale", en: "Digital transformation" },
  },
  { slug: "productivite", name: { fr: "Productivité", en: "Productivity" } },
] as const;

export async function seedImageTags(client: PrismaClient): Promise<number> {
  let count = 0;
  for (const tag of TAGS) {
    const created = await client.imageTag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: { slug: tag.slug },
    });

    for (const lang of ["fr", "en"] as const) {
      await client.imageTagTranslation.upsert({
        where: {
          tagId_languageCode: {
            tagId: created.id,
            languageCode: lang,
          },
        },
        update: { name: tag.name[lang], slug: tag.slug },
        create: {
          tagId: created.id,
          languageCode: lang,
          name: tag.name[lang],
          slug: tag.slug,
        },
      });
    }
    count++;
  }
  return count;
}
