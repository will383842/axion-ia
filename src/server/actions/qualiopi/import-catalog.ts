/**
 * Qualiopi — Server Action : import du catalogue marketing → table Formation.
 *
 * Déclenchée depuis la console admin (bouton « Importer le catalogue »). Crée
 * les formations opérationnelles manquantes à partir du SSOT `catalog-v2.ts`,
 * en état session-ready (cf. `importCatalogFormations`). Idempotent : ré-exécuter
 * ne duplique rien.
 *
 * Rôle requis : ADMIN_PUBLISH (l'import publie le référentiel formation).
 * Tracé dans ActivityLog (preuve d'audit Qualiopi + RGPD art. 30).
 */

"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminPublish, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { revalidateFormationPages } from "@/server/actions/qualiopi/_revalidate";
import {
  importCatalogFormations,
  type CatalogImportReport,
} from "@/server/qualiopi/formations/catalog-import";

type ActionResult<T> = { data: T } | { error: string };

/**
 * Importe (idempotent) les 17 formations du catalogue dans la table Formation.
 * Retourne le rapport détaillé (créées / déjà présentes / offre absente).
 */
export async function importCatalogFormationsAction(): Promise<ActionResult<CatalogImportReport>> {
  const session = await requireAdminPublish();

  let report: CatalogImportReport;
  try {
    report = await importCatalogFormations(prisma, { adminUserId: session.userId });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[qualiopi.import-catalog] échec :", err);
    }
    return { error: "Échec de l'import du catalogue. Réessayez ou consultez les logs." };
  }

  await logQualiopiActivity({
    action: "qualiopi.formation.import_catalog",
    targetType: "Formation",
    changes: {
      total: report.total,
      created: report.created,
      skippedExistantes: report.skippedExistantes,
      skippedOffreAbsente: report.skippedOffreAbsente,
    },
    session,
  });

  // Invalide la liste admin + les pages publiques (no-op sûr en Phase A).
  if (report.created > 0) revalidateFormationPages();

  return { data: report };
}
