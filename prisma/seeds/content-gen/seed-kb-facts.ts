/**
 * Seed KB facts sectoriels dans KnowledgeEntry + KnowledgeTranslation.
 *
 * P4 Sprint — KB pilote verticale `audits` (10 facts vérifiés).
 * P6 2026-05-22 — 4 nouvelles verticales : interventions-formations (32),
 *                  un-a-un (28), implementations (32), sites-web-augmentes (28).
 * Sources : AI Act EUR-Lex, BPI France, ANSSI, CNIL, ISO, Syntec Numérique,
 *           DARES, OCDE, McKinsey, Gartner, ICF France, DGE, Axion-IA terrain,
 *           Nielsen Norman Group, HubSpot, Semrush, GitHub.
 *
 * Idempotent : upsert sur le slug unique. Run 2× = même résultat.
 */

import type { PrismaClient } from "../../generated/client";
import { KB_AUDITS } from "../../../src/server/content-gen/kb/audits";
import { KB_INTERVENTIONS_FORMATIONS } from "../../../src/server/content-gen/kb/interventions-formations";
import { KB_UN_A_UN } from "../../../src/server/content-gen/kb/un-a-un";
import { KB_IMPLEMENTATIONS } from "../../../src/server/content-gen/kb/implementations";
import { KB_SITES_WEB_AUGMENTES } from "../../../src/server/content-gen/kb/sites-web-augmentes";
import type { KbFact } from "../../../src/server/content-gen/kb/audits";
import { servicesForVerticales, serviceTagSlug } from "../../../src/content/knowledge/services";

/** Tous les facts sectoriels à seeder. Idempotent : upsert sur slug unique. */
const ALL_KB_FACTS: readonly KbFact[] = [
  ...KB_AUDITS,
  ...KB_INTERVENTIONS_FORMATIONS,
  ...KB_UN_A_UN,
  ...KB_IMPLEMENTATIONS,
  ...KB_SITES_WEB_AUGMENTES,
];

async function upsertFact(prisma: PrismaClient, fact: KbFact): Promise<void> {
  const entrySlug = `kb-fact-${fact.id}`;

  const entry = await prisma.knowledgeEntry.upsert({
    where: { slug: entrySlug },
    update: {
      status: "published",
      pipelineStage: "published",
      audience: "public",
      publishedAt: new Date(fact.verifiedAt),
    },
    create: {
      slug: entrySlug,
      type: "industry_use_case",
      domain: "commercial",
      audience: "public",
      confidentiality: "public",
      status: "published",
      pipelineStage: "published",
      publishedAt: new Date(fact.verifiedAt),
    },
  });

  const translationSlug = `${entrySlug}-fr`;
  const title = fact.text.slice(0, 120).replace(/[.…]$/, "") + "…";
  const bodyHtml = `<p>${fact.text}</p><p><em>Source : <a href="${fact.sourceUrl}" rel="noopener noreferrer">${fact.source}</a></em></p>`;
  const bodyText = `${fact.text} Source : ${fact.source}.`;

  await prisma.knowledgeTranslation.upsert({
    where: { locale_slug: { locale: "fr", slug: translationSlug } },
    update: {
      title,
      body: bodyHtml,
      bodyText,
      excerpt: fact.text.slice(0, 300),
      metaTitle: title.slice(0, 70),
      qualityScore: fact.confidence,
      wordCount: bodyText.split(/\s+/).length,
    },
    create: {
      entryId: entry.id,
      locale: "fr",
      slug: translationSlug,
      title,
      body: bodyHtml,
      bodyText,
      excerpt: fact.text.slice(0, 300),
      metaTitle: title.slice(0, 70),
      qualityScore: fact.confidence,
      wordCount: bodyText.split(/\s+/).length,
    },
  });

  // KB V4.1 Service Binding — tags `service:*` dérivés de `fact.verticales`.
  // Rend la KB requêtable par service (reader `listEntriesByService`) + alimente
  // le bloc « connaissances liées » des pages services. Idempotent (upsert tag +
  // upsert lien). Un fait peut appartenir à plusieurs services (multi-verticale).
  for (const def of servicesForVerticales(fact.verticales)) {
    const tag = await prisma.knowledgeTag.upsert({
      where: { slug: serviceTagSlug(def.slug) },
      update: { nameFr: def.tagNameFr, nameEn: def.tagNameEn },
      create: {
        slug: serviceTagSlug(def.slug),
        nameFr: def.tagNameFr,
        nameEn: def.tagNameEn,
      },
    });
    await prisma.knowledgeTagOnEntry.upsert({
      where: { entryId_tagId: { entryId: entry.id, tagId: tag.id } },
      update: {},
      create: { entryId: entry.id, tagId: tag.id },
    });
  }
}

export async function seedKbFacts(prisma: PrismaClient): Promise<number> {
  let upserted = 0;

  for (const fact of ALL_KB_FACTS) {
    await upsertFact(prisma, fact);
    upserted++;
  }

  return upserted;
}
