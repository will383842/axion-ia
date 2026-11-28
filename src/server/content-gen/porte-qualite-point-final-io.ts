/**
 * Porte qualité : accès base du POINT FINAL de publication (Q10). Séparé de
 * `porte-qualite-io.ts`, dont l'unique écriture reste la ligne d'observation.
 */

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { readContentGenConfigDirect } from "@/server/content-gen/config-store";
import {
  CLE_PLAFOND_SECURITE,
  appliquerPointFinal,
  calculerPlafondSecurite,
  plafondDepuisCapGeneration,
  reglagePlafondDepuisConfig,
  type IssuePointFinal,
} from "@/server/content-gen/porte-qualite";

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
      // Q11 : plafond du jour = min(porte, relecture, coût, plafonds existants). Lecture en
      // erreur = exception vers `appliquerPointFinal`, qui reporte (jamais de publication).
      plafond: {
        plafondSecurite: async () => {
          const reglage = reglagePlafondDepuisConfig(
            await readContentGenConfigDirect<unknown>(CLE_PLAFOND_SECURITE, null),
          );
          const envCap = Number.parseInt(process.env.MAX_PUBLISH_PER_DAY ?? "", 10);
          const dbCap = await readContentGenConfigDirect<unknown>("MAX_PUBLISH_PER_DAY", 0);
          const genCap = await readContentGenConfigDirect<unknown>("daily_generation_cap", 0);
          const num = (v: unknown) => (typeof v === "number" ? v : null);
          return calculerPlafondSecurite(reglage, [
            envCap,
            num(dbCap),
            plafondDepuisCapGeneration(genCap),
          ]).plafond;
        },
        // Compteur Redis du pipeline (axion:pub:<jour>) : il contient déjà le slot de CE job, retiré ici.
        compterPublies: async () => {
          const brut = await redis.get(`axion:pub:${new Date().toISOString().split("T")[0]}`);
          return Math.max(0, (Number.parseInt(brut ?? "0", 10) || 0) - 1);
        },
      },
      maintenant: () => new Date(),
      journal: (message, detail) => console.warn(JSON.stringify({ event: message, ...detail })),
    },
    process.env,
  );
}
