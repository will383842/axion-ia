// Présence d'avis clients PUBLIÉS — règle automatique unique (2026-10-09).
//
// Les avis s'affichent d'eux-mêmes dès qu'au moins un avis `status = published`
// existe en base (validé par Will dans la console). Plus aucun interrupteur
// manuel : avec 0 avis publié, rien n'apparaît (pages /avis en 404, absentes des
// sitemaps, pas de bloc, pas de lien) ; au premier avis publié, tout revient.
//
// Une seule requête (`aggregate` count + moyenne), mise en cache en mémoire
// 5 min par processus : la mise en page commune (pied de page) l'appelle sur
// chaque rendu, il ne faut pas une requête par page.
//
// ⚠️ Stub-aware (ADR 0026) : au build, `DATABASE_URL=stub.invalid` → 0 sans
// appel à la base. Rien de ce 0 n'est figé : chaque appelant est rendu à la
// requête ou en ISR (revalidate), donc le premier avis publié réapparaît sans
// redéploiement.

import { prisma } from "@/lib/prisma";

export interface StatsAvisPublies {
  /** Nombre d'avis publiés. */
  count: number;
  /** Moyenne 1..5 arrondie à 2 décimales (0 si aucun avis). */
  avg: number;
}

const AUCUN: StatsAvisPublies = { count: 0, avg: 0 };
const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; data: StatsAvisPublies } | null = null;

function isStubBuild(): boolean {
  return process.env.DATABASE_URL?.includes("stub.invalid") ?? false;
}

/** Compte et moyenne des avis publiés (cache 5 min). Jamais d'exception. */
export async function statsAvisPublies(): Promise<StatsAvisPublies> {
  if (isStubBuild()) return AUCUN;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const r = await prisma.customerReview.aggregate({
      where: { status: "published" },
      _count: { _all: true },
      _avg: { rating: true },
    });
    const count = r._count?._all ?? 0;
    const avg = r._avg?.rating ?? 0;
    const data: StatsAvisPublies = { count, avg: Math.round(avg * 100) / 100 };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    // Base indisponible → dernière valeur connue, sinon « aucun avis ».
    return cache?.data ?? AUCUN;
  }
}

/** Vrai dès qu'au moins un avis est publié : la règle d'affichage des avis. */
export async function avisPublies(): Promise<boolean> {
  return (await statsAvisPublies()).count > 0;
}

/** Tests uniquement : vide le cache mémoire. */
export function __viderCacheAvisPublies(): void {
  cache = null;
}
