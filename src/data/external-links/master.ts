/**
 * EXTERNAL LINKS — SSOT (Single Source of Truth)
 *
 * Agrégation de tous les fichiers data par scope.
 * Importé par `selectExternalLinks()` (helpers.ts) ET par le worker monitor.
 *
 * Cf. _AUDIT/EXTERNAL-LINKS-2026-05-22/PHASE-0-RACCORDEMENT.md
 */

import type { ExternalLink, ExternalLinkStatus } from "./types";

import { LINKS_NATIONAL_FR } from "./national-fr";
import { LINKS_INTERNATIONAL } from "./international";
import { LINKS_REGIONS } from "./regions";
import { LINKS_CITIES_TOP_200 } from "./cities";
import { LINKS_VERTICALES } from "./verticales";
import { LINKS_TOPICS } from "./topics";
import { LINKS_PRESS_FR } from "./press-fr";
import { LINKS_MANUAL_ADDITIONS } from "./manual-additions";
import { LINKS_AUTO_SEEDED } from "./auto-seeded";
import verificationStatusRaw from "./verification-status.json";

interface VerificationOverride {
  readonly status: ExternalLinkStatus;
  readonly lastCheckedAt: string;
  readonly paywall: boolean;
  readonly indexable: boolean;
  readonly hasSchemaOrg: boolean;
  readonly isCompetitor: boolean;
  readonly httpStatus?: number;
}

const verificationOverrides: Record<string, VerificationOverride> = Object.fromEntries(
  Object.entries(verificationStatusRaw as Record<string, unknown>).filter(
    ([k]) => !k.startsWith("_"),
  ),
) as Record<string, VerificationOverride>;

/**
 * Liste mutable (pour permettre l'hydratation `refreshUsageStats()` qui
 * met à jour `usageCount` / `lastUsedAt` depuis la DB).
 *
 * Overrides appliqués depuis `verification-status.json` (produit par
 * `src/scripts/verify-external-links-head.ts`) :
 *  - status (active / 404 / deprecated / redirect_*)
 *  - lastCheckedAt
 *  - paywall (détection keywords)
 *  - indexable (robots.txt)
 *  - hasSchemaOrg (signal E-E-A-T)
 *  - isCompetitor (détection runtime hostname)
 */
export const ALL_EXTERNAL_LINKS: ExternalLink[] = [
  ...LINKS_NATIONAL_FR,
  ...LINKS_INTERNATIONAL,
  ...LINKS_REGIONS,
  ...LINKS_CITIES_TOP_200,
  ...LINKS_VERTICALES,
  ...LINKS_TOPICS,
  ...LINKS_PRESS_FR,
  ...LINKS_MANUAL_ADDITIONS,
  ...LINKS_AUTO_SEEDED,
].map((l) => {
  const override = verificationOverrides[l.id];
  if (!override) return { ...l };
  return {
    ...l,
    status: override.status,
    lastCheckedAt: override.lastCheckedAt,
    paywall: override.paywall,
    indexable: override.indexable,
    isCompetitor: override.isCompetitor,
    hasSchemaOrg: override.hasSchemaOrg,
  };
});

/**
 * Stats agrégées synchrones (calculées au chargement).
 */
export function getExternalLinksStats() {
  const total = ALL_EXTERNAL_LINKS.length;
  const byCategory: Record<string, number> = {};
  const byScope: Record<string, number> = {};
  const byAuthority: Record<number, number> = {};
  const byStatus: Record<string, number> = {};

  let competitors = 0;
  let paywalls = 0;
  let nonHttps = 0;
  let nonIndexable = 0;

  for (const link of ALL_EXTERNAL_LINKS) {
    byCategory[link.category] = (byCategory[link.category] ?? 0) + 1;
    byScope[link.scope] = (byScope[link.scope] ?? 0) + 1;
    byAuthority[link.authority] = (byAuthority[link.authority] ?? 0) + 1;
    byStatus[link.status] = (byStatus[link.status] ?? 0) + 1;
    if (link.isCompetitor) competitors += 1;
    if (link.paywall) paywalls += 1;
    if (!link.isHttps) nonHttps += 1;
    if (!link.indexable) nonIndexable += 1;
  }

  return {
    total,
    byCategory,
    byScope,
    byAuthority,
    byStatus,
    competitors,
    paywalls,
    nonHttps,
    nonIndexable,
    healthyForSelection: ALL_EXTERNAL_LINKS.filter(
      (l) =>
        (l.status === "active" || l.status === "redirect_acceptable") &&
        !l.isCompetitor &&
        !l.paywall &&
        l.indexable &&
        l.isHttps,
    ).length,
  };
}
