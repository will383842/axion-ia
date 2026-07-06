/**
 * Fiche /avis/[slug] — un avis client = sa propre page indexable (Review JSON-LD).
 *
 * Contenu substantiel garanti (commentaire ≥ 120 car. imposé au dépôt) → jamais
 * thin. Full server component, ISR 1h. notFound() si l'avis n'est pas publié
 * (barrière de modération : aucune fuite d'URL avant validation).
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { BadgeCheck, ArrowRight } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { Cta } from "@/components/marketing/Cta";
import { buildProductMetadata } from "@/lib/seo";
import { getReviewBySlug, getRelatedReviews } from "@/server/reviews/queries";
import { reviewToJsonLd } from "@/server/reviews/jsonld";
import { StarRating } from "@/components/reviews/StarRating";
import { ReviewAvatar } from "@/components/reviews/ReviewAvatar";
import { RelatedReviews } from "@/components/reviews/RelatedReviews";
import { reviewAuthorName, reviewMetaLine } from "@/lib/reviews/display";
import { getServiceLine, serviceLineLabel } from "@/lib/reviews/service-lines";

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
  const related = await getRelatedReviews(review, 3);

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
          <article
            className="bg-paper border-border shadow-card rounded-2xl border p-6 sm:p-8"
            itemScope
            itemType="https://schema.org/Review"
          >
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

            {/* Corps de l'avis (speakable + itemprop) */}
            <p
              className="direct-answer text-fg mt-5 text-lg leading-relaxed whitespace-pre-wrap"
              itemProp="reviewBody"
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
                <p className="text-terracotta-deep text-sm font-semibold">Réponse d'Axion-IA</p>
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

      {related.length > 0 ? (
        <Section tone="sand">
          <RelatedReviews reviews={related} title="Avis similaires" />
        </Section>
      ) : null}
    </>
  );
}
