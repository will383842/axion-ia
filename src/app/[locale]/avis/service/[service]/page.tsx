/**
 * Facette /avis/service/[service] — avis d'un service Axion-IA (indexable).
 * AggregateRating scopé au service → étoiles Google éligibles (Course/Product).
 * notFound() si < FACET_MIN_COUNT avis (anti-thin / anti-doorway).
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildCollectionPageJsonLd, SITE_URL } from "@/lib/seo";
import { getPublishedReviews, getAggregateRating } from "@/server/reviews/queries";
import { serviceAggregateJsonLd } from "@/server/reviews/jsonld";
import { FacetReviewsPage } from "@/components/reviews/FacetReviewsPage";
import { FACET_MIN_COUNT, noteGlobaleAffichable } from "@/lib/reviews/config";
import { isServiceLine, getServiceLine, serviceLineLabel } from "@/lib/reviews/service-lines";
import { avisPublies } from "@/server/reviews/presence";

interface Props {
  params: Promise<{ locale: string; service: string }>;
}

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, service } = await params;
  if (!hasLocale(routing.locales, locale) || !isServiceLine(service)) return {};
  const label = serviceLineLabel(service);
  return buildProductMetadata({
    locale,
    path: `/avis/service/${service}`,
    title: `Avis clients — ${label} · Axion-IA`,
    description: `Retours d'expérience de clients Axion-IA sur nos prestations « ${label} ».`,
    alternates: { fr: `/avis/service/${service}`, en: `/avis/service/${service}` },
  });
}

export default async function AvisServiceFacetPage({ params }: Props) {
  // Règle automatique (src/content/preuves-sociales.ts) : 404 tant qu'aucun avis
  // n'est publié. Le 404 est mis en cache ISR (revalidate) puis régénéré : la
  // page revient seule au premier avis publié, sans redéploiement.
  if (!(await avisPublies())) notFound();
  const { locale, service } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!isServiceLine(service)) notFound();
  setRequestLocale(locale);

  const [reviews, aggBrut] = await Promise.all([
    getPublishedReviews({ serviceLine: service, pageSize: 48, sort: "rating_desc" }),
    getAggregateRating({ serviceLine: service }),
  ]);
  // Note de la facette seulement à partir de 5 avis (règle de preuves-sociales.ts).
  const agg = noteGlobaleAffichable(aggBrut);
  if (reviews.total < FACET_MIN_COUNT) notFound();

  const svc = getServiceLine(service)!;
  const label = serviceLineLabel(service);
  const url = `${SITE_URL}/${locale}/avis/service/${service}`;
  const serviceJsonLd = serviceAggregateJsonLd(
    { type: svc.itemType, name: svc.schemaName },
    agg,
    url,
  );

  return (
    <>
      <JsonLd
        data={buildCollectionPageJsonLd({
          locale,
          path: `/avis/service/${service}`,
          name: `Avis clients — ${label}`,
          description: `Avis clients sur le service ${label} d'Axion-IA.`,
        })}
      />
      {serviceJsonLd ? <JsonLd data={serviceJsonLd} /> : null}
      <FacetReviewsPage
        eyebrow="Avis par service"
        title="Avis clients"
        titleEm={label}
        description={`Ce que disent les clients d'Axion-IA de nos prestations « ${label} ».`}
        answerQuestion={`Que pensent les clients du service ${label} d'Axion-IA ?`}
        answerText={
          agg
            ? `Le service « ${label} » d'Axion-IA obtient une note moyenne de ${agg.ratingValue.toLocaleString("fr-FR", { minimumFractionDigits: 1 })}/5 sur ${agg.reviewCount} avis clients.`
            : `Retrouvez les retours d'expérience des clients d'Axion-IA sur le service « ${label} ».`
        }
        breadcrumbLabel={label}
        breadcrumbHref={`/avis/service/${service}`}
        reviews={reviews.items}
        agg={agg}
      />
    </>
  );
}
