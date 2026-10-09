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
import { FACET_MIN_COUNT, noteGlobaleAffichable } from "@/lib/reviews/config";
import { avisPublies } from "@/server/reviews/presence";

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
    description: `Retours d'expérience de clients Axion-IA à ${name} : audit, formation, implémentation et accompagnement IA.`,
    alternates: { fr: `/avis/ville/${ville}`, en: `/avis/ville/${ville}` },
  });
}

export default async function AvisVilleFacetPage({ params }: Props) {
  // Règle automatique (src/content/preuves-sociales.ts) : 404 tant qu'aucun avis
  // n'est publié. Le 404 est mis en cache ISR (revalidate) puis régénéré : la
  // page revient seule au premier avis publié, sans redéploiement.
  if (!(await avisPublies())) notFound();
  const { locale, ville } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [reviews, aggBrut] = await Promise.all([
    getPublishedReviews({ citySlug: ville, pageSize: 48 }),
    getAggregateRating({ citySlug: ville }),
  ]);
  // Note de la facette seulement à partir de 5 avis (règle de preuves-sociales.ts).
  const agg = noteGlobaleAffichable(aggBrut);
  if (reviews.total < FACET_MIN_COUNT) notFound();

  const name = reviews.items[0]?.cityName ?? prettify(ville);

  return (
    <>
      <JsonLd
        data={buildCollectionPageJsonLd({
          locale,
          path: `/avis/ville/${ville}`,
          name: `Avis clients Axion-IA à ${name}`,
          description: `Avis clients d'Axion-IA à ${name}.`,
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
            ? `Les clients d'Axion-IA à ${name} attribuent une note moyenne de ${agg.ratingValue.toLocaleString("fr-FR", { minimumFractionDigits: 1 })}/5 sur ${agg.reviewCount} avis clients.`
            : `Retrouvez les avis des clients d'Axion-IA à ${name}.`
        }
        breadcrumbLabel={name}
        breadcrumbHref={`/avis/ville/${ville}`}
        reviews={reviews.items}
        agg={agg}
      />
    </>
  );
}
