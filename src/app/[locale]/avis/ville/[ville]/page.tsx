/**
 * Facette /avis/ville/[ville] — avis clients d'une ville (indexable).
 * Couvre toute la France → maillage géo + crawl. notFound() si < FACET_MIN_COUNT.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildCollectionPageJsonLd } from "@/lib/seo";
import { getPublishedReviews, getAggregateRating } from "@/server/reviews/queries";
import { FacetReviewsPage } from "@/components/reviews/FacetReviewsPage";
import { FACET_MIN_COUNT } from "@/lib/reviews/config";

interface Props {
  params: Promise<{ locale: string; ville: string }>;
}

export const revalidate = 3600;

function prettify(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, ville } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const name = prettify(ville);
  return buildProductMetadata({
    locale,
    path: `/avis/ville/${ville}`,
    title: `Avis clients Axion-IA à ${name}`,
    description: `Retours d'expérience vérifiés de clients Axion-IA à ${name} : audit, formation, implémentation et accompagnement IA.`,
    alternates: { fr: `/avis/ville/${ville}`, en: `/avis/ville/${ville}` },
  });
}

export default async function AvisVilleFacetPage({ params }: Props) {
  const { locale, ville } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [reviews, agg] = await Promise.all([
    getPublishedReviews({ citySlug: ville, pageSize: 48 }),
    getAggregateRating({ citySlug: ville }),
  ]);
  if (reviews.total < FACET_MIN_COUNT) notFound();

  const name = reviews.items[0]?.cityName ?? prettify(ville);

  return (
    <>
      <JsonLd
        data={buildCollectionPageJsonLd({
          locale,
          path: `/avis/ville/${ville}`,
          name: `Avis clients Axion-IA à ${name}`,
          description: `Avis clients vérifiés d'Axion-IA à ${name}.`,
        })}
      />
      <FacetReviewsPage
        eyebrow="Avis par ville"
        title="Avis clients à"
        titleEm={name}
        description={`Les retours d'expérience de clients d'Axion-IA à ${name} et ses environs.`}
        answerQuestion={`Axion-IA a-t-il de bons avis à ${name} ?`}
        answerText={
          agg
            ? `Les clients d'Axion-IA à ${name} attribuent une note moyenne de ${agg.ratingValue.toLocaleString("fr-FR", { minimumFractionDigits: 1 })}/5 sur ${agg.reviewCount} avis vérifiés.`
            : `Retrouvez les avis vérifiés des clients d'Axion-IA à ${name}.`
        }
        breadcrumbLabel={name}
        breadcrumbHref={`/avis/ville/${ville}`}
        reviews={reviews.items}
        agg={agg}
      />
    </>
  );
}
