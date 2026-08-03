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

/**
 * 🔴 Deux défauts corrigés le 2026-08-03, après lecture À L'ÉCRAN des tuiles
 * de `/content-gen` :
 *
 * 1. « Implementations » et « Sites web augmentes » s'affichaient SANS
 *    ACCENTS, alors que la barre latérale écrit « Implémentations » à deux
 *    centimètres de là ;
 * 2. `src/server/actions/content-gen/dashboard.ts` portait une SECONDE table
 *    des mêmes cinq secteurs, qui avait dérivé : elle disait « Coaching
 *    1-to-1 » là où celle-ci disait « Accompagnement 1-to-1 ». Deux noms pour
 *    le même service selon l'écran. La copie a été supprimée au profit de
 *    cette table ; le nom retenu est celui employé partout ailleurs dans la
 *    console, y compris dans la navigation.
 */
export const SERVICE_SECTOR_LABELS: Record<ServiceSector, string> = {
  interventions_formations: "Interventions & Formations",
  audits: "Audits",
  implementations: "Implémentations",
  un_a_un: "Coaching 1-to-1",
  sites_web_augmentes: "Sites web augmentés",
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
