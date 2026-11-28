/**
 * Lecture des délais d'indexation des articles récents. Module serveur SANS
 * `"use server"` : ce n'est pas une Server Action publique. L'appelant
 * (`getPilotageEquipe`) vérifie l'administrateur et le drapeau.
 */
import { prisma } from "@/lib/prisma";
import { buildArticlePath } from "@/server/content-gen/indexing/url-builder";
import { normaliserChemin } from "@/server/seo-pilotage/donnees/chemins";
import { calculerDelais, medianeDelaiHeures, type DelaiArticle } from "./calcul";

export interface DelaisIndexation {
  readonly articles: ReadonlyArray<DelaiArticle>;
  /** Médiane des délais (heures) des articles publiés depuis 30 jours ; `null` = aucune mesure. */
  readonly medianeHeures30j: number | null;
}

export async function lireDelaisIndexation(
  maintenant: Date = new Date(),
): Promise<DelaisIndexation> {
  const depuis = new Date(maintenant.getTime() - 30 * 86_400_000);
  const rows = await prisma.article.findMany({
    where: { status: "published", publishedAt: { gte: depuis } },
    orderBy: { publishedAt: "desc" },
    take: 100,
    select: {
      id: true,
      publishedAt: true,
      isNews: true,
      templateVariant: true,
      translations: { where: { locale: "fr" }, take: 1, select: { slug: true, title: true } },
    },
  });
  const articles = rows.flatMap((r) => {
    const t = r.translations[0];
    if (!t || !r.publishedAt) return [];
    const chemin = normaliserChemin(
      buildArticlePath({ slug: t.slug, isNews: r.isNews, templateVariant: r.templateVariant }),
    );
    return chemin ? [{ id: r.id, titre: t.title, chemin, publieLe: r.publishedAt }] : [];
  });
  const inspections = articles.length
    ? await prisma.gscInspection.findMany({
        where: { chemin: { in: articles.map((a) => a.chemin) } },
        select: { chemin: true, inspecteLe: true, verdict: true },
      })
    : [];
  const delais = calculerDelais(articles, inspections);
  return { articles: delais, medianeHeures30j: medianeDelaiHeures(delais, maintenant, 30) };
}
