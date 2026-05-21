/**
 * Editorial mix rules — pure module (testable sans Prisma) (§ 25.3 — 2026-05-16).
 *
 * Séparation des règles métier des Server Actions : `landing_ville` et
 * `blog_from_rss` ont leurs propres pipelines (coverage villes / RSS worker)
 * et NE DOIVENT PAS apparaître dans la distribution éditoriale d'une campagne
 * sectorielle (interventions_formations / audits / implementations).
 *
 * Importé par :
 *  - src/server/actions/content-gen/distribution.ts (upsertDistributionProfile)
 *  - src/server/actions/content-gen/coverage.ts (createCampaign si sector défini)
 */

import type { ServiceSector } from "../../../../prisma/generated/client";

export const EDITORIAL_CONTENT_TYPES = [
  "blog_article",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
] as const;

export const BANNED_FROM_EDITORIAL_MIX = ["landing_ville", "blog_from_rss"] as const;

export const SERVICE_SECTORS = [
  "interventions_formations",
  "audits",
  "implementations",
  "un_a_un",
  "sites_web_augmentes",
] as const satisfies ReadonlyArray<ServiceSector>;

export const SERVICE_SECTOR_LABELS: Record<ServiceSector, string> = {
  interventions_formations: "Interventions & Formations",
  audits: "Audits",
  implementations: "Implementations",
  un_a_un: "Accompagnement 1-to-1",
  sites_web_augmentes: "Sites web augmentes",
};

/**
 * Vérifie qu'aucune clé interdite n'apparaît dans une distribution éditoriale.
 * Throw avec message lisible incluant la clé fautive si violation.
 */
export function assertEditorialKeys(record: Record<string, number>, label: string): void {
  for (const key of Object.keys(record)) {
    if ((BANNED_FROM_EDITORIAL_MIX as ReadonlyArray<string>).includes(key)) {
      throw new Error(
        `${label}_banned_type:${key} (landing_ville et blog_from_rss ont leur propre pipeline)`,
      );
    }
  }
}

/**
 * Vérifie que la somme des poids vaut 100 (±0,5 tolérance flottant).
 */
export function assertSum100(record: Record<string, number>, label: string): void {
  const sum = Object.values(record).reduce((acc, v) => acc + v, 0);
  if (Math.abs(sum - 100) > 0.5) {
    throw new Error(`${label}_sum_must_be_100 (got ${sum.toFixed(2)})`);
  }
}
