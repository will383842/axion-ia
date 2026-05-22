/**
 * Seed 6 campaign template presets (D-P5-1 Sprint P5).
 * Idempotent via upsert on slug.
 */

import type { PrismaClient } from "../../generated/client";

const TEMPLATES = [
  {
    slug: "pme-audits",
    name: "PME audits",
    description: "Campagne audit IA pour PME — blog pilier + landing ville, cap 30/jour.",
    config: {
      verticals: ["audits"],
      target: ["pme"],
      types: ["blog_pillar", "landing_ville"],
      batchSize: 20,
      dailyCap: 30,
      // Sprint Campaign Controls — ville par ville, approche stratégique
      cityProcessingMode: "sequential",
    },
  },
  {
    slug: "interventions-weekly",
    name: "Interventions weekly",
    description: "Articles hebdo interventions formations PME/ETI — lundi 9h, keywords + Q/A.",
    config: {
      verticals: ["interventions_formations"],
      target: ["pme", "eti"],
      types: ["blog_from_keywords", "qa_derived"],
      schedule: "0 9 * * 1",
      batchSize: 50,
      // Sprint Campaign Controls — recurringSchedule explicite (déjà dans schedule pour référence)
      recurringSchedule: "0 9 * * 1",
    },
  },
  {
    slug: "tpe-burst",
    name: "TPE burst",
    description: "Burst articles interventions+audits TPE — 50 articles/jour depuis keywords.",
    config: {
      verticals: ["interventions_formations", "audits"],
      target: ["tpe"],
      types: ["blog_from_keywords"],
      batchSize: 100,
      dailyCap: 50,
      // Sprint Campaign Controls — burst limité 30j (endDateOffsetDays = offset relatif à la création)
      endDateOffsetDays: 30,
    },
  },
  {
    slug: "eti-pilier",
    name: "ETI pilier",
    description: "Articles pilier haute qualite ETI — implementations et audits, seuil 75/100.",
    config: {
      verticals: ["implementations", "audits"],
      target: ["eti"],
      types: ["blog_pillar"],
      batchSize: 10,
      qualityThreshold: 75,
      // Sprint Campaign Controls — volume ETI : parallèle (toutes villes simultanément)
      cityProcessingMode: "parallel",
    },
  },
  {
    slug: "cities-paris",
    name: "Cities Paris",
    description: "Landing pages ville ancrees Paris — toutes verticales, batch 20.",
    config: {
      verticals: ["interventions_formations", "audits", "implementations"],
      target: ["tpe", "pme", "eti", "ge"],
      types: ["landing_ville"],
      anchorVilleSlug: "paris",
      batchSize: 20,
      // Sprint Campaign Controls — Paris first : séquentiel
      cityProcessingMode: "sequential",
    },
  },
  {
    slug: "rss-daily",
    name: "RSS daily",
    description: "Blog depuis RSS quotidien 7h — interventions formations, seuil qualite 65.",
    config: {
      verticals: ["interventions_formations"],
      types: ["blog_from_rss"],
      schedule: "0 7 * * *",
      batchSize: 10,
      qualityThreshold: 65,
      // Sprint Campaign Controls — recurringSchedule quotidien 7h CET
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
