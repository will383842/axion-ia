/**
 * Accès aux données de la rotation d'inspection (P5) : candidats (routes publiques + impressions
 * des tables de P2), dernière ligne d'un chemin, écriture d'une ligne, mémoire du dernier passage.
 * Lecture seule sauf `ecrireLigne` (table `gsc_inspections`) et la mémoire Redis du dernier passage.
 */
import type { PrismaClient } from "../../../../prisma/generated/client";
import { normaliserChemin } from "../donnees/chemins";
import type { CandidatInspection } from "./priorites";
import type { DepsRotation, LigneInspection } from "./rotation";

export const CLE_DERNIER_PASSAGE = "gsc:inspection:derniere";
const JOUR_MS = 86_400_000;

type PrismaInspection = Pick<PrismaClient, "siteRoute" | "gscPageJour" | "gscInspection">;

export interface RedisPassages {
  hgetall(cle: string): Promise<Record<string, string>>;
  hset(cle: string, champ: string, valeur: string): Promise<unknown>;
}

const jourUtc = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export async function chargerCandidats(
  prisma: PrismaInspection,
  redis: RedisPassages,
  maintenant: Date,
): Promise<CandidatInspection[]> {
  const aujourdhui = jourUtc(maintenant);
  const debut14 = new Date(aujourdhui.getTime() - 14 * JOUR_MS);
  const debut28 = new Date(aujourdhui.getTime() - 28 * JOUR_MS);

  const [routes, recentes, precedentes, lignes, vus] = await Promise.all([
    prisma.siteRoute.findMany({
      where: { visibility: "public", status: "live", pathRendered: { not: null } },
      select: { pathRendered: true, lastModifiedAt: true, isIndexable: true },
    }),
    prisma.gscPageJour.groupBy({
      by: ["chemin"],
      where: { date: { gte: debut14 } },
      _sum: { impressions: true },
    }),
    prisma.gscPageJour.groupBy({
      by: ["chemin"],
      where: { date: { gte: debut28, lt: debut14 } },
      _sum: { impressions: true },
    }),
    prisma.gscInspection.groupBy({ by: ["chemin"], _max: { inspecteLe: true } }),
    redis.hgetall(CLE_DERNIER_PASSAGE),
  ]);

  const somme = (l: ReadonlyArray<{ chemin: string; _sum: { impressions: number | null } }>) =>
    new Map(l.map((x) => [x.chemin, x._sum.impressions ?? 0]));
  const imp14 = somme(recentes);
  const impPrec = somme(precedentes);
  const derniere = new Map<string, number>();
  for (const l of lignes) {
    if (l._max.inspecteLe) derniere.set(l.chemin, l._max.inspecteLe.getTime());
  }
  for (const [chemin, ms] of Object.entries(vus)) {
    const t = Number(ms);
    if (Number.isFinite(t) && t > (derniere.get(chemin) ?? 0)) derniere.set(chemin, t);
  }

  const vues = new Set<string>();
  const sortie: CandidatInspection[] = [];
  for (const r of routes) {
    const chemin = r.pathRendered ? normaliserChemin(r.pathRendered) : null;
    if (!chemin || vues.has(chemin)) continue;
    vues.add(chemin);
    const dernier = derniere.get(chemin);
    sortie.push({
      chemin,
      modifieLe: r.lastModifiedAt,
      derniereInspection: dernier === undefined ? null : new Date(dernier),
      impressions14: imp14.get(chemin) ?? 0,
      impressionsPrecedentes14: impPrec.get(chemin) ?? 0,
      noindex: r.isIndexable === false,
    });
  }
  return sortie;
}

export function accesLignes(
  prisma: Pick<PrismaClient, "gscInspection">,
  redis: Pick<RedisPassages, "hset">,
): Pick<DepsRotation, "derniereLigne" | "ecrireLigne" | "marquerVue"> {
  return {
    derniereLigne: async (chemin) => {
      const l = await prisma.gscInspection.findFirst({
        where: { chemin },
        orderBy: { inspecteLe: "desc" },
        select: {
          verdict: true,
          couverture: true,
          canoniqueGoogle: true,
          canoniqueDeclaree: true,
          dernierPassageRobot: true,
        },
      });
      return l;
    },
    ecrireLigne: async (l: LigneInspection) => {
      await prisma.gscInspection.create({ data: { ...l } });
    },
    marquerVue: async (chemin, quand) => {
      await redis.hset(CLE_DERNIER_PASSAGE, chemin, String(quand.getTime()));
    },
  };
}
