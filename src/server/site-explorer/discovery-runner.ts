// Runner de découverte partagé — utilisé par le worker cron
// (`site-route-discovery-worker.ts`) ET par le script CLI manuel
// (`src/scripts/scan-site-routes.ts`). Logique unique, zéro duplication.
//
// Énumère toutes les URLs publiques, calcule catégorie + indexabilité live,
// upsert sans écraser les champs de revue manuelle, puis soft-tombstone les
// URLs disparues. Voir `route-enumerator.ts` et `indexability.ts`.

import { prisma } from "@/lib/prisma";
import { enumerateAllRoutes, type EnumeratedRoute } from "./route-enumerator";
import { computeIndexability } from "./indexability";
import { categorizeRoute } from "./categories";

const VERTICALE_BY_SECTION: Record<string, string[]> = {
  audit: ["audits"],
  interventions: ["interventions_formations"],
  "un-a-un": ["un_a_un"],
  implementation: ["implementations"],
  "sites-web-augmentes": ["sites_web_augmentes"],
};

function calcDepth(pathPattern: string): number {
  return Math.max(0, pathPattern.split("/").filter(Boolean).length - 1);
}

/** Upsert une route découverte SANS toucher aux champs de revue manuelle. */
async function upsertDiscovered(route: EnumeratedRoute, runStartedAt: Date): Promise<void> {
  const { indexable, reason } = computeIndexability(
    {
      pathRendered: route.pathRendered,
      pathPattern: route.pathPattern,
      section: route.section,
      ...(route.articleTier != null ? { articleTier: route.articleTier } : {}),
    },
    runStartedAt,
  );
  const category = categorizeRoute(route.section, route.pathPattern);
  const verticales = route.section ? (VERTICALE_BY_SECTION[route.section] ?? []) : [];
  const depth = calcDepth(route.pathPattern);
  const pathSlug = route.pathSlug ?? null;

  const shared = {
    pathRendered: route.pathRendered ?? null,
    type: route.type,
    source: route.source,
    filePath: route.filePath ?? null,
    section: route.section ?? null,
    verticales,
    cityIds: route.cityIds ?? [],
    editable: route.editable ?? false,
    editorRoute: route.editorRoute ?? null,
    sourceDbTable: route.sourceDbTable ?? null,
    sourceDbId: route.sourceDbId ?? null,
    depth,
    category,
    isIndexable: indexable,
    noindexReason: reason || null,
    lastSeenAt: runStartedAt,
    removedAt: null,
  };

  await prisma.siteRoute.upsert({
    where: { pathPattern_pathSlug: { pathPattern: route.pathPattern, pathSlug: pathSlug ?? "" } },
    create: {
      pathPattern: route.pathPattern,
      pathSlug,
      visibility: "public",
      status: route.type === "dynamic_template" ? "unknown" : "live",
      ...shared,
    },
    update: shared, // ⚠️ pas de status (inspecteur HTTP) ni champs manuels
  });
}

export interface DiscoveryResult {
  enumerated: number;
  upserted: number;
  tombstoned: number;
}

/**
 * Exécute un cycle complet de découverte. Robuste : un upsert qui échoue est
 * logué et n'interrompt pas le run. Retourne les compteurs pour le log/CLI.
 */
export async function runSiteRouteDiscovery(now: Date = new Date()): Promise<DiscoveryResult> {
  const routes = await enumerateAllRoutes();

  const BATCH = 25;
  let upserted = 0;
  for (let i = 0; i < routes.length; i += BATCH) {
    const batch = routes.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map((r) => upsertDiscovered(r, now)));
    for (let j = 0; j < results.length; j++) {
      const res = results[j]!;
      if (res.status === "fulfilled") upserted++;
      else {
        const r = batch[j]!;
        console.warn(
          `[discovery] upsert failed for ${r.pathPattern} (${r.pathSlug ?? "—"}):`,
          (res.reason as Error)?.message,
        );
      }
    }
  }

  // Soft-tombstone des URLs non revues par CE run (disparues de la découverte).
  const tomb = await prisma.siteRoute.updateMany({
    where: {
      visibility: "public",
      removedAt: null,
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: now } }],
    },
    data: { removedAt: now },
  });

  return { enumerated: routes.length, upserted, tombstoned: tomb.count };
}
