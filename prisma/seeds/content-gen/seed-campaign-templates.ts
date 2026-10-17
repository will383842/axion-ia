/**
 * Seed campaign template presets — Source of truth pour les presets disponibles.
 *
 * Historique architectural :
 *   - Sprint P5 (2026-05-21, D-P5-1) : 6 presets centrés audience/cadence —
 *     `pme-audits`, `interventions-weekly`, `tpe-burst`, `eti-pilier`,
 *     `cities-paris`, `rss-daily`.
 *   - Sprint P6 (2026-05-22) : refactor vers 8 presets centrés verticales —
 *     1 général × 5 verticales × 1 landing-villes × 1 RSS quotidien. Plus
 *     scalable car les cadences (burst / weekly) sont configurables via
 *     `config.batchSize` + `config.dailyCap` sur n'importe quel preset.
 *   - Sprint Correctif P1-3 (2026-05-23, audit E2E passe 2 runtime) : confirmation
 *     par DB query — `SELECT slug FROM campaign_templates` retourne les 8 slugs
 *     ci-dessous, et seul `rss-daily` matche le doc D-P5-1 initial. Doc D-P5-1
 *     historique conservée dans la mémoire `axionia_p5_decisions_canoniques_2026-05-21`
 *     mais cette source de vérité (le code seed) reflète l'architecture actuelle P6.
 *
 * 8 presets actuels :
 *   1. `toutes-verticales-general` — Couvre les 5 services + toutes tailles
 *   2. `interventions-formations-all` — Verticale formations
 *   3. `audits-all` — Verticale audits
 *   4. `implementations-all` — Verticale implémentations
 *   5. `un-a-un-all` — Verticale coaching 1-to-1
 *   6. `sites-web-augmentes-all` — Verticale sites web augmentés
 *   7. `landing-villes-all` — Landing pages multi-villes (5 verticales)
 *   8. `rss-daily` — RSS quotidien actualité IA
 *
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
