/**
 * Page publique landing-ville × verticale (Sprint v7 Phase 5 commit 2).
 *
 * Route : `/[locale]/implantations/[region]/[ville]/[verticale]`
 * Verticales acceptées : `interventions` | `audits` | `implementations` | `un-a-un` | `sites-web-ia`
 *
 * ⚠️ Edge case E5 anti-saturation build GH Actions (10 750 routes = 2150 villes × 5
 * verticales) : `generateStaticParams` retourne uniquement les ~100 villes pilotes
 * (top par population + villes avec copy éditorial). `dynamicParams = true`
 * permet la génération ISR-on-demand pour les ~10 250 routes restantes au
 * premier hit utilisateur. `revalidate = 86400` (24h) puis re-fetch.
 *
 * Fetch Article via `getLandingVilleArticleByVertical(villeSlug, verticale, locale)`.
 * Si Article absent (pas encore généré par worker) : stub minimal `noindex`
 * conforme HCU 2024 (anti-doorway) + lien de retour vers le hub ville parent.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowUpRight, MapPin } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { getRegion } from "@/content/regions";
import { VILLES, getVille } from "@/content/villes";
import {
  buildProductMetadata,
  buildBreadcrumbJsonLd,
  buildServiceJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { LANDING_VILLE_VERTICAL_SLUGS } from "@/server/content-gen/generators/landing-ville-shared";
import type { LandingVilleVerticalSlug } from "@/server/content-gen/generators/landing-ville-shared";
import { getLandingVilleArticleByVertical } from "@/server/content-gen/landing-ville/get-article-by-vertical";

interface Props {
  params: Promise<{ locale: string; region: string; ville: string; verticale: string }>;
}

// Edge case E5 — top ~100 villes pilotes par population.
// Empêche le build GH Actions de saturer à 10 750 routes SSG (cf. ADR 0026).
// Les villes restantes (2050+) sont rendues en ISR-on-demand via dynamicParams=true.
const VERTICAL_SLUGS_FOR_STATIC = LANDING_VILLE_VERTICAL_SLUGS;

export function generateStaticParams(): Array<{
  region: string;
  ville: string;
  verticale: string;
}> {
  const top100 = [...VILLES].sort((a, b) => b.population - a.population).slice(0, 100);
  return top100.flatMap((v) =>
    VERTICAL_SLUGS_FOR_STATIC.map((vertical) => ({
      region: v.region,
      ville: v.slug,
      verticale: vertical,
    })),
  );
}

// ISR : revalidate quotidien + dynamicParams autorise les 10 250 routes
// restantes en lazy ISR.
export const revalidate = 86400;
export const dynamicParams = true;

const VERTICAL_LABEL_FR: Record<LandingVilleVerticalSlug, string> = {
  interventions: "Interventions terrain",
  audits: "Audit IA d'optimisation",
  implementations: "Implémentation IA",
  "un-a-un": "Accompagnement 1-to-1",
  "sites-web-ia": "Sites web & digital IA",
};

const VERTICAL_CTA_HREF: Record<LandingVilleVerticalSlug, string> = {
  interventions: "/interventions/essentielle",
  audits: "/audit",
  implementations: "/implementation",
  "un-a-un": "/1-to-1",
  "sites-web-ia": "/codage-developpement",
};

function isValidVertical(value: string): value is LandingVilleVerticalSlug {
  return (LANDING_VILLE_VERTICAL_SLUGS as ReadonlyArray<string>).includes(value);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, region: regionSlug, ville: villeSlug, verticale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  if (!isValidVertical(verticale)) return {};
  const ville = getVille(villeSlug);
  if (!ville || ville.region !== regionSlug) return {};
  const region = getRegion(regionSlug);
  if (!region) return {};
  const isFr = locale === "fr";

  const article = await getLandingVilleArticleByVertical(ville.slug, verticale, locale as Locale);

  const verticalLabel = VERTICAL_LABEL_FR[verticale];
  const title = article?.metaTitle
    ? article.metaTitle
    : isFr
      ? `${verticalLabel} à ${ville.nameFr} · Axion-IA`
      : `${verticalLabel} in ${ville.nameFr} · Axion-IA`;
  const description = article?.metaDescription
    ? article.metaDescription
    : isFr
      ? `Axion-IA propose ${verticalLabel.toLowerCase()} à ${ville.nameFr} (${region.nameFr}). Tarifs publics, intervention rapide, ROI chiffré.`
      : `Axion-IA delivers ${verticalLabel.toLowerCase()} in ${ville.nameFr} (${region.nameFr}). Public pricing, fast intervention, costed ROI.`;

  const meta = buildProductMetadata({
    locale,
    path: `/implantations/${region.slug}/${ville.slug}/${verticale}`,
    title,
    description,
  });

  // Anti-doorway HCU 2024 — si pas d'Article DB OU si l'Article est tier_3,
  // forcer noindex pour ne pas polluer le crawl avec du stub vide.
  const shouldNoindex = !article || article.indexationTier === "tier_3_noindex_nofollow";
  if (shouldNoindex) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

export default async function VilleVerticalePage({ params }: Props) {
  const { locale, region: regionSlug, ville: villeSlug, verticale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!isValidVertical(verticale)) notFound();
  const ville = getVille(villeSlug);
  if (!ville || ville.region !== regionSlug) notFound();
  const region = getRegion(regionSlug);
  if (!region) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const verticalLabel = VERTICAL_LABEL_FR[verticale];
  const ctaHref = VERTICAL_CTA_HREF[verticale];

  const breadcrumbItems = [
    { href: "/implantations", label: isFr ? "Implantations" : "Locations" },
    { href: `/implantations/${region.slug}`, label: region.nameFr },
    { href: `/implantations/${region.slug}/${ville.slug}`, label: ville.nameFr },
    {
      href: `/implantations/${region.slug}/${ville.slug}/${verticale}`,
      label: verticalLabel,
    },
  ];

  const article = await getLandingVilleArticleByVertical(ville.slug, verticale, loc);

  const path = `/implantations/${region.slug}/${ville.slug}/${verticale}` as `/${string}`;
  const url = `${SITE_URL}/${loc}${path}`;

  // ─── Stub minimal noindex si Article absent ───────────────────────────────
  if (!article) {
    return (
      <Section
        eyebrow={isFr ? `Implantations · ${region.nameFr}` : `Locations · ${region.nameFr}`}
        title={isFr ? `${verticalLabel} à` : `${verticalLabel} in`}
        titleEm={ville.nameFr}
        description={
          isFr
            ? `La page locale détaillée pour ${verticalLabel.toLowerCase()} à ${ville.nameFr} est en cours de génération. En attendant, retrouvez tous nos services via la page ville.`
            : `The detailed local page for ${verticalLabel.toLowerCase()} in ${ville.nameFr} is being generated. Meanwhile, find all our services via the city page.`
        }
        titleAs="h1"
      >
        <div className="mb-8">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Cta
            href={`/implantations/${region.slug}/${ville.slug}` as never}
            variant="primary"
            size="lg"
            shape="pill"
            track="ville_vertical_stub_back_ville"
          >
            {isFr
              ? `Voir tous les services à ${ville.nameFr}`
              : `See all services in ${ville.nameFr}`}
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </Cta>
          <Cta
            href={ctaHref as never}
            variant="ghost"
            size="lg"
            shape="pill"
            track="ville_vertical_stub_cta_global"
          >
            {isFr ? `Découvrir ${verticalLabel}` : `Discover ${verticalLabel}`}
          </Cta>
        </div>
        <AiContentDisclaimer locale={loc} className="mt-8" />
      </Section>
    );
  }

  // ─── Article publié : rendu complet ──────────────────────────────────────
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path,
    name: isFr
      ? `${verticalLabel} à ${ville.nameFr} · Axion-IA`
      : `${verticalLabel} in ${ville.nameFr} · Axion-IA`,
    description: article.directAnswer ?? article.excerpt ?? article.title,
    serviceType: isFr
      ? `Cabinet IA opérationnel · ${verticalLabel}`
      : `Operational AI · ${verticalLabel}`,
    areasServed: [
      { type: "City", name: ville.nameFr, url },
      {
        type: "AdministrativeArea",
        name: region.nameFr,
        url: `${SITE_URL}/${loc}/implantations/${region.slug}`,
      },
      { type: "Country", name: "France" },
    ],
  });

  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Implantations" : "Locations", href: "/implantations" },
      { name: region.nameFr, href: `/implantations/${region.slug}` },
      { name: ville.nameFr, href: `/implantations/${region.slug}/${ville.slug}` },
      { name: verticalLabel, href: path },
    ],
  });

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: article.metaTitle ?? article.title,
    description: (article.metaDescription ?? article.directAnswer ?? "").slice(0, 300),
    inLanguage: loc,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    breadcrumb: { "@id": `${url}#breadcrumb` },
    datePublished: article.publishedAt?.toISOString(),
  } as const;

  return (
    <>
      <section className="bg-halo-warm relative overflow-hidden pt-12 pb-16 sm:pt-14 sm:pb-20 lg:pt-20 lg:pb-24">
        <Container>
          <div className="mb-8">
            <Breadcrumbs items={breadcrumbItems} emitJsonLd={false} />
          </div>
          <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? `${verticalLabel} · ${region.nameFr}` : `${verticalLabel} · ${region.nameFr}`}
          </p>
          <h1 className="display-editorial text-fg max-w-4xl">{article.title}</h1>
          {article.directAnswer ? (
            <p className="text-fg-soft mt-6 max-w-3xl text-lg leading-relaxed sm:text-xl">
              {article.directAnswer}
            </p>
          ) : null}
          <div className="text-fg-muted mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {ville.nameFr} · {region.nameFr}
            </span>
            {article.readingTime != null ? (
              <span>
                {isFr ? `${article.readingTime} min de lecture` : `${article.readingTime} min read`}
              </span>
            ) : null}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Cta
              href={ctaHref as never}
              variant="primary"
              size="lg"
              shape="pill"
              track="ville_vertical_cta_primary"
            >
              {isFr ? `Démarrer · ${verticalLabel}` : `Get started · ${verticalLabel}`}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta
              href={`/implantations/${region.slug}/${ville.slug}` as never}
              variant="ghost"
              size="lg"
              shape="pill"
              track="ville_vertical_cta_back_ville"
            >
              {isFr ? `Tous services à ${ville.nameFr}` : `All services in ${ville.nameFr}`}
            </Cta>
          </div>
        </Container>
      </section>

      <Section tone="paper">
        <article
          className="prose prose-lg text-fg-soft max-w-3xl"
          // Le body HTML est déjà sanitisé côté generator (sanitizeContentGenHtml).
          // Pas de re-sanitization runtime ici — défensif + perf.
          dangerouslySetInnerHTML={{ __html: article.body }}
        />
      </Section>

      <AiContentDisclaimer locale={loc} />

      <JsonLdGraph
        schemas={[serviceJsonLd, breadcrumbJsonLd, webPageJsonLd]}
        strategy="afterInteractive"
        scriptId={`jsonld-ville-vertical-${ville.slug}-${verticale}`}
      />
    </>
  );
}
