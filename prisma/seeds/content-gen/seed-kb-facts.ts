/**
 * Seed KB facts sectoriels dans KnowledgeEntry + KnowledgeTranslation.
 *
 * P4 Sprint — KB pilote verticale `audits` (10 facts vérifiés).
 * Sources : AI Act EUR-Lex, BPI France, ANSSI, CNIL, ISO, Syntec Numérique.
 *
 * Idempotent : upsert sur le slug unique. Run 2× = même résultat.
 */

import type { PrismaClient } from "../../generated/client";
import { KB_AUDITS } from "../../../src/server/content-gen/kb/audits";

export async function seedKbFacts(prisma: PrismaClient): Promise<number> {
  let upserted = 0;

  for (const fact of KB_AUDITS) {
    const entrySlug = `kb-fact-${fact.id}`;

    const entry = await prisma.knowledgeEntry.upsert({
      where: { slug: entrySlug },
      update: { status: "published", pipelineStage: "published", audience: "public", publishedAt: new Date(fact.verifiedAt) },
      create: { slug: entrySlug, type: "industry_use_case", domain: "commercial", audience: "public", confidentiality: "public", status: "published", pipelineStage: "published", publishedAt: new Date(fact.verifiedAt) },
    });

    const translationSlug = `${entrySlug}-fr`;
    const title = fact.text.slice(0, 120).replace(/[.…]$/, "") + "…";
    const bodyHtml = `<p>${fact.text}</p><p><em>Source : <a href="${fact.sourceUrl}" rel="noopener noreferrer">${fact.source}</a></em></p>`;
    const bodyText = `${fact.text} Source : ${fact.source}.`;

    await prisma.knowledgeTranslation.upsert({
      where: { locale_slug: { locale: "fr", slug: translationSlug } },
      update: { title, body: bodyHtml, bodyText, excerpt: fact.text.slice(0, 300), metaTitle: title.slice(0, 70), qualityScore: fact.confidence, wordCount: bodyText.split(/\s+/).length },
      create: { entryId: entry.id, locale: "fr", slug: translationSlug, title, body: bodyHtml, bodyText, excerpt: fact.text.slice(0, 300), metaTitle: title.slice(0, 70), qualityScore: fact.confidence, wordCount: bodyText.split(/\s+/).length },
    });

    upserted++;
  }

  return upserted;
}
