/**
 * Image-bank — Seed catégories Axion-IA (5 catégories de base).
 * Idempotent via upsert.
 */

import type { PrismaClient } from "@prisma/client";

type CategorySeed = {
  slug: string;
  sortOrder: number;
  name: { fr: string; en: string };
  description?: { fr: string; en: string };
};

const CATEGORIES: ReadonlyArray<CategorySeed> = [
  {
    slug: "interventions",
    sortOrder: 10,
    name: { fr: "Interventions", en: "Interventions" },
    description: {
      fr: "Photographies et schémas des interventions Axion-IA (coaching, conférences, ateliers).",
      en: "Photos and schemas from Axion-IA interventions (coaching, talks, workshops).",
    },
  },
  {
    slug: "audits",
    sortOrder: 20,
    name: { fr: "Audits", en: "Audits" },
    description: {
      fr: "Visuels des audits IA opérationnels (flash, ciblés, stratégiques PME/ETI).",
      en: "Visuals from operational AI audits (flash, targeted, strategic SMB/mid-market).",
    },
  },
  {
    slug: "implementations",
    sortOrder: 30,
    name: { fr: "Implémentations", en: "Implementations" },
    description: {
      fr: "Architectures et captures d'implémentations IA (chatbots, agents, intégrations CRM/ERP).",
      en: "Architectures and screenshots of AI implementations (chatbots, agents, CRM/ERP integrations).",
    },
  },
  {
    slug: "equipe",
    sortOrder: 40,
    name: { fr: "Équipe", en: "Team" },
    description: {
      fr: "Portraits et environnements de travail de l'équipe Axion-IA OÜ.",
      en: "Portraits and work environments of the Axion-IA OÜ team.",
    },
  },
  {
    slug: "cas-concrets",
    sortOrder: 50,
    name: { fr: "Cas concrets", en: "Case studies" },
    description: {
      fr: "Études de cas client (avec autorisation explicite).",
      en: "Client case studies (with explicit authorization).",
    },
  },
] as const;

export async function seedImageCategories(client: PrismaClient): Promise<number> {
  let count = 0;
  for (const cat of CATEGORIES) {
    const created = await client.imageCategory.upsert({
      where: { slug: cat.slug },
      update: { sortOrder: cat.sortOrder, isActive: true },
      create: { slug: cat.slug, isActive: true, sortOrder: cat.sortOrder },
    });

    for (const lang of ["fr", "en"] as const) {
      await client.imageCategoryTranslation.upsert({
        where: {
          categoryId_languageCode: {
            categoryId: created.id,
            languageCode: lang,
          },
        },
        update: {
          name: cat.name[lang],
          slug: cat.slug,
          description: cat.description?.[lang] ?? null,
        },
        create: {
          categoryId: created.id,
          languageCode: lang,
          name: cat.name[lang],
          slug: cat.slug,
          description: cat.description?.[lang] ?? null,
        },
      });
    }
    count++;
  }
  return count;
}
