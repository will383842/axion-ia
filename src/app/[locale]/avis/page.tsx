/**
 * Hub /avis — Avis clients Axion-IA (CollectionPage indexable).
 *
 * Full server component, 0 JS (filtres via searchParams). ISR 1h. Toutes les
 * données filtrent `status = "published"` (barrière de modération).
 *
 * JSON-LD : CollectionPage + ItemList + Organization/AggregateRating (gaté ≥5) +
 * FAQPage (FaqAccordion) + BreadcrumbList (Breadcrumbs). Speakable via AnswerCard.
 *
 * SEO faceted-nav : les combinaisons de filtres (?note=&service=…) sont
 * canonicalisées vers /avis propre + noindex (évite le crawl trap). Les facettes
 * curées (/avis/ville|secteur|service|departement) restent indexables.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { PenLine, BadgeCheck, Scale, ShieldCheck } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import {
  buildProductMetadata,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
  SITE_EDITORIAL_DATE,
  SITE_URL,
} from "@/lib/seo";
import {
  getPublishedReviews,
  getAggregateRating,
  getServiceFacets,
  getSectorFacets,
  getCityFacets,
  getDepartmentFacets,
  type ReviewFilters,
} from "@/server/reviews/queries";
import { orgAggregateJsonLd } from "@/server/reviews/jsonld";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { ReviewFilters as ReviewFiltersBar } from "@/components/reviews/ReviewFilters";
import { RatingBreakdown } from "@/components/reviews/RatingBreakdown";
import { REVIEWS_PAGE_SIZE, FACET_MIN_COUNT } from "@/lib/reviews/config";
import { isServiceLine, serviceLineLabel } from "@/lib/reviews/service-lines";
import { isClientSectorSlug, clientSectorLabel } from "@/content/sectors";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export const revalidate = 3600;

const FAQ_ITEMS = [
  {
    id: "verification",
    question: "Les avis clients Axion-IA sont-ils vérifiés ?",
    answer:
      "Oui. Chaque avis est déposé via un formulaire, puis contrôlé manuellement par notre équipe (authenticité, cohérence) avant toute publication. Les avis authentifiés portent un badge « Vérifié ».",
  },
  {
    id: "negatifs",
    question: "Publiez-vous aussi les avis négatifs ?",
    answer:
      "Oui. Nous publions les avis positifs comme négatifs. La modération sert à écarter les faux avis ou contenus illégaux, jamais à masquer une note basse — conformément à la réglementation (directive Omnibus, DGCCRF).",
  },
  {
    id: "note-globale",
    question: "Comment est calculée la note globale ?",
    answer:
      "La note globale est la moyenne des notes de tous les avis publiés, sur une échelle de 1 à 5. Elle n'est affichée en donnée structurée qu'à partir de 5 avis vérifiés.",
  },
  {
    id: "deposer",
    question: "Comment laisser un avis sur Axion-IA ?",
    answer:
      "Rendez-vous sur la page « Déposer un avis », attribuez une note, décrivez votre expérience (contexte, résultats) et validez. Votre avis sera publié après vérification.",
  },
];

function toFilters(sp: Record<string, string | undefined>): {
  filters: ReviewFilters;
  hasActiveFilter: boolean;
} {
  const filters: ReviewFilters = { pageSize: REVIEWS_PAGE_SIZE };
  let active = false;
  if (sp.note && /^[1-5]$/.test(sp.note)) {
    filters.rating = parseInt(sp.note, 10);
    active = true;
  }
  if (sp.service && isServiceLine(sp.service)) {
    filters.serviceLine = sp.service;
    active = true;
  }
  if (sp.secteur && isClientSectorSlug(sp.secteur)) {
    filters.clientSector = sp.secteur;
    active = true;
  }
  if (sp.q && sp.q.trim()) {
    filters.search = sp.q.trim();
    active = true;
  }
  if (sp.tri === "rating_desc" || sp.tri === "rating_asc" || sp.tri === "featured") {
    filters.sort = sp.tri;
    active = true;
  } else {
    filters.sort = "recent";
  }
  filters.page = sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;
  if (filters.page > 1) active = true;
  return { filters, hasActiveFilter: active };
}

function prettifyCity(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const sp = await searchParams;
  const { hasActiveFilter } = toFilters(sp);
  const meta = buildProductMetadata({
    locale,
    path: "/avis",
    title: "Avis clients Axion-IA · Retours d'expérience vérifiés",
    description:
      "Découvrez les avis clients vérifiés d'Axion-IA : retours d'expérience réels sur nos audits, formations, implémentations et accompagnements IA, partout en France.",
    alternates: { fr: "/avis", en: "/avis" },
  });
  // Faceted-nav : les combinaisons de filtres sont noindex + canonical vers /avis.
  if (hasActiveFilter) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

export default async function AvisHubPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const sp = await searchParams;
  const { filters } = toFilters(sp);

  const [reviews, agg, serviceFacets, sectorFacets, cityFacets, deptFacets] = await Promise.all([
    getPublishedReviews(filters),
    getAggregateRating(),
    getServiceFacets(),
    getSectorFacets(),
    getCityFacets(),
    getDepartmentFacets(),
  ]);

  const totalPages = Math.max(1, Math.ceil(reviews.total / reviews.pageSize));
  const orgAgg = orgAggregateJsonLd(agg);

  const collectionJsonLd = buildCollectionPageJsonLd({
    locale,
    path: "/avis",
    name: "Avis clients Axion-IA",
    description:
      "Retours d'expérience clients vérifiés sur les services IA d'Axion-IA (audit, formation, implémentation, accompagnement, sites web augmentés).",
    dateModified: SITE_EDITORIAL_DATE,
  });

  const itemListJsonLd =
    reviews.items.length > 0
      ? buildItemListJsonLd({
          locale,
          path: "/avis",
          name: "Avis clients Axion-IA",
          items: reviews.items.map((r, i) => ({
            position: i + 1,
            name: r.title ?? `Avis de ${r.authorFirstName} ${r.authorLastInitial}`,
            url: `${SITE_URL}/${locale}/avis/${r.slug}`,
          })),
        })
      : null;

  const topServices = serviceFacets.filter(
    (f) => f.count >= FACET_MIN_COUNT && isServiceLine(f.key),
  );
  const topSectors = sectorFacets.filter(
    (f) => f.count >= FACET_MIN_COUNT && isClientSectorSlug(f.key),
  );
  const topCities = cityFacets.filter((f) => f.count >= FACET_MIN_COUNT).slice(0, 24);
  const topDepts = deptFacets.filter((f) => f.count >= FACET_MIN_COUNT).slice(0, 24);

  // Préserve les filtres actifs pour la pagination (forme objet typée next-intl).
  const baseQuery: Record<string, string> = {};
  for (const k of ["note", "service", "secteur", "tri", "q"]) {
    if (sp[k]) baseQuery[k] = sp[k]!;
  }
  const pageHref = (p: number) => ({
    pathname: "/avis" as const,
    query: p > 1 ? { ...baseQuery, page: String(p) } : baseQuery,
  });

  return (
    <>
      <JsonLd data={collectionJsonLd} />
      {orgAgg ? <JsonLd data={orgAgg} /> : null}
      {itemListJsonLd ? <JsonLd data={itemListJsonLd} /> : null}

      {/* 1. Hero + réponse directe (AEO) */}
      <Section
        eyebrow="Avis clients"
        title="Avis clients"
        titleEm="Axion-IA"
        titleAs="h1"
        tone="halo-warm"
        description="Des retours d'expérience réels et vérifiés sur nos interventions IA — audits, formations, implémentations et accompagnements, partout en France."
      >
        <Breadcrumbs items={[{ href: "/avis", label: "Avis clients" }]} />
        <div className="mt-6 max-w-2xl">
          <AnswerCard question="Axion-IA a-t-il de bons avis clients ?">
            {agg
              ? `Axion-IA affiche une note moyenne de ${agg.ratingValue.toLocaleString("fr-FR", { minimumFractionDigits: 1 })}/5 sur ${agg.reviewCount} avis clients vérifiés. Chaque avis est contrôlé manuellement avant publication ; les avis positifs comme négatifs sont publiés.`
              : "Axion-IA publie les avis de ses clients après vérification manuelle de leur authenticité. Les avis positifs comme négatifs sont publiés, conformément à la réglementation."}
          </AnswerCard>
        </div>
        <div className="mt-6">
          <Cta href="/avis/deposer" variant="primary">
            <PenLine aria-hidden="true" className="h-4 w-4" />
            Déposer un avis
          </Cta>
        </div>
      </Section>

      {/* 2. Barre de confiance / méthodologie */}
      <Section tone="paper">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: BadgeCheck,
              t: "Avis 100 % vérifiés",
              d: "Chaque avis est contrôlé manuellement (authenticité, cohérence) avant publication.",
            },
            {
              icon: Scale,
              t: "Positifs ET négatifs",
              d: "Nous publions tous les avis authentiques. La modération n'écarte que les faux avis ou contenus illégaux.",
            },
            {
              icon: ShieldCheck,
              t: "Conforme & RGPD",
              d: "Directive Omnibus / DGCCRF. Seuls le prénom, l'initiale et les données consenties sont affichés.",
            },
          ].map((x) => (
            <div
              key={x.t}
              className="border-border-strong bg-paper hover:border-terracotta/50 rounded-2xl border p-6 shadow-sm transition-colors"
            >
              <span className="bg-terracotta-soft text-terracotta-deep mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl">
                <x.icon aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
              </span>
              <p className="text-fg font-serif text-lg font-semibold">{x.t}</p>
              <p className="text-fg-soft mt-1.5 text-sm leading-relaxed">{x.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 3. Synthèse des notes */}
      {agg ? (
        <Section tone="sand">
          <RatingBreakdown agg={agg} />
        </Section>
      ) : null}

      {/* 4. Filtres + 5. Grille */}
      <Section tone="canvas" title="Tous les" titleEm="avis">
        <ReviewFiltersBar
          values={{ note: sp.note, service: sp.service, secteur: sp.secteur, tri: sp.tri, q: sp.q }}
          resetHref="/avis"
        />
        <p className="text-fg-muted mt-4 text-sm" aria-live="polite">
          {reviews.total} avis
        </p>
        {reviews.items.length === 0 ? (
          <div className="border-border mt-6 rounded-2xl border border-dashed p-10 text-center">
            <p className="text-fg-soft">
              Aucun avis ne correspond {reviews.total === 0 ? "encore" : "à ces critères"}.{" "}
              <Link href="/avis/deposer" className="text-primary underline">
                Soyez le premier à laisser un avis
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <ul className="mt-6 grid list-none gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
              {reviews.items.map((r) => (
                <li key={r.id}>
                  <ReviewCard review={r} />
                </li>
              ))}
            </ul>
            {totalPages > 1 ? (
              <nav
                className="mt-8 flex items-center justify-center gap-4"
                aria-label="Pagination des avis"
              >
                {reviews.page > 1 ? (
                  <Link href={pageHref(reviews.page - 1)} className="text-primary underline">
                    ← Précédent
                  </Link>
                ) : null}
                <span className="text-fg-muted text-sm">
                  Page {reviews.page} / {totalPages}
                </span>
                {reviews.page < totalPages ? (
                  <Link href={pageHref(reviews.page + 1)} className="text-primary underline">
                    Suivant →
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </Section>

      {/* 7. Avis par service */}
      {topServices.length > 0 ? (
        <Section tone="paper" eyebrow="Par service" title="Avis par" titleEm="service">
          <ul className="grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
            {topServices.map((f) => (
              <li key={f.key}>
                <Link
                  href={{ pathname: "/avis/service/[service]", params: { service: f.key } }}
                  className="border-border hover:border-terracotta flex items-center justify-between rounded-xl border p-4"
                >
                  <span>{serviceLineLabel(f.key)}</span>
                  <span className="text-fg-muted text-sm">{f.count} avis →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* 8. Couverture géo — toute la France */}
      {topCities.length > 0 || topDepts.length > 0 ? (
        <Section tone="sand" eyebrow="Partout en France" title="Avis clients par" titleEm="ville">
          {topCities.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {topCities.map((f) => (
                <li key={f.key}>
                  <Link
                    href={{ pathname: "/avis/ville/[ville]", params: { ville: f.key } }}
                    className="border-border bg-paper hover:border-terracotta inline-block rounded-full border px-3 py-1.5 text-sm"
                  >
                    {prettifyCity(f.key)} <span className="text-fg-muted">({f.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {topDepts.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {topDepts.map((f) => (
                <li key={f.key}>
                  <Link
                    href={{ pathname: "/avis/departement/[code]", params: { code: f.key } }}
                    className="border-border bg-paper hover:border-terracotta inline-block rounded-full border px-3 py-1.5 text-xs"
                  >
                    Dép. {f.key} <span className="text-fg-muted">({f.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      {/* 9. Secteurs */}
      {topSectors.length > 0 ? (
        <Section tone="paper" eyebrow="Par secteur" title="Avis par" titleEm="secteur d'activité">
          <ul className="grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
            {topSectors.map((f) => (
              <li key={f.key}>
                <Link
                  href={{ pathname: "/avis/secteur/[secteur]", params: { secteur: f.key } }}
                  className="border-border hover:border-terracotta flex items-center justify-between rounded-xl border p-4"
                >
                  <span>{clientSectorLabel(f.key)}</span>
                  <span className="text-fg-muted text-sm">{f.count} avis →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* 10. FAQ */}
      <Section tone="canvas" eyebrow="FAQ" title="Vos questions sur les" titleEm="avis">
        <FaqAccordion items={FAQ_ITEMS} />
      </Section>

      {/* 12. CTA final */}
      <CtaBlock
        title="Vous êtes client ?"
        titleEm="Partagez votre avis"
        description="Votre retour aide d'autres dirigeants à se décider — et nous aide à progresser."
        tone="mocha"
        cta={
          <Cta href="/avis/deposer" variant="primary">
            Déposer un avis
          </Cta>
        }
      />
    </>
  );
}
