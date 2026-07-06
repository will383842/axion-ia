/**
 * Facette /avis/departement/[code] — avis clients par département (indexable).
 * notFound() si code invalide ou < FACET_MIN_COUNT avis.
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
  params: Promise<{ locale: string; code: string }>;
}

export const revalidate = 3600;

/** Code département FR : 1–95, 971–976, 2A/2B. */
function isDeptCode(code: string): boolean {
  return /^(2[AB]|[0-9]{1,3})$/.test(code);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, code } = await params;
  if (!hasLocale(routing.locales, locale) || !isDeptCode(code)) return {};
  return buildProductMetadata({
    locale,
    path: `/avis/departement/${code}`,
    title: `Avis clients Axion-IA — département ${code}`,
    description: `Retours d'expérience vérifiés de clients Axion-IA dans le département ${code}.`,
    alternates: { fr: `/avis/departement/${code}`, en: `/avis/departement/${code}` },
  });
}

export default async function AvisDepartementFacetPage({ params }: Props) {
  const { locale, code } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!isDeptCode(code)) notFound();
  setRequestLocale(locale);

  const [reviews, agg] = await Promise.all([
    getPublishedReviews({ departmentCode: code, pageSize: 48 }),
    getAggregateRating({ departmentCode: code }),
  ]);
  if (reviews.total < FACET_MIN_COUNT) notFound();

  const label = `Département ${code}`;

  return (
    <>
      <JsonLd
        data={buildCollectionPageJsonLd({
          locale,
          path: `/avis/departement/${code}`,
          name: `Avis clients Axion-IA — ${label}`,
          description: `Avis clients vérifiés d'Axion-IA dans le ${label.toLowerCase()}.`,
        })}
      />
      <FacetReviewsPage
        eyebrow="Avis par département"
        title="Avis clients —"
        titleEm={label}
        description={`Les retours d'expérience de clients d'Axion-IA dans le ${label.toLowerCase()}.`}
        answerQuestion={`Axion-IA a-t-il de bons avis dans le ${label.toLowerCase()} ?`}
        answerText={
          agg
            ? `Dans le ${label.toLowerCase()}, Axion-IA obtient une note moyenne de ${agg.ratingValue.toLocaleString("fr-FR", { minimumFractionDigits: 1 })}/5 sur ${agg.reviewCount} avis vérifiés.`
            : `Retrouvez les avis vérifiés des clients d'Axion-IA dans le ${label.toLowerCase()}.`
        }
        breadcrumbLabel={label}
        breadcrumbHref={`/avis/departement/${code}`}
        reviews={reviews.items}
        agg={agg}
      />
    </>
  );
}
