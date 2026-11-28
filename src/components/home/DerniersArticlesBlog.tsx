import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildArticlePath } from "@/server/content-gen/indexing/url-builder";

/**
 * Liens vers les derniers articles du blog, depuis l'accueil (composant serveur, aucun JS client).
 *
 * Search Console 28/11/2026 : Google n'était pas revenu sur /fr/blog depuis le 11/09. Un lien
 * depuis la page la plus visitée, vers les articles les plus récents, est le chemin le plus court
 * pour que les nouveaux articles soient découverts. L'accueil est en ISR (1 h) : la liste suit les
 * publications. Base injoignable ou vide (build stub) : rien n'est rendu, jamais d'erreur.
 */
export async function DerniersArticlesBlog({
  titre,
  lienBlog,
  classeLien,
}: {
  titre: string;
  lienBlog: string;
  classeLien: string;
}) {
  let articles: Array<{ titre: string; href: string }> = [];
  try {
    const rows = await prisma.article.findMany({
      where: {
        status: "published",
        indexationTier: "tier_1_indexable",
        isNews: false,
        // Mêmes plancher et bornes que le sitemap du blog : jamais un article qu'il exclut.
        qualityScore: { gte: 70 },
        publishedAt: { not: null, lte: new Date() },
      },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        templateVariant: true,
        translations: { where: { locale: "fr" }, take: 1, select: { slug: true, title: true } },
      },
    });
    articles = rows.flatMap((r) => {
      const t = r.translations[0];
      if (!t || t.slug.includes("/")) return [];
      return [
        {
          titre: t.title,
          href: buildArticlePath({
            slug: t.slug,
            isNews: false,
            templateVariant: r.templateVariant,
          }),
        },
      ];
    });
  } catch {
    articles = [];
  }
  if (articles.length === 0) return null;
  return (
    <nav aria-label={titre} className="mt-6">
      <p className="text-fg font-semibold">{titre}</p>
      <ul className="mt-2 space-y-1 text-[15px]">
        {articles.map((a) => (
          <li key={a.href}>
            <Link href={a.href} className={`${classeLien} inline-flex min-h-11 items-center`}>
              {a.titre}
            </Link>
          </li>
        ))}
        <li>
          <Link href="/fr/blog" className={`${classeLien} inline-flex min-h-11 items-center`}>
            {lienBlog}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
