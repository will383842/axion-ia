#!/usr/bin/env tsx
// Script scan-site-routes — découverte manuelle du catalogue d'URLs publiques.
//
// Wrapper CLI autour du runner partagé `runSiteRouteDiscovery()` (même logique
// que le worker cron `site-route-discovery-worker.ts`, Onglet « Toutes les
// URLs » 2026-06-08). Énumère TOUTES les URLs publiques FR via l'énumérateur
// unifié, calcule l'indexabilité live + la catégorie, upsert sans écraser les
// champs de revue manuelle, et soft-tombstone les URLs disparues.
//
// Exécution : pnpm tsx src/scripts/scan-site-routes.ts
// Idempotent : upsert by (pathPattern, pathSlug).

import { prisma } from "@/lib/prisma";
import { runSiteRouteDiscovery } from "@/server/site-explorer/discovery-runner";

async function main() {
  console.log("[scanner] Démarrage découverte des URLs publiques…");
  const res = await runSiteRouteDiscovery();
  console.log(
    `\n[scanner] TERMINÉ : ${res.enumerated} URLs énumérées, ${res.upserted} upsertées, ${res.tombstoned} tombstonées (disparues).`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[scanner] ERREUR:", e);
  process.exit(1);
});
