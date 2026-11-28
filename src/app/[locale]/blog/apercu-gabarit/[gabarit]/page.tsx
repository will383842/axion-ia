/**
 * Page d'APERÇU d'un gabarit d'article — réservée au contrôle « téléphone » (Playwright,
 * `tests/e2e/gabarits-telephone.spec.ts`) et aux captures de `docs/captures-mobile/`.
 *
 * - Derrière l'interrupteur `BLOG_GABARITS_V2` : éteint → 404, comme les gabarits eux-mêmes.
 * - `noindex, nofollow` ; absente du plan du site (`app/sitemap.ts` est une liste explicite).
 * - Aucune requête base : l'article d'exemple est figé (`exemple-article.ts`).
 * - Tout code de `GABARITS_ARTICLE` est accepté : un gabarit ajouté à la liste est donc
 *   rendu, et contrôlé, sans toucher à cette page.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { ArticleGabarit } from "@/components/article-v2/ArticleGabarit";
import { gabaritsV2Actifs } from "@/lib/blog/gabarits-v2";
import { GABARITS_ARTICLE, type GabaritArticle } from "@/server/content-gen/blog/gabarits";
import { propsExempleArticle } from "./exemple-article";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aperçu de gabarit",
  robots: { index: false, follow: false },
};

interface PageProps {
  readonly params: Promise<{ locale: string; gabarit: string }>;
}

export default async function ApercuGabaritPage({ params }: PageProps) {
  const { locale, gabarit } = await params;
  if (!gabaritsV2Actifs()) notFound();
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!(GABARITS_ARTICLE as ReadonlyArray<string>).includes(gabarit)) notFound();
  setRequestLocale(locale);
  return <ArticleGabarit {...propsExempleArticle(gabarit as GabaritArticle, locale)} />;
}
