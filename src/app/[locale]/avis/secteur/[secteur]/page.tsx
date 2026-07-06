/**
 * Facette /avis/secteur/[secteur] — avis clients par secteur d'activité (indexable).
 * notFound() si secteur inconnu ou < FACET_MIN_COUNT avis.
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
import { isClientSectorSlug, clientSectorLabel } from "@/content/sectors";

interface Props {
  params: Promise<{ locale: string; secteur: string }>;
}

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, secteur } = await params;
  if (!hasLocale(routing.locales, locale) || !isClientSectorSlug(secteur)) return {};
  const label = clientSectorLabel(secteur);
  return buildProductMetadata({
    locale,
    path: `/avis/secteur/${secteur}`,
    title: `Avis clients Axion-IA — secteur ${label}`,
    description: `Retours d'expérience vérifiés de clients Axion-IA dans le secteur ${label}.`,
    alternates: { fr: `/avis/secteur/${secteur}`, en: `/avis/secteur/${secteur}` },
  });
}

export default async function AvisSecteurFacetPage({ params }: Props) {
  const { locale, secteur } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!isClientSectorSlug(secteur)) notFound();
  setRequestLocale(locale);

  const [reviews, agg] = await Promise.all([
    getPublishedReviews({ clientSector: secteur, pageSize: 48 }),
    getAggregateRating({ clientSector: secteur }),
  ]);
  if (reviews.total < FACET_MIN_COUNT) notFound();

  const label = clientSectorLabel(secteur);

  return (
    <>
      <JsonLd
        data={buildCollectionPageJsonLd({
          locale,
          path: `/avis/secteur/${secteur}`,
          name: `Avis clients Axion-IA — secteur ${label}`,
          description: `Avis clients vérifiés d'Axion-IA dans le secteur ${label}.`,
        })}
      />
      <FacetReviewsPage
        eyebrow="Avis par secteur"
        title="Avis clients —"
        titleEm={label}
        description={`Ce que disent les clients d'Axion-IA dans le secteur ${label}.`}
        answerQuestion={`Axion-IA a-t-il de bons avis dans le secteur ${label} ?`}
        answerText={
          agg
            ? `Dans le secteur ${label}, Axion-IA obtient une note moyenne de ${agg.ratingValue.toLocaleString("fr-FR", { minimumFractionDigits: 1 })}/5 sur ${agg.reviewCount} avis vérifiés.`
            : `Retrouvez les avis vérifiés des clients d'Axion-IA dans le secteur ${label}.`
        }
        breadcrumbLabel={label}
        breadcrumbHref={`/avis/secteur/${secteur}`}
        reviews={reviews.items}
        agg={agg}
      />
    </>
  );
}
