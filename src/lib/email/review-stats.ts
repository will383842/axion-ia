// Stats avis clients pour les emails (bandeau de confiance) — valeurs RÉELLES
// lues depuis `customer_reviews` (status=published), mises en cache 15 min.
//
// Build-safety (ADR 0026) : au build, le Proxy Prisma stub renvoie _count 0 →
// `{ count: 0, avg: 0 }` → le bandeau masque la ligne avis (pas de faux chiffre).

import { prisma } from "@/lib/prisma";

export interface ReviewStats {
  count: number;
  /** Moyenne 1..5 (2 décimales). */
  avg: number;
}

const FALLBACK: ReviewStats = { count: 0, avg: 0 };
const TTL_MS = 15 * 60 * 1000;
let cache: { at: number; data: ReviewStats } | null = null;

export async function getPublishedReviewStats(): Promise<ReviewStats> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const r = await prisma.customerReview.aggregate({
      where: { status: "published" },
      _count: { _all: true },
      _avg: { rating: true },
    });
    const count = r._count?._all ?? 0;
    const avg = r._avg?.rating ?? 0;
    const data: ReviewStats = { count, avg: Math.round(avg * 100) / 100 };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    // DB indisponible → dernière valeur connue, sinon fallback neutre.
    return cache?.data ?? FALLBACK;
  }
}
