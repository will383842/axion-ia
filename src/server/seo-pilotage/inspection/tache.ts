/**
 * Tâche `inspection` du robot « pilotage SEO » (P5) : branche la rotation sur Prisma, Redis et
 * l'API d'inspection d'URL de Google. Chargé À LA DEMANDE par le worker (après l'interrupteur).
 */
import { gscInspecterUrlDetaille } from "@/server/content-gen/seo/gsc-client";

import { accesLignes, chargerCandidats, type RedisPassages } from "./donnees";
import { magasinQuotaRedis } from "./quota";
import { executerRotation, type BilanRotation, type ResultatInspection } from "./rotation";

type Prisma = Parameters<typeof chargerCandidats>[0];
type RedisComplet = RedisPassages & Parameters<typeof magasinQuotaRedis>[0];

function dateOuNull(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function inspecterAvecEtat(url: string): Promise<ResultatInspection> {
  const r = await gscInspecterUrlDetaille(url);
  if (r.etat !== "ok") return { etat: r.etat };
  const s = r.resultat?.indexStatusResult;
  return {
    etat: "ok",
    resultat: {
      verdict: s?.verdict?.slice(0, 40) ?? null,
      couverture: s?.coverageState?.slice(0, 200) ?? null,
      canoniqueGoogle: s?.googleCanonical?.slice(0, 1000) ?? null,
      canoniqueDeclaree: s?.userCanonical?.slice(0, 1000) ?? null,
      dernierPassageRobot: dateOuNull(s?.lastCrawlTime),
    },
  };
}

export async function tacheInspection(deps: {
  readonly prisma: Prisma;
  readonly redis: RedisComplet;
  readonly maintenant?: () => Date;
}): Promise<BilanRotation> {
  const maintenant = deps.maintenant ?? (() => new Date());
  return executerRotation({
    magasinQuota: magasinQuotaRedis(deps.redis),
    maintenant,
    attendre: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    chargerCandidats: () => chargerCandidats(deps.prisma, deps.redis, maintenant()),
    ...accesLignes(deps.prisma, deps.redis),
    inspecter: inspecterAvecEtat,
  });
}
