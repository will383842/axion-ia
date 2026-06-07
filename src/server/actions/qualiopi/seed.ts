/**
 * Qualiopi — Server Action de seed du référentiel piloté depuis la console admin.
 *
 * reseedReferenceDataAction : (re)joue le seed idempotent du référentiel (offres_site
 * + config SiteSetting + grilles qualité v1/v2) sur demande, depuis /qualiopi/config.
 * Même logique que le seed automatique du boot (`instrumentation.ts`) et que
 * `pnpm qualiopi:seed` — zéro divergence. Non destructif : préserve l'existant.
 *
 * Garde write + trace d'audit (preuve Qualiopi / RGPD art. 30).
 */

"use server";

import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { prisma } from "@/lib/prisma";
import {
  seedQualiopiReferenceData,
  type QualiopiReferenceDataReport,
} from "@/server/qualiopi/seed/reference-data";

type ActionResult<T> = { data: T } | { error: string };

/**
 * Rejoue le seed du référentiel Qualiopi. Idempotent : crée ce qui manque, préserve
 * l'existant (valeurs légales saisies, éditions admin). Retourne l'état final.
 */
export async function reseedReferenceDataAction(): Promise<
  ActionResult<QualiopiReferenceDataReport>
> {
  const session = await requireAdminWrite();
  try {
    const report = await seedQualiopiReferenceData(prisma);
    await logQualiopiActivity({
      action: "qualiopi.reference_data.reseed",
      targetType: "SiteSetting",
      changes: {
        ran: report.ran,
        offresCount: report.offresCount,
        configKeysSet: report.configKeysSet,
        grilleActiveCle: report.grilleActiveCle,
      },
      session,
    });
    return { data: report };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Échec du seed : ${err.message}`
          : "Échec du seed du référentiel Qualiopi.",
    };
  }
}
