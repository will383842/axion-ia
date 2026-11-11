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
import { resolvePriceTokens } from "../../../src/content/pricing-tokens";
import {
  raisonBlocage,
  verifierDoctrineFiche,
  type ViolationFiche,
} from "../../../src/lib/knowledge/banned-words";

/** Préfixe de la raison écrite dans `briefMarkdown` d'une fiche bloquée par le seed. */
export const MARQUEUR_DOCTRINE = "[doctrine] ";

export interface FicheExistante {
  readonly status: string;
  readonly deletedAt: Date | null;
  readonly briefMarkdown: string | null;
}

export interface PlanFiche {
  /** `published` | `draft` : statut à écrire ; `inchange` : ne rien toucher au statut. */
  readonly statut: "published" | "draft" | "inchange";
  /** Fiche retirée (supprimée, archivée, dépréciée) : le seed n'y touche jamais. */
  readonly retiree: boolean;
  /** Raison du brouillon, si la doctrine bloque. */
  readonly raison: string | null;
  /** Le seed peut-il écrire la raison dans `briefMarkdown` sans écraser une note de console ? */
  readonly ecrireRaison: boolean;
}

/**
 * Décision pure du seed pour une fiche (testable sans base).
 *  - jamais de remise en ligne d'une fiche retirée ni d'un statut choisi en console ;
 *  - une fiche qui viole la doctrine reste (ou repasse) en brouillon, avec sa raison ;
 *  - une fiche propre est publiée à la création ; si elle n'était en brouillon que par
 *    le fait du seed (marqueur), elle est publiée une fois corrigée.
 */
export function planifierFiche(
  existante: FicheExistante | null,
  violations: ReadonlyArray<ViolationFiche>,
): PlanFiche {
  const raison = violations.length > 0 ? raisonBlocage(violations) : null;
  if (existante === null) {
    return { statut: raison ? "draft" : "published", retiree: false, raison, ecrireRaison: true };
  }
  const retiree =
    existante.deletedAt !== null ||
    existante.status === "archived" ||
    existante.status === "deprecated";
  if (retiree) return { statut: "inchange", retiree: true, raison, ecrireRaison: false };
  const note = existante.briefMarkdown ?? "";
  const ecrireRaison = note === "" || note.startsWith(MARQUEUR_DOCTRINE);
  if (raison) {
    return {
      statut: existante.status === "published" ? "draft" : "inchange",
      retiree,
      raison,
      ecrireRaison: ecrireRaison || existante.status === "published",
    };
  }
  const bloqueeParSeed =
    existante.status === "draft" && (existante.briefMarkdown ?? "").startsWith(MARQUEUR_DOCTRINE);
  return {
    statut: bloqueeParSeed ? "published" : "inchange",
    retiree,
    raison,
    ecrireRaison: false,
  };
}

