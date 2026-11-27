/**
 * Lecture seule (Prisma) des entrées de la carte des requêtes :
 *  - KeywordTracking : requêtes Search Console déjà synchronisées par
 *    `content-keyword-sync-worker` (source « gsc ») et suivis manuels/SerpAPI ;
 * Le plan éditorial n'est volontairement PAS lu ici : EdPublication est le
 * calendrier des posts réseaux sociaux (tags = hashtags, liens parfois
 * externes), pas une cible de requête par page. `construireCarte` accepte des
 * entrées « plan » ; une source fiable (cible par page) viendra en PR suivante.
 * Aucune écriture, aucune migration.
 */

import { prisma } from "@/lib/prisma";
import { construireCarte, type CarteRequetes, type EntreeCarte } from "./carte-requetes";

const LIMITE_SUIVIS = 20_000;
const FRAICHEUR_JOURS = 56;

/** Interrupteur de l'équipe éditoriale : actif seulement si exactement "true". */
export function equipeEditorialeActive(): boolean {
  return process.env.CONTENT_EQUIPE_EDITORIALE === "true";
}

export async function chargerEntreesCarte(): Promise<EntreeCarte[]> {
  const suivis = await prisma.keywordTracking.findMany({
    where: { syncedAt: { gte: new Date(Date.now() - FRAICHEUR_JOURS * 86_400_000) } },
    select: { keyword: true, targetUrl: true, position: true, impressions: true, source: true },
    take: LIMITE_SUIVIS,
    orderBy: { syncedAt: "desc" },
  });

  const entrees: EntreeCarte[] = suivis.map((s) => ({
    requete: s.keyword,
    url: s.targetUrl,
    source: s.source === "gsc" ? "gsc" : "suivi",
    position: Number(s.position),
    impressions: s.impressions,
  }));
  return entrees;
}

export async function chargerCarteRequetes(): Promise<CarteRequetes> {
  return construireCarte(await chargerEntreesCarte());
}
