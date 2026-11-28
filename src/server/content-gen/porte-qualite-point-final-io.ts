/**
 * Porte qualité : accès base du POINT FINAL de publication (Q10). Séparé de
 * `porte-qualite-io.ts`, dont l'unique écriture reste la ligne d'observation.
 */

import { prisma } from "@/lib/prisma";
import { readContentGenConfigDirect } from "@/server/content-gen/config-store";
import { appliquerPointFinal, type IssuePointFinal } from "@/server/content-gen/porte-qualite";

/**
 * Point final de publication (Q10). Drapeau `CONTENT_PORTE_QUALITE` éteint : « inerte », sans
 * aucun accès base. Allumé : échec fermé (jamais d'exception vers l'appelant, jamais « publier » sur erreur).
 */
export async function appliquerPointFinalPorte(
  jobId: string,
  contentType: string,
  sortie: unknown,
): Promise<IssuePointFinal> {
  if (process.env.CONTENT_PORTE_QUALITE !== "true") return { action: "inerte" };
  return appliquerPointFinal(
    { jobId, contentType, sortie },
    {
      lireConfig: (cle) => readContentGenConfigDirect<unknown>(cle, null),
      ecrireVerdict: (ligne) =>
        prisma.contentQualityVerdict.create({
          data: {
            jobId: ligne.jobId,
            contentKind: ligne.contentKind,
            versionPorte: ligne.versionPorte,
            mode: ligne.mode,
            verdict: ligne.verdict,
            note: ligne.note,
            criteres: ligne.criteres as never,
            seuilsFiges: ligne.seuilsFiges as never,
          },
        }),
      maintenant: () => new Date(),
      journal: (message, detail) => console.warn(JSON.stringify({ event: message, ...detail })),
    },
    process.env,
  );
}