/** Tous les facts sectoriels à seeder. Idempotent : upsert sur slug unique. */
export const ALL_KB_FACTS: readonly KbFact[] = [
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

export async function upsertFact(prisma: PrismaClient, fact: KbFact): Promise<PlanFiche> {
  const entrySlug = `kb-fact-${fact.id}`;

  // Audit KB 2026-08-11 — les tokens `{{price:…}}` sont résolus À L'ÉCRITURE
  // (comme l'ingestion chatbot, cf. `seed-sources.ts`) : sans ça, le token part
  // brut dans la page publique /connaissances ET dans le grounding LLM.
  const factText = resolvePriceTokens(fact.text, "fr");
  // Revue de fraîcheur : due 90 j après la vérification du fait. Signal admin
  // AVANT le hard gate kb-health (180 j) — cf. `kb-health.ts`.
  const reviewDueAt = new Date(new Date(fact.verifiedAt).getTime() + 90 * 24 * 3600 * 1000);

  // Audit knowledge 08/11/2026 — doctrine À L'ENTRÉE. On contrôle le TEXTE du fait
  // (pas l'étiquette « Source : Axion-IA … » ajoutée au corps, qui n'est pas une
  // affirmation). Une fiche fautive reste en brouillon, avec la raison.
  const violations = verifierDoctrineFiche({ fait: factText });
  const existante = await prisma.knowledgeEntry.findUnique({
    where: { slug: entrySlug },
    select: { status: true, deletedAt: true, briefMarkdown: true },
  });
  const plan = planifierFiche(existante, violations);
  if (plan.raison) {
    console.warn(`[seed-kb-facts] ${fact.id} bloquée (brouillon) — ${plan.raison}`);
  }

  // Le seed ne fait JAMAIS : republier une fiche retirée, effacer `deletedAt`, ni
  // changer l'audience d'une fiche existante.
  const statutMaj =
    plan.statut === "inchange"
      ? {}
      : plan.statut === "published"
        ? {
            status: "published" as const,
            pipelineStage: "published" as const,
            audience: "public" as const,
            confidentiality: "public" as const,
          }
        : { status: "draft" as const, pipelineStage: "draft" as const };
  const brief = plan.raison
    ? plan.ecrireRaison
      ? { briefMarkdown: `${MARQUEUR_DOCTRINE}${plan.raison}` }
      : {}
    : plan.statut === "published" && existante?.briefMarkdown?.startsWith(MARQUEUR_DOCTRINE)
      ? { briefMarkdown: null }
      : {};
  const bloquee = plan.statut === "draft" || plan.raison !== null;

  const entry = await prisma.knowledgeEntry.upsert({
    where: { slug: entrySlug },
    update: {
      ...statutMaj,
      ...brief,
      ...(!bloquee &&
      !plan.retiree &&
      (plan.statut === "published" || existante?.status === "published")
        ? { publishedAt: new Date(fact.verifiedAt), reviewDueAt }
        : {}),
    },
    create: {
      slug: entrySlug,
      type: "industry_use_case",
      domain: "commercial",
      audience: bloquee ? "team" : "public",
      confidentiality: bloquee ? "internal" : "public",
      status: bloquee ? "draft" : "published",
      pipelineStage: bloquee ? "draft" : "published",
      publishedAt: bloquee ? null : new Date(fact.verifiedAt),
      reviewDueAt,
      ...brief,
    },
  });

  // Une fiche retirée garde son contenu : le seed n'y écrit plus rien (une fiche
  // dépréciée reste servie, un texte fautif y repartirait en public).
  if (plan.retiree) return plan;

  const translationSlug = `${entrySlug}-fr`;
  const title = factText.slice(0, 120).replace(/[.…]$/, "") + "…";
  const bodyHtml = `<p>${factText}</p><p><em>Source : <a href="${fact.sourceUrl}" rel="noopener noreferrer">${fact.source}</a></em></p>`;
  const bodyText = `${factText} Source : ${fact.source}.`;

  const translation = await prisma.knowledgeTranslation.upsert({
    where: { locale_slug: { locale: "fr", slug: translationSlug } },
    update: {
      title,
      body: bodyHtml,
      bodyText,
      excerpt: factText.slice(0, 300),
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
      excerpt: factText.slice(0, 300),
      metaTitle: title.slice(0, 70),
      qualityScore: fact.confidence,
      wordCount: bodyText.split(/\s+/).length,
    },
  });

  // KB-21 — Embedding vectoriel (RAG sémantique). N'écrit QUE des vecteurs réels
  // (Voyage AI) : si `VOYAGE_API_KEY` est absente, generateEmbedding renvoie un
  // stub SHA-256 non sémantique qu'on n'enregistre pas (la table reste vide →
  // la retrieval reste FTS). Idempotent (ON CONFLICT translation_id).
  if (embeddingsEnabled && !bloquee) {
    await upsertEmbedding(prisma, translation.id, {
      title,
      excerpt: factText.slice(0, 300),
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
  return plan;
}

/**
 * Réconciliation des suppressions — Audit KB 2026-08-11.
 *
 * Le seed est upsert-only : un fait PURGÉ des fichiers TS (ex. faits
 * « financement » retirés en juin 2026) restait publié en base à vie — servi en
 * page publique /connaissances ET récupérable par le RAG. Cette passe
 * soft-delete (deletedAt + status archived) toute entrée `kb-fact-*` absente de
 * `ALL_KB_FACTS`. Un fiche retirée reste
 * retirée : le seed ne remet JAMAIS `deletedAt` à null ni ne la republie (audit
 * knowledge 08/11/2026) ; la remettre en ligne est un geste de console.
 * Périmètre strict `kb-fact-` : ne touche jamais les entrées nées de la
 * factory/ingest (slugs différents).
 */
async function reconcileDeletedFacts(prisma: PrismaClient): Promise<number> {
  const keptSlugs = ALL_KB_FACTS.map((f) => `kb-fact-${f.id}`);
  const result = await prisma.knowledgeEntry.updateMany({
    where: {
      slug: { startsWith: "kb-fact-", notIn: keptSlugs },
      deletedAt: null,
    },
    data: { deletedAt: new Date(), status: "archived" },
  });
  return result.count;
}

export async function seedKbFacts(prisma: PrismaClient): Promise<number> {
  let upserted = 0;
  let bloquees = 0;
  let retirees = 0;

  console.log(
    embeddingsEnabled
      ? "[seed-kb-facts] VOYAGE_API_KEY présente → embeddings vectoriels seedés (RAG sémantique actif)."
      : "[seed-kb-facts] VOYAGE_API_KEY absente → embeddings non seedés (RAG reste FTS lexical). Re-run après pose de la clé pour activer le vectoriel.",
  );

  for (const fact of ALL_KB_FACTS) {
    const plan = await upsertFact(prisma, fact);
    upserted++;
    if (plan.raison) bloquees++;
    if (plan.retiree) retirees++;
  }
  if (bloquees > 0 || retirees > 0) {
    console.log(
      `[seed-kb-facts] ${bloquees} fiche(s) en brouillon (doctrine), ${retirees} fiche(s) retirée(s) laissée(s) telles quelles.`,
    );
  }

  const reconciled = await reconcileDeletedFacts(prisma);
  if (reconciled > 0) {
    console.log(
      `[seed-kb-facts] ${reconciled} fait(s) kb-fact-* absent(s) des fichiers TS → soft-deleted (archived).`,
    );
  }

  return upserted;
}
