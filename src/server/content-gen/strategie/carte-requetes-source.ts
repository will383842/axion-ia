/**
 * Lecture seule (Prisma) des entrées de la carte des requêtes :
 *  - KeywordTracking : requêtes Search Console déjà synchronisées par
 *    `content-keyword-sync-worker` (source « gsc ») et suivis manuels/SerpAPI ;
 *  - EdPublication : plan éditorial existant (tags d'une publication qui
 *    pointe vers une URL).
 * Aucune écriture, aucune migration.
 */

import { prisma } from "@/lib/prisma";
import { construireCarte, type CarteRequetes, type EntreeCarte } from "./carte-requetes";

const LIMITE_SUIVIS = 20_000;
const LIMITE_PLAN = 5_000;

/** Interrupteur de l'équipe éditoriale : actif seulement si exactement "true". */
export function equipeEditorialeActive(): boolean {
  return process.env.CONTENT_EQUIPE_EDITORIALE === "true";
}

export async function chargerEntreesCarte(): Promise<EntreeCarte[]> {
  const [suivis, plan] = await Promise.all([
    prisma.keywordTracking.findMany({
      select: { keyword: true, targetUrl: true, position: true, impressions: true, source: true },
      take: LIMITE_SUIVIS,
      orderBy: { syncedAt: "desc" },
    }),
    prisma.edPublication.findMany({
      where: { lienUrl: { not: null } },
      select: { tags: true, lienUrl: true },
      take: LIMITE_PLAN,
    }),
  ]);

  const entrees: EntreeCarte[] = suivis.map((s) => ({
    requete: s.keyword,
    url: s.targetUrl,
    source: s.source === "gsc" ? "gsc" : "suivi",
    position: Number(s.position),
    impressions: s.impressions,
  }));
  for (const p of plan) {
    if (!p.lienUrl) continue;
    for (const tag of p.tags) entrees.push({ requete: tag, url: p.lienUrl, source: "plan" });
  }
  return entrees;
}

export async function chargerCarteRequetes(): Promise<CarteRequetes> {
  return construireCarte(await chargerEntreesCarte());
}
