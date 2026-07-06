/**
 * Fiche /avis/[slug] — un avis client = sa propre page indexable.
 *
 * Contenu substantiel garanti (commentaire ≥ 120 car. imposé au dépôt) → jamais
 * thin. Full server component (0 JS client), CLS 0, ISR 1h. notFound() si l'avis
 * n'est pas publié (barrière de modération : aucune fuite d'URL avant validation).
 *
 * SEO / AEO / GEO — balisage DÉTERMINISTE (pas de LLM au runtime) :
 *  - Review JSON-LD (reviewToJsonLd) + BreadcrumbList (via <Breadcrumbs>).
 *  - Snippet-0 : <AnswerCard> en tête, résumé factuel dérivé des données de l'avis
 *    (jamais de contenu inventé) + speakable (data-answer).
 *  - Section « Cet avis en contexte » : agrégats SSOT ciblés (service/secteur/ville)
 *    + maillage interne vers les facettes, GATÉ ≥ FACET_MIN_COUNT (anti-lien-mort,
 *    la facette < seuil renvoie notFound). Contenu unique par avis (anti-boilerplate).
 */

import type { Metadata } from "next";
import type { ComponentProps } from "react";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { BadgeCheck, ArrowRight, Quote, MapPin, Building2, Briefcase, Star } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Link } from "@/i18n/navigation";
import { Cta } from "@/components/marketing/Cta";
import { buildProductMetadata } from "@/lib/seo";
import { getReviewBySlug, getRelatedReviews, getAggregateRating } from "@/server/reviews/queries";
import { reviewToJsonLd } from "@/server/reviews/jsonld";
import { StarRating } from "@/components/reviews/StarRating";
import { ReviewAvatar } from "@/components/reviews/ReviewAvatar";
import { RelatedReviews } from "@/components/reviews/RelatedReviews";
import { reviewAuthorName } from "@/lib/reviews/display";
import { getServiceLine, serviceLineLabel } from "@/lib/reviews/service-lines";
import { clientSectorLabel } from "@/content/sectors";
import { FACET_MIN_COUNT } from "@/lib/reviews/config";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export const revalidate = 3600;
export const dynamicParams = true;

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

