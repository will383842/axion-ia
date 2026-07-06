/**
 * Fiche /avis/[slug] — un avis client = sa propre page indexable (Review JSON-LD).
 *
 * Contenu substantiel garanti (commentaire ≥ 120 car. imposé au dépôt) → jamais
 * thin. Full server component, ISR 1h. notFound() si l’avis n’est pas publié
 * (barrière de modération : aucune fuite d’URL avant validation).
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { BadgeCheck, ArrowRight, MapPin, Layers, Compass, Star } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { Cta } from "@/components/marketing/Cta";
import { buildProductMetadata } from "@/lib/seo";
import { getReviewBySlug, getRelatedReviews, getAggregateRating } from "@/server/reviews/queries";
import { reviewToJsonLd } from "@/server/reviews/jsonld";
import { StarRating } from "@/components/reviews/StarRating";
import { ReviewAvatar } from "@/components/reviews/ReviewAvatar";
import { RelatedReviews } from "@/components/reviews/RelatedReviews";
import { reviewAuthorName, reviewMetaLine } from "@/lib/reviews/display";
import { getServiceLine, serviceLineLabel } from "@/lib/reviews/service-lines";
import { clientSectorLabel } from "@/content/sectors";
import { FACET_MIN_COUNT } from "@/lib/reviews/config";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export const revalidate = 3600;
export const dynamicParams = true;

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const review = await getReviewBySlug(slug);
  if (!review) {
    return { robots: { index: false, follow: false } };
  }
  const author = reviewAuthorName(review);
  const title = review.title
    ? `${review.title} — avis de ${author} · Axion-IA`
    : `Avis de ${author} sur Axion-IA`;
  return buildProductMetadata({
    locale,
    path: `/avis/${slug}`,
    title,
    description: review.comment.slice(0, 155),
    alternates: { fr: `/avis/${slug}`, en: `/avis/${slug}` },
    ogType: "article",
  });
}

export default async function AvisDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const review = await getReviewBySlug(slug);
  if (!review) notFound();

  const author = reviewAuthorName(review);
  const meta = reviewMetaLine(review);
  const date = review.publishedAt ?? review.createdAt;
  const svc = review.serviceLine ? getServiceLine(review.serviceLine) : undefined;
  const serviceLabel = review.serviceLine ? serviceLineLabel(review.serviceLine) : null;
  const sectorLabel = review.clientSector ? clientSectorLabel(review.clientSector) : null;
  const cityLabel = review.cityName ?? null;

  // Agrégats par portée (service / ville / secteur) — alimentent la phrase de
  // contexte + gèrent les liens de maillage. On ne requête que les portées que
  // l'avis possède réellement.
  const [related, svcAgg, cityAgg, sectorAgg, globalAgg] = await Promise.all([
    getRelatedReviews(review, 3),
    review.serviceLine
      ? getAggregateRating({ serviceLine: review.serviceLine })
      : Promise.resolve(null),
    review.citySlug ? getAggregateRating({ citySlug: review.citySlug }) : Promise.resolve(null),
    review.clientSector
      ? getAggregateRating({ clientSector: review.clientSector })
      : Promise.resolve(null),
    getAggregateRating(),
  ]);

  // Un lien vers une page facette n'est valide que si la facette atteint le seuil
  // (sinon la route facette renvoie notFound → lien mort). Garde-fou anti-régression.
  const linkCity = Boolean(review.citySlug && (cityAgg?.reviewCount ?? 0) >= FACET_MIN_COUNT);
  const linkSector = Boolean(
    review.clientSector && (sectorAgg?.reviewCount ?? 0) >= FACET_MIN_COUNT,
  );
  const linkServiceFacet = Boolean(
    review.serviceLine && (svcAgg?.reviewCount ?? 0) >= FACET_MIN_COUNT,
  );
  const hasExplore = linkCity || linkSector || linkServiceFacet;
  // Phrase de contexte factuelle (varie par avis) : portée la plus pertinente d'abord
  // (service → secteur → global). Affichée à partir de 2 avis (sinon « 1 avis » = vide
  // de sens). La portée inclut sa préposition pour une phrase naturelle.
  const contextAgg =
    svcAgg && svcAgg.reviewCount >= 2 && serviceLabel
      ? { label: `sur ${serviceLabel}`, agg: svcAgg }
      : sectorAgg && sectorAgg.reviewCount >= 2 && sectorLabel
        ? { label: `dans le secteur ${sectorLabel}`, agg: sectorAgg }
        : globalAgg && globalAgg.reviewCount >= 2
          ? { label: "sur Axion-IA", agg: globalAgg }
          : null;

  return (
    <>
      <JsonLd data={reviewToJsonLd(review)} />

      <Section tone="halo-warm" titleAs="h1" title={review.title ?? `Avis de ${author}`}>
        <Breadcrumbs
          items={[
            { href: "/avis", label: "Avis clients" },
            { href: `/avis/${slug}`, label: author },
          ]}
        />
      </Section>

      <Section tone="canvas">
        <div className="mx-auto max-w-2xl">
          <article className="bg-paper border-border-strong shadow-card rounded-2xl border p-6 sm:p-8">
            {/* En-tête */}
            <div className="flex items-start gap-4">
              <ReviewAvatar
                name={author}
                photoUrl={review.photoUrl}
                photoAlt={review.photoAlt}
                size={56}
              />
              <div className="min-w-0">
                <p className="text-fg flex items-center gap-2 font-semibold">
                  {author}
                  {review.isVerified ? (
                    <span className="bg-terracotta-soft text-terracotta-deep inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                      <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                      Vérifié
                    </span>
                  ) : null}
                </p>
                {meta ? <p className="text-terracotta text-sm">{meta}</p> : null}
                <p className="text-fg-muted text-xs">
                  <time dateTime={date.toISOString()}>{DATE_FMT.format(date)}</time>
                </p>
              </div>
            </div>

            <div className="mt-4">
              <StarRating value={review.rating} size={22} showValue />
            </div>

            {/* Corps de l’avis (speakable + itemprop) */}
            <p
              className="direct-answer text-fg mt-5 text-lg leading-relaxed whitespace-pre-wrap"
              data-answer
            >
              {review.comment}
            </p>

            {svc ? (
              <p className="text-fg-muted mt-4 text-sm">
                Service concerné :{" "}
                <Link href={svc.path as never} className="text-primary underline">
                  {serviceLineLabel(review.serviceLine!)}
                </Link>
              </p>
            ) : null}

            {/* Notre réponse */}
            {review.replyBody ? (
              <div className="border-l-terracotta bg-sand/60 mt-6 rounded-lg border border-l-2 p-4">
                <p className="text-terracotta-deep text-sm font-semibold">Réponse d’Axion-IA</p>
                <p className="text-fg-soft mt-1 whitespace-pre-wrap">{review.replyBody}</p>
                {review.repliedAt ? (
                  <p className="text-fg-muted mt-2 text-xs">
                    <time dateTime={review.repliedAt.toISOString()}>
                      {DATE_FMT.format(review.repliedAt)}
                    </time>
                  </p>
                ) : null}
              </div>
            ) : null}
          </article>

          {/* CTA */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Cta href="/avis/deposer" variant="primary">
              Déposer mon avis
            </Cta>
            {svc ? (
              <Cta href={svc.path} variant="outline">
                Découvrir ce service
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
            ) : null}
          </div>
        </div>
      </Section>

      {/* Cet avis en contexte — phrase factuelle (varie par avis) + maillage interne
          vers les facettes ville/secteur/service (gaté ≥ FACET_MIN_COUNT). */}
      {contextAgg || hasExplore ? (
        <Section tone="sand" eyebrow="En contexte" title="Cet avis en" titleEm="contexte">
          <div className="mx-auto max-w-2xl space-y-6">
            {contextAgg ? (
              <p className="text-fg-soft text-lg leading-relaxed">
                Cet avis fait partie de{" "}
                <strong className="text-fg">
                  {contextAgg.agg.reviewCount} avis clients vérifiés
                </strong>{" "}
                {contextAgg.label} — note moyenne{" "}
                <strong className="text-terracotta">
                  {contextAgg.agg.ratingValue.toLocaleString("fr-FR", {
                    minimumFractionDigits: 1,
                  })}
                  /5
                </strong>
                .
              </p>
            ) : null}
            <ul className="flex list-none flex-wrap gap-3 p-0">
              {linkCity ? (
                <li>
                  <Link
                    href={{ pathname: "/avis/ville/[ville]", params: { ville: review.citySlug! } }}
                    className="border-border-strong bg-paper text-fg hover:border-terracotta hover:text-terracotta inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                  >
                    <MapPin aria-hidden="true" className="text-terracotta h-4 w-4" />
                    Avis à {cityLabel}
                  </Link>
                </li>
              ) : null}
              {linkSector ? (
                <li>
                  <Link
                    href={{
                      pathname: "/avis/secteur/[secteur]",
                      params: { secteur: review.clientSector! },
                    }}
                    className="border-border-strong bg-paper text-fg hover:border-terracotta hover:text-terracotta inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                  >
                    <Layers aria-hidden="true" className="text-terracotta h-4 w-4" />
                    Avis secteur {sectorLabel}
                  </Link>
                </li>
              ) : null}
              {linkServiceFacet ? (
                <li>
                  <Link
                    href={{
                      pathname: "/avis/service/[service]",
                      params: { service: review.serviceLine! },
                    }}
                    className="border-border-strong bg-paper text-fg hover:border-terracotta hover:text-terracotta inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                  >
                    <Star aria-hidden="true" className="text-terracotta h-4 w-4" />
                    Avis sur {serviceLabel}
                  </Link>
                </li>
              ) : null}
              <li>
                <Link
                  href="/avis"
                  className="border-border-strong bg-paper text-fg hover:border-terracotta hover:text-terracotta inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                >
                  <Compass aria-hidden="true" className="text-terracotta h-4 w-4" />
                  Tous les avis clients
                </Link>
              </li>
            </ul>
          </div>
        </Section>
      ) : null}

      {related.length > 0 ? (
        <Section tone="paper">
          <RelatedReviews reviews={related} title="Avis similaires" />
        </Section>
      ) : null}
    </>
  );
}
