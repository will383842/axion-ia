/**
 * Qualiopi — Seed des 17 formations du catalogue V2 dans la table Formation.
 *
 * Réutilise le service `importCatalogFormations` (SSOT unique du mapping) pour
 * que `pnpm qualiopi:seed` rende les formations opérationnelles immédiatement
 * (session-ready) sur un environnement frais. Idempotent et non destructif :
 * ne crée que les formations absentes, ne touche jamais l'existant.
 *
 * Dépendance : les offres V2 (`seedOffresV2`) doivent exister AVANT (la liaison
 * Formation → OffreSite est obligatoire). L'ordre est garanti dans `index.ts`.
 *
 * Contexte seed (pas de session admin) → `validatedBy` null ; contenu non-IA
 * (`aiGenerated=false`), donc aucune obligation de validation AI Act art. 50.
 */

import type { PrismaClient } from "../../generated/client";
import { importCatalogFormations } from "../../../src/server/qualiopi/formations/catalog-import";

export async function seedCatalogFormations(prisma: PrismaClient): Promise<void> {
  const report = await importCatalogFormations(prisma);
  const parts = [`${report.created} créée(s)`, `${report.skippedExistantes} préservée(s)`];
  if (report.skippedOffreAbsente > 0) {
    parts.push(`${report.skippedOffreAbsente} SANS offre (seed offres manquant)`);
  }
  console.log(
    `✅ [qualiopi:seed] formations catalogue — ${parts.join(", ")} (total ${report.total}).`,
  );
}