function prettifyCity(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Première phrase du commentaire (fallback résumé si pas de titre). */
function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

const fmtNote = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1 });

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
  const date = review.publishedAt ?? review.createdAt;
  const svc = review.serviceLine ? getServiceLine(review.serviceLine) : undefined;
  const sectorLabel = review.clientSector ? clientSectorLabel(review.clientSector) : null;
  const cityLabel = review.cityName ?? (review.citySlug ? prettifyCity(review.citySlug) : null);

  // Agrégats ciblés (SSOT) + avis similaires, en parallèle. Servent à la fois à la
  // phrase « en contexte » (factuelle) et au gating des liens de facettes.
  const [related, serviceAgg, sectorAgg, cityAgg, deptAgg] = await Promise.all([
    getRelatedReviews(review, 3),
    review.serviceLine ? getAggregateRating({ serviceLine: review.serviceLine }) : null,
    review.clientSector ? getAggregateRating({ clientSector: review.clientSector }) : null,
    review.citySlug ? getAggregateRating({ citySlug: review.citySlug }) : null,
    review.departmentCode ? getAggregateRating({ departmentCode: review.departmentCode }) : null,
  ]);

  // Snippet-0 : résumé factuel dérivé UNIQUEMENT des données de l'avis.
  const takeaway = review.title ?? firstSentence(review.comment);
  const answerBody = `${author} attribue la note de ${review.rating}/5 à Axion-IA${
    svc ? ` pour ${svc.labelFr.toLowerCase()}` : ""
  }${cityLabel ? `, à ${cityLabel}` : ""}. « ${takeaway} »`;

  // Phrase « en contexte » : le scope le plus pertinent ayant ≥ 2 avis.
  const contextPhrase =
    svc && serviceAgg && serviceAgg.reviewCount >= 2
      ? `Axion-IA est noté ${fmtNote(serviceAgg.ratingValue)}/5 sur ${serviceAgg.reviewCount} avis pour ${svc.labelFr.toLowerCase()}.`
      : sectorLabel && sectorAgg && sectorAgg.reviewCount >= 2
        ? `Dans le secteur ${sectorLabel.toLowerCase()}, Axion-IA affiche ${fmtNote(sectorAgg.ratingValue)}/5 sur ${sectorAgg.reviewCount} avis clients.`
        : cityLabel && cityAgg && cityAgg.reviewCount >= 2
          ? `À ${cityLabel}, Axion-IA affiche ${fmtNote(cityAgg.ratingValue)}/5 sur ${cityAgg.reviewCount} avis clients.`
          : null;

  // Maillage interne : uniquement les facettes ≥ FACET_MIN_COUNT (sinon lien mort).
  const facetLinks: { key: string; href: ComponentProps<typeof Link>["href"]; label: string }[] =
    [];
  if (review.clientSector && sectorAgg && sectorAgg.reviewCount >= FACET_MIN_COUNT) {
    facetLinks.push({
      key: "secteur",
      href: { pathname: "/avis/secteur/[secteur]", params: { secteur: review.clientSector } },
      label: `Avis ${clientSectorLabel(review.clientSector).toLowerCase()} (${sectorAgg.reviewCount})`,
    });
  }
  if (review.serviceLine && serviceAgg && serviceAgg.reviewCount >= FACET_MIN_COUNT) {
    facetLinks.push({
      key: "service",
      href: { pathname: "/avis/service/[service]", params: { service: review.serviceLine } },
      label: `Avis ${serviceLineLabel(review.serviceLine).toLowerCase()} (${serviceAgg.reviewCount})`,
    });
  }
  if (review.citySlug && cityAgg && cityAgg.reviewCount >= FACET_MIN_COUNT) {
    facetLinks.push({
      key: "ville",
      href: { pathname: "/avis/ville/[ville]", params: { ville: review.citySlug } },
      label: `Avis à ${cityLabel} (${cityAgg.reviewCount})`,
    });
  }
  if (review.departmentCode && deptAgg && deptAgg.reviewCount >= FACET_MIN_COUNT) {
    facetLinks.push({
      key: "departement",
      href: { pathname: "/avis/departement/[code]", params: { code: review.departmentCode } },
      label: `Avis dép. ${review.departmentCode} (${deptAgg.reviewCount})`,
    });
  }

  const showContext = Boolean(contextPhrase) || facetLinks.length > 0;

  return (
    <>
      <JsonLd data={reviewToJsonLd(review)} />

      {/* 1. Hero + snippet-0 (AEO) */}
      <Section
        tone="halo-warm"
        titleAs="h1"
        eyebrow="Avis client"
        title={review.title ?? `Avis de ${author}`}
      >
        <Breadcrumbs
          items={[
            { href: "/avis", label: "Avis clients" },
            { href: `/avis/${slug}`, label: author },
          ]}
        />
        <div className="mt-6 max-w-2xl">
          <AnswerCard
            question={`Que retient ${author} de son expérience avec Axion-IA ?`}
            locale="fr"
            sourceLabel={`Avis ${review.isVerified ? "vérifié · " : ""}${DATE_FMT.format(date)}`}
          >
            {answerBody}
          </AnswerCard>
        </div>
      </Section>

      {/* 2. L'avis */}
      <Section tone="canvas">
        <div className="mx-auto max-w-2xl">
          <article className="bg-paper border-border shadow-card relative rounded-2xl border p-6 sm:p-8">
            <Quote
              aria-hidden="true"
              className="text-terracotta/15 absolute top-5 right-5 h-12 w-12"
              strokeWidth={1.5}
            />
            {/* En-tête */}
            <div className="flex items-start gap-4">
              <ReviewAvatar
                name={author}
                photoUrl={review.photoUrl}
                photoAlt={review.photoAlt}
                size={56}
              />
              <div className="min-w-0">
                <p className="text-fg flex flex-wrap items-center gap-2 font-semibold">
                  {author}
                  {review.isVerified ? (
                    <span className="bg-terracotta-soft text-terracotta-deep inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                      <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                      Vérifié
                    </span>
                  ) : null}
                </p>
                <p className="text-fg-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {sectorLabel ? (
                    <span className="inline-flex items-center gap-1">
                      <Building2 aria-hidden="true" className="text-terracotta h-3.5 w-3.5" />
                      {sectorLabel}
                    </span>
                  ) : null}
                  {cityLabel ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin aria-hidden="true" className="text-terracotta h-3.5 w-3.5" />
                      {cityLabel}
                    </span>
                  ) : null}
                  {svc ? (
                    <span className="inline-flex items-center gap-1">
                      <Briefcase aria-hidden="true" className="text-terracotta h-3.5 w-3.5" />
                      {svc.labelFr}
                    </span>
                  ) : null}
                </p>
                <p className="text-fg-muted mt-0.5 text-xs">
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
        </div>
      </Section>

      {/* 3. Cet avis en contexte — agrégats SSOT + maillage interne gaté */}
      {showContext ? (
        <Section tone="sand" eyebrow="En contexte" title="Cet avis dans" titleEm="son ensemble">
          <div className="mx-auto max-w-2xl">
            {contextPhrase ? (
              <p className="text-fg flex items-start gap-3 text-lg leading-relaxed">
                <Star
                  aria-hidden="true"
                  className="text-terracotta mt-1 h-5 w-5 shrink-0"
                  fill="currentColor"
                />
                <span data-answer>{contextPhrase}</span>
              </p>
            ) : null}
            {facetLinks.length > 0 ? (
              <ul className="mt-6 flex flex-wrap gap-2">
                {facetLinks.map((f) => (
                  <li key={f.key}>
                    <Link
                      href={f.href}
                      className="text-fg-soft bg-paper border-border hover:border-terracotta hover:text-terracotta inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition"
                    >
                      {f.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/avis"
                    className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition"
                  >
                    Tous les avis clients
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </li>
              </ul>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* 4. Avis similaires */}
      {related.length > 0 ? (
        <Section tone="canvas">
          <RelatedReviews reviews={related} title="Avis similaires" />
        </Section>
      ) : null}

      {/* 5. CTA final */}
      <CtaBlock
        title="Vous aussi,"
        titleEm="partagez votre expérience"
        description="Votre retour aide d'autres dirigeants à se décider — et nous aide à progresser."
        tone="mocha"
        cta={
          <>
            <Cta href="/avis/deposer" variant="primary">
              Déposer mon avis
            </Cta>
            {svc ? (
              <Cta href={svc.path} variant="outline">
                Découvrir ce service
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
            ) : null}
          </>
        }
      />
    </>
  );
}
