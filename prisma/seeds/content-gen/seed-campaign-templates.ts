/**
 * Seed campaign template presets (D-P5-1 Sprint P5, mis à jour P6 2026-05-22).
 * Couvre les 5 verticales Axion-IA × TPE/PME/ETI/GE.
 * Idempotent via upsert on slug.
 */

import type { PrismaClient } from "../../generated/client";

const ALL_VERTICALS = [
  "interventions_formations",
  "audits",
  "implementations",
  "un_a_un",
  "sites_web_augmentes",
];

const ALL_TARGETS = ["tpe", "pme", "eti", "ge"];

const TEMPLATES = [
  // ── Preset universel ────────────────────────────────────────────────────
  {
    slug: "toutes-verticales-general",
    name: "Toutes verticales — Général",
    description:
      "Campagne générale couvrant les 5 services Axion-IA pour toutes tailles d'entreprise — blog depuis keywords, 30/j.",
    config: {
      verticals: ALL_VERTICALS,
      target: ALL_TARGETS,
      types: ["blog_from_keywords", "qa_derived"],
      batchSize: 30,
      dailyCap: 30,
      cityProcessingMode: "sequential",
    },
  },

  // ── Par verticale, toutes cibles ────────────────────────────────────────
  {
    slug: "interventions-formations-all",
    name: "Interventions & Formations — Toutes cibles",
    description: "Articles formations IA pour TPE, PME, ETI et GE — blog pilier + keywords + Q/R.",
    config: {
      verticals: ["interventions_formations"],
      target: ALL_TARGETS,
      types: ["blog_pillar", "blog_from_keywords", "qa_derived"],
      batchSize: 30,
      dailyCap: 30,
    },
  },
  {
    slug: "audits-all",
    name: "Audits IA — Toutes cibles",
    description: "Articles audit IA + landing pages villes pour toutes tailles d'entreprise.",
    config: {
      verticals: ["audits"],
      target: ALL_TARGETS,
      types: ["blog_pillar", "landing_ville", "blog_from_keywords"],
      batchSize: 20,
      dailyCap: 30,
      cityProcessingMode: "sequential",
    },
  },
  {
    slug: "implementations-all",
    name: "Implémentations IA — Toutes cibles",
    description:
      "Articles implémentations IA (chatbots, RAG, automatisation) pour toutes tailles d'entreprise.",
    config: {
      verticals: ["implementations"],
      target: ALL_TARGETS,
      types: ["blog_pillar", "blog_from_keywords", "comparison"],
      batchSize: 20,
      dailyCap: 30,
    },
  },
  {
    slug: "un-a-un-all",
    name: "Coaching 1-to-1 IA — Toutes cibles",
    description: "Articles coaching individuel IA pour dirigeants et managers — blog pilier + Q/R.",
    config: {
      verticals: ["un_a_un"],
      target: ALL_TARGETS,
      types: ["blog_pillar", "qa_derived", "blog_from_keywords"],
      batchSize: 15,
      dailyCap: 20,
    },
  },
  {
    slug: "sites-web-augmentes-all",
    name: "Sites Web Augmentés IA — Toutes cibles",
    description:
      "Articles création/augmentation de sites web par l'IA pour toutes tailles d'entreprise.",
    config: {
      verticals: ["sites_web_augmentes"],
      target: ALL_TARGETS,
      types: ["blog_pillar", "blog_from_keywords", "comparison", "qa_derived"],
      batchSize: 20,
      dailyCap: 30,
    },
  },

  // ── Landing pages villes (toutes verticales) ────────────────────────────
  {
    slug: "landing-villes-all",
    name: "Landing pages villes — 5 verticales",
    description:
      "Landing pages géolocalisées pour les 120 villes FR — couvre toutes les verticales et toutes les cibles.",
    config: {
      verticals: ALL_VERTICALS,
      target: ALL_TARGETS,
      types: ["landing_ville"],
      batchSize: 20,
      dailyCap: 30,
      cityProcessingMode: "sequential",
    },
  },

  // ── RSS actualité IA ────────────────────────────────────────────────────
  {
    slug: "rss-daily",
    name: "RSS quotidien — Actualité IA",
    description: "Blog depuis flux RSS IA chaque matin à 7h — couvre toutes les verticales.",
    config: {
      verticals: ALL_VERTICALS,
      target: ALL_TARGETS,
      types: ["blog_from_rss"],
      schedule: "0 7 * * *",
      batchSize: 10,
      qualityThreshold: 65,
      recurringSchedule: "0 7 * * *",
    },
  },
];

export async function seedCampaignTemplates(prisma: PrismaClient): Promise<number> {
  // Cast needed until prisma generate runs with new schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  let count = 0;
  for (const t of TEMPLATES) {
    await db.campaignTemplate.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        name: t.name,
        description: t.description,
        config: t.config,
        isSystem: true,
        isActive: true,
      },
      update: {
        name: t.name,
        description: t.description,
        config: t.config,
      },
    });
    count++;
  }
  return count;
}
