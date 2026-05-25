/**
 * EXTERNAL LINKS — Helpers de sélection
 *
 * `selectExternalLinks()` : sélection scorée + diversifiée + rotation équitable.
 * `validateLink()` : validation d'un lien candidat avant ajout manuel.
 * `trackExternalLinksUsage()` : persistence DB usageCount + lastUsedAt.
 * `refreshUsageStats()` : hydrate ALL_EXTERNAL_LINKS depuis DB.
 *
 * Server-side. NE PAS importer dans un composant client.
 * (note 2026-05-24 : `import "server-only"` retiré pour permettre l'usage
 * depuis scripts/* + workers/* — convention codebase, cf. perplexity-search.ts.)
 */

import type { ExternalLink, ExternalLinkAuthority, SelectExternalLinksOptions } from "./types";
import { isCompetitorDomain } from "./types";
import { ALL_EXTERNAL_LINKS } from "./master";
import { prisma } from "@/lib/prisma";

/**
 * Filtre dur qualité SEO/AEO 2026.
 * Doit être passé pour qu'un lien soit éligible à toute sélection.
 */
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

/**
 * Sélectionne N liens externes pertinents pour un article.
 *
 * Étapes :
 *  1. Filtres durs qualité (status, competitor, paywall, indexable, https, authority, language)
 *  2. Filtres contexte (vertical, topic)
 *  3. Filtre rotation (anti-répétition < maxRecentUsageHours)
 *  4. Scoring + rotation équitable
 *  5. Diversification organisations (1 par organisation max)
 *
 * Retourne au maximum `count` liens (default 3).
 */
