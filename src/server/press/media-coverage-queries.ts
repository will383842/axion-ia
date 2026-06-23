// Lecture publique « Couverture médias » — retombées presse externes.
//
// Doctrine Axion-IA :
//   - FR canonique, EN miroir (next-intl Locale "fr" | "en").
//   - Pas de fallback fixtures : la couverture médias est 100 % gérée depuis
//     l'admin (vide = vide). Le bloc public ne s'affiche que s'il y a des lignes.
//   - try/catch → [] : la table peut manquer au build stub.invalid OU avant
//     l'application de la migration ; on ne casse JAMAIS /presse au SSG.
//   - Shape `MediaCoverageCard` consommée par le composant public (wiré ailleurs).

import { prisma } from "@/lib/prisma";

/** Carte couverture médias — grille `/presse`. */
export interface MediaCoverageCard {
  id: string;
  /** Nom du média (ex. « Les Échos »). */
  outlet: string;
  /** URL externe de l'article / interview. */
  url: string;
  /** ISO date string `yyyy-mm-dd` — affichage + tri. */
  publishedAt: string;
  /** Titre de l'article (traduction de la locale demandée). */
  title: string;
}

// ─────────────────────────────────────────────────────────────────
// Retombées publiées (cartes). Triées sortOrder asc puis publishedAt desc.
// ─────────────────────────────────────────────────────────────────
export async function getPublishedMediaCoverage(locale: "fr" | "en"): Promise<MediaCoverageCard[]> {
  try {
    const rows = await prisma.mediaCoverage.findMany({
      where: { status: "published", deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
      include: { translations: { where: { locale } } },
    });

    const mapped: MediaCoverageCard[] = [];
    for (const row of rows) {
      const t = row.translations[0];
      if (!t) continue; // pas de traduction dans cette locale → skip
      mapped.push({
        id: row.id,
        outlet: row.outlet,
        url: row.url,
        publishedAt: row.publishedAt.toISOString().slice(0, 10),
        title: t.title,
      });
    }
    return mapped;
  } catch (err) {
    // Table absente (build stub / migration non appliquée) → ne jamais casser /presse.
    console.error("[getPublishedMediaCoverage]", err);
    return [];
  }
}
