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

import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../generated/client";
import { generateEmbedding, buildEmbeddingInput } from "../../../src/lib/knowledge/embeddings";
import { KB_AUDITS } from "../../../src/server/content-gen/kb/audits";
import { KB_INTERVENTIONS_FORMATIONS } from "../../../src/server/content-gen/kb/interventions-formations";
import { KB_UN_A_UN } from "../../../src/server/content-gen/kb/un-a-un";
import { KB_IMPLEMENTATIONS } from "../../../src/server/content-gen/kb/implementations";
import { KB_SITES_WEB_AUGMENTES } from "../../../src/server/content-gen/kb/sites-web-augmentes";
import { KB_VILLES_ALL } from "../../../src/server/content-gen/kb/villes-facts";
import type { KbFact } from "../../../src/server/content-gen/kb/audits";
import { servicesForVerticales, serviceTagSlug } from "../../../src/content/knowledge/services";

/** Tous les facts sectoriels à seeder. Idempotent : upsert sur slug unique. */
const ALL_KB_FACTS: readonly KbFact[] = [
  ...KB_AUDITS,
  ...KB_INTERVENTIONS_FORMATIONS,
  ...KB_UN_A_UN,
  ...KB_IMPLEMENTATIONS,
  ...KB_SITES_WEB_AUGMENTES,
  // Sprint A Ville DRY — 180 facts villes/AI Act/ROI IA (fix A4 : ingérés comme
  // les 5 autres verticales → KnowledgeEntry + KnowledgeTranslation + embeddings).
  // Les verticales `villes`/`ai_act` ne correspondent à aucun service du SSOT
  // `services.ts` : `servicesForVerticales` renvoie [] pour elles (pas de binding,
  // pas d'erreur). Les facts taggés `audits`/`implementations` restent bindés.
  ...KB_VILLES_ALL,
];

/**
 * Embeddings KB activés uniquement si une vraie clé Voyage est présente.
 * Sans clé : on n'écrit aucun vecteur (la retrieval reste FTS lexical).
 */
const embeddingsEnabled = !!process.env.VOYAGE_API_KEY;

/**
 * Upsert idempotent d'un embedding 1024-dim dans `knowledge_embeddings`.
 * La colonne `embedding vector(1024)` est de type `Unsupported` côté Prisma →
 * écriture via raw SQL (littéral pgvector inline, valeurs numériques sûres).
 * Skip silencieux si l'embedding produit est un stub (pas de clé Voyage).
 */
async function upsertEmbedding(
  prisma: PrismaClient,
  translationId: string,
  input: { title: string; excerpt?: string | null; bodyText?: string | null },
): Promise<void> {
  const result = await generateEmbedding(buildEmbeddingInput(input), "public");
  if (result.modelVersion.endsWith("-stub")) return; // garde-fou : jamais de vecteur stub en base
  const vecLiteral = `[${result.embedding.map((x) => (Number.isFinite(x) ? x : 0)).join(",")}]`;
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO knowledge_embeddings (id, translation_id, embedding, model, model_version, dimensionality, embedded_at)
    VALUES ($1::uuid, $2::uuid, '${vecLiteral}'::vector, $3, $4, $5, NOW())
    ON CONFLICT (translation_id) DO UPDATE SET
      embedding = '${vecLiteral}'::vector,
      model = $3,
      model_version = $4,
      dimensionality = $5,
      embedded_at = NOW();
    `,
    randomUUID(),
    translationId,
    result.model,
    result.modelVersion,
    result.dimensionality,
  );
}

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

  const translation = await prisma.knowledgeTranslation.upsert({
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

  // KB-21 — Embedding vectoriel (RAG sémantique). N'écrit QUE des vecteurs réels
  // (Voyage AI) : si `VOYAGE_API_KEY` est absente, generateEmbedding renvoie un
  // stub SHA-256 non sémantique qu'on n'enregistre pas (la table reste vide →
  // la retrieval reste FTS). Idempotent (ON CONFLICT translation_id).
  if (embeddingsEnabled) {
    await upsertEmbedding(prisma, translation.id, {
      title,
      excerpt: fact.text.slice(0, 300),
      bodyText,
    });
  }

  // KB V4.1 Service Binding — tags `service:*` + bindings dérivés de
  // `fact.verticales`. Rend la KB requêtable par service (reader
  // `listEntriesByService`), alimente le bloc « connaissances liées » + le
  // CTA/Offer. Idempotent. Un fait peut appartenir à plusieurs services
  // (multi-verticale) ; le 1er est marqué `isPrimary`.
  const boundServices = servicesForVerticales(fact.verticales);
  for (let i = 0; i < boundServices.length; i++) {
    const def = boundServices[i]!;
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

    // Binding gouvernance (override admin + variante cible futurs). `isPrimary`
    // sur le 1er service. `update: {}` → un override admin (source:"admin") n'est
    // pas écrasé par un re-seed.
    await prisma.knowledgeServiceBinding.upsert({
      where: { entryId_serviceKind: { entryId: entry.id, serviceKind: def.slug } },
      update: {},
      create: {
        entryId: entry.id,
        serviceKind: def.slug,
        isPrimary: i === 0,
        source: "seed",
      },
    });
  }
}

export async function seedKbFacts(prisma: PrismaClient): Promise<number> {
  let upserted = 0;

  console.log(
    embeddingsEnabled
      ? "[seed-kb-facts] VOYAGE_API_KEY présente → embeddings vectoriels seedés (RAG sémantique actif)."
      : "[seed-kb-facts] VOYAGE_API_KEY absente → embeddings non seedés (RAG reste FTS lexical). Re-run après pose de la clé pour activer le vectoriel.",
  );

  for (const fact of ALL_KB_FACTS) {
    await upsertFact(prisma, fact);
    upserted++;
  }

  return upserted;
}