export function selectExternalLinks(opts: SelectExternalLinksOptions): ExternalLink[] {
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

  // === ÉTAGE 1 — FILTRES DURS QUALITÉ ===
  let candidates = ALL_EXTERNAL_LINKS.filter(
    (link) => passesHardFilters(link, minAuthority, language) && !excludeIds.includes(link.id),
  );

  // === ÉTAGE 2 — FILTRES CONTEXTE ===
  if (vertical) {
    candidates = candidates.filter(
      (link) => link.verticales.includes(vertical) || link.verticales.length === 0,
    );
  }
  if (topic) {
    candidates = candidates.filter((link) => link.topics.includes(topic));
  }

  // === ÉTAGE 3 — FILTRE ROTATION (anti-répétition récente) ===
  const cutoffMs = Date.now() - maxRecentUsageHours * 3_600 * 1_000;
  const rotated = candidates.filter((link) => {
    if (!link.lastUsedAt) return true;
    return new Date(link.lastUsedAt).getTime() < cutoffMs;
  });

  // Si trop peu de candidats après filtre rotation, relâcher (mais conserver filtres durs)
  const pool = rotated.length >= count * 2 ? rotated : candidates;

  // === ÉTAGE 4 — SCORING ===
  const scored = pool.map((link) => {
    let score = 0;

    if (rotationMode === "random") {
      score = Math.random() * 100;
    } else if (rotationMode === "weighted_authority") {
      score = link.authority * 20;
      if (cityId && link.cityIds?.includes(cityId)) score += 100;
      if (regionSlug && link.regionSlug === regionSlug) score += 60;
    } else {
      // round_robin (default)
      score = link.authority * 10;

      // Bonus contexte géo
      if (cityId && link.cityIds?.includes(cityId)) score += 50;
      if (regionSlug && link.regionSlug === regionSlug) score += 30;
      if (link.scope === "national") score += 10;
      if (link.scope === "international") score += 5;

      // Bonus Schema.org destination (signal E-E-A-T)
      if (link.hasSchemaOrg) score += 8;

      // Anti-répétition : privilégier les liens les MOINS utilisés
      score += Math.max(0, 100 - link.usageCount * 2);
    }

    return { link, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // === ÉTAGE 5 — DIVERSIFICATION ORGANISATIONS ===
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

/**
 * Valide un lien candidat (utilisé avant ajout manuel admin).
 * Vérifie : URL HTTPS, domaine non concurrent, format ExternalLink complet.
 */
export function validateLink(
  link: Partial<ExternalLink>,
): { ok: true } | { ok: false; reason: string } {
  if (!link.url) return { ok: false, reason: "url required" };
  let parsed: URL;
  try {
    parsed = new URL(link.url);
  } catch {
    return { ok: false, reason: "url invalid" };
  }
  if (parsed.protocol !== "https:") return { ok: false, reason: "https required" };
  if (isCompetitorDomain(parsed.hostname)) return { ok: false, reason: "competitor domain" };
  if (!link.title) return { ok: false, reason: "title required" };
  if (!link.organization) return { ok: false, reason: "organization required" };
  if (!link.category) return { ok: false, reason: "category required" };
  if (!link.scope) return { ok: false, reason: "scope required" };
  if (!link.verticales || link.verticales.length === 0) {
    return { ok: false, reason: "verticales (≥1) required" };
  }
  if (typeof link.authority !== "number" || link.authority < 1 || link.authority > 5) {
    return { ok: false, reason: "authority 1-5 required" };
  }
  return { ok: true };
}

/**
 * Persiste l'usage des liens (rotation équitable).
 * Incrémente `usageCount` + maj `lastUsedAt`.
 *
 * Appelé par `content-publish-worker` après publication réussie.
 */
export async function trackExternalLinksUsage(linkIds: readonly string[]): Promise<void> {
  if (linkIds.length === 0) return;

  const now = new Date();

  await Promise.all(
    linkIds.map((id) =>
      prisma.externalLinkUsage.upsert({
        where: { externalLinkId: id },
        create: {
          externalLinkId: id,
          usageCount: 1,
          monthUsageCount: 1,
          lastUsedAt: now,
          monthResetAt: now,
        },
        update: {
          usageCount: { increment: 1 },
          monthUsageCount: { increment: 1 },
          lastUsedAt: now,
        },
      }),
    ),
  );

  // Sync in-memory (best-effort, non-bloquant pour autres usages)
  for (const id of linkIds) {
    const link = ALL_EXTERNAL_LINKS.find((l) => l.id === id);
    if (link) {
      link.usageCount += 1;
      link.lastUsedAt = now.toISOString();
    }
  }
}

/**
 * Hydrate ALL_EXTERNAL_LINKS in-memory avec les compteurs DB.
 * À appeler au démarrage du process (server boot) ou en début de batch.
 */
export async function refreshUsageStats(): Promise<void> {
  const usages = await prisma.externalLinkUsage.findMany();
  const usageMap = new Map(usages.map((u) => [u.externalLinkId, u]));
  for (const link of ALL_EXTERNAL_LINKS) {
    const u = usageMap.get(link.id);
    if (u) {
      link.usageCount = u.usageCount;
      link.lastUsedAt = u.lastUsedAt.toISOString();
    }
  }
}

/**
 * Détecte les URLs externes citées dans le HTML d'un article qui
 * ne sont PAS dans le catalogue (= hallucinations LLM).
 *
 * Retourne `{ valid: linkIds[], hallucinated: urls[] }`.
 */
export function detectHallucinations(bodyHtml: string): {
  valid: string[];
  hallucinated: string[];
} {
  const matches = bodyHtml.match(/<a[^>]+href="(https?:\/\/[^"]+)"/g) ?? [];
  const externalUrls = matches
    .map((m) => m.match(/href="([^"]+)"/)?.[1] ?? "")
    .filter((url) => url && !url.includes("axion-ia.com"));

  const catalogUrlSet = new Set(ALL_EXTERNAL_LINKS.map((l) => l.url));
  const valid: string[] = [];
  const hallucinated: string[] = [];

  for (const url of externalUrls) {
    const link = ALL_EXTERNAL_LINKS.find((l) => l.url === url);
    if (link) {
      valid.push(link.id);
    } else if (catalogUrlSet.has(url)) {
      // ne peut pas arriver, mais filet de sécurité
      valid.push(url);
    } else {
      hallucinated.push(url);
    }
  }

  return { valid, hallucinated };
}

/**
 * Section markdown à injecter dans le userPrompt d'un generator.
 * Format compact, instructions strictes anti-hallucination.
 */
export function buildExternalLinksPromptSection(links: ReadonlyArray<ExternalLink>): string {
  if (links.length === 0) return "";

  const bulletList = links.map((l) => `- **${l.title}** (${l.organization}) — ${l.url}`).join("\n");

  return [
    "",
    "## SOURCES D'AUTORITÉ À CITER (≥ 2 dans l'article)",
    "",
    "Utiliser ces URLs EXACTES dans la prose comme sources d'autorité.",
    "Ancres descriptives (jamais « cliquez ici »). NE PAS INVENTER d'autres URLs.",
    "",
    bulletList,
    "",
  ].join("\n");
}
