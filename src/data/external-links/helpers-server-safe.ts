/**
 * EXTERNAL LINKS — Helpers pure (sans server-only / sans prisma).
 *
 * Cette version est utilisable dans les tests Vitest et dans les
 * environnements de build (stub.invalid) sans déclencher le verrou
 * `server-only` du sélecteur principal.
 *
 * Pour la sélection runtime en server actions / workers : utiliser `helpers.ts`.
 */

import type {
  ExternalLink,
  ExternalLinkAuthority,
  SelectExternalLinksOptions,
} from "./types";
import { isCompetitorDomain } from "./types";
import { ALL_EXTERNAL_LINKS } from "./master";

function passesHardFilters(
  link: ExternalLink,
  minAuthority: ExternalLinkAuthority,
  language: "fr" | "en",
): boolean {
  return (
    (link.status === "active" || link.status === "redirect_acceptable") &&
    !link.isCompetitor &&
    !link.paywall &&
    link.indexable &&
    link.isHttps &&
    link.language === language &&
    link.authority >= minAuthority
  );
}

export function selectExternalLinksPure(
  pool: ReadonlyArray<ExternalLink>,
  opts: SelectExternalLinksOptions,
): ExternalLink[] {
  const {
    vertical,
    cityId,
    regionSlug,
    topic,
    minAuthority = 3,
    count = 3,
    excludeIds = [],
    language = "fr",
    rotationMode = "round_robin",
    maxRecentUsageHours = 24,
  } = opts;

  let candidates = pool.filter(
    (link) =>
      passesHardFilters(link, minAuthority, language) && !excludeIds.includes(link.id),
  );

  if (vertical) {
    candidates = candidates.filter(
      (link) => link.verticales.includes(vertical) || link.verticales.length === 0,
    );
  }
  if (topic) {
    candidates = candidates.filter((link) => link.topics.includes(topic));
  }

  const cutoffMs = Date.now() - maxRecentUsageHours * 3_600 * 1_000;
  const rotated = candidates.filter((link) => {
    if (!link.lastUsedAt) return true;
    return new Date(link.lastUsedAt).getTime() < cutoffMs;
  });

  const filtered = rotated.length >= count * 2 ? rotated : candidates;

  const scored = filtered.map((link) => {
    let score = 0;

    if (rotationMode === "random") {
      score = Math.random() * 100;
    } else if (rotationMode === "weighted_authority") {
      score = link.authority * 20;
      if (cityId && link.cityIds?.includes(cityId)) score += 100;
      if (regionSlug && link.regionSlug === regionSlug) score += 60;
    } else {
      score = link.authority * 10;
      if (cityId && link.cityIds?.includes(cityId)) score += 50;
      if (regionSlug && link.regionSlug === regionSlug) score += 30;
      if (link.scope === "national") score += 10;
      if (link.scope === "international") score += 5;
      if (link.hasSchemaOrg) score += 8;
      score += Math.max(0, 100 - link.usageCount * 2);
    }

    return { link, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: ExternalLink[] = [];
  const usedOrgs = new Set<string>();
  for (const { link } of scored) {
    if (usedOrgs.has(link.organization)) continue;
    selected.push(link);
    usedOrgs.add(link.organization);
    if (selected.length >= count) break;
  }

  return selected;
}

export { ALL_EXTERNAL_LINKS, isCompetitorDomain };
