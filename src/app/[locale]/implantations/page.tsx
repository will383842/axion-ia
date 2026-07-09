import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, MapPin, Users } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { fmtPopulation } from "@/lib/intl";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Illustration } from "@/components/visual/Illustration";
import { Link } from "@/i18n/navigation";
import { ClientLogosBand } from "@/components/sections/ClientLogosBand";
import { CtaBlock } from "@/components/sections/CtaBlock";

import { REGIONS, getIndexableRegions, getTopRegionsByPib } from "@/content/regions";
import { getIndexableVilles, VILLES } from "@/content/villes";
import {
  buildProductMetadata,
  buildItemListJsonLd,
  buildServiceJsonLd,
  buildWebPageJsonLd,
  SITE_URL,
} from "@/lib/seo";
import {
  AUDIT_TIERS,
  INTERVENTION_TIERS,
  IMPLEMENTATION_TIERS,
  getTierById,
  getEntryPriceEur,
  formatAmount,
} from "@/content/pricing";
import { buildServiceAreasServed } from "@/lib/service-coverage";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: "/implantations",
    title: isFr
      ? "Implantations · Architectes IA seniors partout en France et francophonie · Axion-IA"
      : "Implantations · Architectes IA seniors partout en France et francophonie · Axion-IA",
    description: isFr
      ? "Axion-IA intervient dans les 13 régions de France métropolitaine, les 5 DROM et auprès des entreprises francophones à l'étranger. De la TPE à l'ETI. 5 services : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS."
      : "Axion-IA intervient dans les 13 régions de France métropolitaine, les 5 DROM et auprès des entreprises francophones à l'étranger. De la TPE à l'ETI. 5 services : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS.",
    alternates: { fr: "/implantations", en: "/locations" },
  });
}

// ISR — le hub dérive des cohortes de villes indexables (dépend de la config) +
// le layout partagé (bandeau + JSON-LD Qualiopi). 24h : repeuple au runtime sans
// rebuild (sinon stratégie GEO figée au build stub).
export const revalidate = 86400;

export default async function ImplantationsHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const indexableRegions = getIndexableRegions();
  const indexableVilles = getIndexableVilles();
  const topRegions = getTopRegionsByPib(6);
  const totalVilles = VILLES.length;

  const breadcrumbItems = [{ href: "/implantations", label: isFr ? "Implantations" : "Locations" }];

  // P0 audit Perfection 2026 — Organization + Service France-level (E1).
  // Hub national manquait d'un signal GEO explicite « areaServed: France ».
  const organizationFranceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Axion-IA",
    url: SITE_URL,
    areaServed: {
      "@type": "Country",
      name: isFr ? "France" : "France",
      sameAs: "https://www.wikidata.org/wiki/Q142",
    },
    description: isFr
      ? "Architectes IA seniors — interventions sur site dans les 13 régions de France métropolitaine, les 5 DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte) et auprès des entreprises francophones à l'étranger. TPE, PME, ETI et grands comptes."
      : "Architectes IA seniors — interventions sur site dans les 13 régions de France métropolitaine, les 5 DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte) et auprès des entreprises francophones à l'étranger. TPE, PME, ETI et grands comptes.",
  };
  const serviceNationalJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/implantations",
    name: isFr
      ? "Architectes IA seniors partout en France et francophonie · 5 services"
      : "Architectes IA seniors partout en France et francophonie · 5 services",
    description: isFr
      ? "Axion-IA intervient dans les 13 régions de France métropolitaine, les 5 DROM et auprès des entreprises francophones à l'étranger (Belgique, Suisse, Luxembourg, Monaco, Maghreb, Afrique francophone, Québec). De la TPE à l'ETI. 5 services : audit IA, formation, implémentation, coaching 1-to-1 dirigeants, plateformes web/SaaS IA."
      : "Axion-IA intervient dans les 13 régions de France métropolitaine, les 5 DROM et auprès des entreprises francophones à l'étranger (Belgique, Suisse, Luxembourg, Monaco, Maghreb, Afrique francophone, Québec). De la TPE à l'ETI. 5 services : audit IA, formation, implémentation, coaching 1-to-1 dirigeants, plateformes web/SaaS IA.",
    serviceType: isFr ? "Services IA opérationnels" : "Services IA opérationnels",
    areasServed: buildServiceAreasServed(loc),
  });

  // ImageObject JSON-LD — Hero image carte France architectes (Will 2026-05-26
  // perfection 2026). Signal Google Images + AI engines pour indexation visuelle.
  const heroImageJsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    "@id": `${SITE_URL}/${loc}/implantations#hero-image`,
    contentUrl: `${SITE_URL}/images/axion-ia-implantations-france-hero-architectes.png`,
    url: `${SITE_URL}/images/axion-ia-implantations-france-hero-architectes.png`,
    name: "Axion-IA · experts IA seniors partout en France",
    description:
      "Carte de France stylisée du réseau Axion-IA — experts IA seniors, 13 régions métropolitaines, 5 DROM et entreprises francophones à l'étranger, 5 services sur site.",
    encodingFormat: "image/png",
    creator: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Axion-IA" },
    copyrightHolder: { "@type": "Organization", name: "Axion-IA" },
    license: "https://creativecommons.org/licenses/by/4.0/",
    acquireLicensePage: `${SITE_URL}/${loc}/galerie`,
    contentLocation: { "@type": "Country", name: "France" },
  } as const;

  // ItemList JSON-LD — 5 services canoniques Axion-IA (Will 2026-05-26
  // perfection 2026). Internal linking sémantique : hub → 5 pages services
  // canoniques (audit, interventions, un-a-un, implementation, sites-web).
  // Signal AEO/GEO fort : AI engines énumèrent les 5 services quand un
  // visiteur demande « que propose Axion-IA ? ».
  const servicesItemList = buildItemListJsonLd({
    locale: loc,
    path: "/implantations",
    name: isFr ? "5 services Axion-IA" : "5 services Axion-IA",
    items: [
      {
        position: 1,
        name: isFr ? "Audit IA" : "Audit IA",
        url: `${SITE_URL}/${loc}/audit`,
        description: `Diagnostic IA chiffré, 4 niveaux (Flash ${formatAmount(
          getTierById(AUDIT_TIERS, "audit-flash").priceFlat!,
          loc,
          { compact: true },
        )} → Stratégique ETI dès ${formatAmount(
          getTierById(AUDIT_TIERS, "audit-strategique-eti").priceMin!,
          loc,
          { compact: true },
        )}), plan d'action priorisé.`,
      },
      {
        position: 2,
        name: isFr ? "Formation IA en entreprise" : "Formation IA en entreprise",
        url: `${SITE_URL}/${loc}/interventions`,
        description: `Ateliers et interventions sur site, dès ${formatAmount(
          getEntryPriceEur(INTERVENTION_TIERS)!,
          loc,
          { compact: true },
        )}, groupes 1-30 personnes, sur vos vraies données.`,
      },
      {
        position: 3,
        name: isFr ? "Coaching 1-to-1 dirigeants" : "Coaching 1-to-1 dirigeants",
        url: `${SITE_URL}/${loc}/un-a-un`,
        description: `Journée 1-to-1 avec un dirigeant, ${formatAmount(
          getTierById(INTERVENTION_TIERS, "intervention-dirigeants").priceFlat!,
          loc,
          { compact: true },
        )}, structurer l'entreprise et chiffrer les gains IA.`,
      },
      {
        position: 4,
        name: isFr ? "Implémentation IA" : "Implémentation IA",
        url: `${SITE_URL}/${loc}/implementation`,
        description: `Pilote IA dès ${formatAmount(
          getTierById(IMPLEMENTATION_TIERS, "impl-poc").priceMin!,
          loc,
          { compact: true },
        )}, chatbot RAG, agents IA, automatisations, IA custom d'entreprise.`,
      },
      {
        position: 5,
        name: isFr
          ? "Plateformes web et SaaS IA sur mesure"
          : "Plateformes web et SaaS IA sur mesure",
        url: `${SITE_URL}/${loc}/sites-web-augmentes`,
        description: isFr
          ? "Sites web et SaaS IA-native sur devis, RGPD Europe, performances Web Vitals 2026 strictes."
          : "Sites web et SaaS IA-native sur devis, RGPD Europe, performances Web Vitals 2026 strictes.",
      },
    ],
  });

  // SpeakableSpecification — signal voice search + AI engines (Perplexity,
  // ChatGPT, Claude.ai, Google AI Overviews) qui ciblent H1 + sous-ligne hero.
  const speakableJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: "/implantations",
    name: isFr
      ? "Implantations · Architectes IA seniors partout en France et francophonie · Axion-IA"
      : "Implantations · Architectes IA seniors partout en France et francophonie · Axion-IA",
    speakable: { selectors: ["[data-speakable-hero]", "#implantations-hero-heading"] },
  });

  // ItemList JSON-LD régions — signal AEO/GEO : LLMs énumèrent les 12 régions
  // couvertes quand un utilisateur demande « où intervient Axion-IA ? ».
  const regionsItemList = buildItemListJsonLd({
    locale: loc,
    path: "/implantations",
    name: isFr ? "Régions couvertes par Axion-IA" : "Regions covered by Axion-IA",
    items: indexableRegions.map((region, idx) => ({
      position: idx + 1,
      name: region.nameFr,
      url: `${SITE_URL}/${loc}/${isFr ? "implantations" : "locations"}/${region.slug}`,
      description: isFr ? region.pitchFr : region.pitchEn,
    })),
  });

  // BreadcrumbList JSON-LD : émis automatiquement par <Breadcrumbs items={…} />
  // (cf. src/components/nav/Breadcrumbs.tsx) — pas de double émission ici.

  return (
    <>
      <JsonLd
        data={organizationFranceJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-implantations-org"
      />
      <JsonLd
        data={serviceNationalJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-implantations-service"
      />
      <JsonLd data={regionsItemList} />
      <JsonLd
        data={servicesItemList}
        strategy="afterInteractive"
        scriptId="jsonld-implantations-services"
      />
      <JsonLd
        data={heroImageJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-implantations-image"
      />
      <JsonLd
        data={speakableJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-implantations-speakable"
      />

      {/* Hero — refonte 2-col (Will 2026-05-26) : image globe + copy équilibrés.
          H1 hook qualité « Cabinet d'experts IA chez vous ? », sous-ligne
          énumérant la couverture nationale + 5 services. Image hero uploadée
          par Will (carte France style architectes). */}
      <section
        aria-labelledby="implantations-hero-heading"
        className="bg-bg relative overflow-hidden py-16 sm:py-20 lg:py-24"
      >
        <Container className="relative">
          <div className="mb-8">
            <Breadcrumbs items={breadcrumbItems} />
          </div>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            {/* Colonne gauche — copy */}
            <div className="max-w-2xl">
              <p className="text-fg-muted mb-6 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Implantations · France entière" : "Locations · All of France"}
              </p>
              <h1
                id="implantations-hero-heading"
                className="display-editorial text-fg"
                data-speakable-hero
              >
                {isFr ? "Cabinet d'" : "Senior "}
                <em className="italic-editorial text-terracotta not-italic">
                  <span className="italic" style={{ fontFamily: "var(--font-serif)" }}>
                    {isFr ? "experts IA" : "AI experts"}
                  </span>
                </em>
                {isFr ? " chez vous ?" : " near you?"}
              </h1>
              <p
                className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl"
                data-speakable-hero
              >
                {isFr
                  ? "Axion-IA intervient dans les 13 régions métropolitaines, les 5 DROM et auprès des entreprises francophones à l'étranger — "
                  : "Axion-IA intervient dans les 13 régions métropolitaines, les 5 DROM et auprès des entreprises francophones à l'étranger — "}
                <span className="text-fg font-semibold">
                  {isFr ? "de la TPE à l'ETI" : "de la TPE à l'ETI"}
                </span>
                {isFr
                  ? ", pour toutes nos prestations : audit IA, formation, implémentation, coaching 1-to-1 dirigeants, plateformes web et SaaS IA."
                  : ", pour toutes nos prestations : audit IA, formation, implémentation, coaching 1-to-1 dirigeants, plateformes web et SaaS IA."}
              </p>
              <div className="text-fg-muted mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {indexableRegions.length} {isFr ? "régions couvertes" : "regions covered"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  {fmtPopulation(totalVilles, isFr ? "fr" : "en")}{" "}
                  {isFr ? "communes éligibles" : "eligible communes"}
                </span>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Cta href="/appel" variant="primary" size="lg" shape="pill" track="hub_cta_book">
                  {isFr ? "Réserver un appel" : "Book a call"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta href="/contact" variant="ghost" size="lg" shape="pill" track="hub_cta_contact">
                  {isFr ? "Nous contacter" : "Contact us"}
                </Cta>
              </div>
            </div>
            {/* Colonne droite — image hero carte France architectes (1:1, priority LCP) */}
            <div className="hidden lg:block">
              <Illustration
                slot="IMPLANTATIONS-01-hero"
                src="/images/axion-ia-implantations-france-hero-architectes.png"
                aspectRatio="1:1"
                filenameTarget="public/images/axion-ia-implantations-france-hero-architectes.png"
                alt={
                  isFr
                    ? "Carte de France stylisée illustrant le réseau d'experts IA seniors Axion-IA — couverture nationale 13 régions, toutes communes éligibles."
                    : "Stylized map of France showing the Axion-IA senior AI experts network — national coverage of 13 regions, all communes eligible."
                }
                caption={
                  isFr
                    ? "Architectes IA seniors · France entière"
                    : "Senior AI experts · All of France"
                }
                priority
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Bandeau logos clients — preuve sociale juste après le hero */}
      <ClientLogosBand isFr={isFr} />

      {/* Toutes les régions — PLACÉE EN PREMIER (Will 2026-05-26).
          Donne l'accès direct à toutes les régions sans hiérarchie cachée. */}
      <Section
        eyebrow={isFr ? "Couverture France + francophonie" : "Couverture France + francophonie"}
        title={isFr ? "13 régions, 5 DROM," : "13 régions, 5 DROM,"}
        titleEm={isFr ? "et francophonie internationale" : "et francophonie internationale"}
        description={
          isFr
            ? "France métropolitaine au complet (Corse comprise), 5 DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte) et entreprises francophones à l'étranger (Belgique, Suisse, Luxembourg, Monaco, Maghreb, Afrique francophone, Québec). Les pages dédiées listent les 13 régions métropolitaines ; pour DROM et international, contactez-nous."
            : "France métropolitaine au complet (Corse comprise), 5 DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte) et entreprises francophones à l'étranger (Belgique, Suisse, Luxembourg, Monaco, Maghreb, Afrique francophone, Québec). Les pages dédiées listent les 13 régions métropolitaines ; pour DROM et international, contactez-nous."
        }
      >
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {REGIONS.map((region) => {
            const isIndexable = !region.noindex;
            return (
              <li key={region.slug}>
                <Link
                  href={`/implantations/${region.slug}` as never}
                  data-source-region={region.slug}
                  className="group bg-paper border-border hover:border-terracotta hover:bg-halo-warm focus-visible:ring-terracotta shadow-subtle hover:shadow-card flex h-full items-start gap-3 rounded-xl border p-4 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className="bg-terracotta-soft text-terracotta-deep mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  >
                    <MapPin className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-fg group-hover:text-terracotta text-[15px] leading-tight font-semibold tracking-tight transition"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {region.nameFr}
                    </h3>
                    <p className="text-fg-muted mt-1 text-[11.5px] leading-snug">
                      {region.prefecture}
                      {typeof region.pibBillionsEur === "number"
                        ? ` · ${region.pibBillionsEur} Md€ PIB`
                        : ""}
                    </p>
                    <p className="text-fg-soft mt-1.5 text-[11px] leading-snug">
                      {region.departements.length}{" "}
                      {isFr
                        ? region.departements.length > 1
                          ? "départements"
                          : "département"
                        : region.departements.length > 1
                          ? "departments"
                          : "department"}{" "}
                      · {fmtPopulation(region.population, isFr ? "fr" : "en")}{" "}
                      {isFr ? "hab." : "inhab."}
                      {!isIndexable ? (isFr ? " · à venir" : " · coming soon") : ""}
                    </p>
                  </div>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="text-fg-muted group-hover:text-terracotta mt-1 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Bandeau orange contact — DÉPLACÉ entre « 13 régions » et « Top 6 »
          (Will 2026-05-26). Capte l'attention juste après le tableau régions. */}
      <section className="bg-terracotta py-16 sm:py-20">
        <Container>
          <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-14">
            <div>
              <h2
                className="text-paper text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr
                  ? "Votre projet IA mérite des architectes seniors."
                  : "Your AI project deserves senior architects."}
              </h2>
              <p className="text-paper/85 mt-3 text-base leading-relaxed sm:text-lg">
                {isFr
                  ? "Décrivez votre besoin en 2 minutes. Un appel où l'on prend le temps de tout cadrer à la perfection. Réponse sous 48h ouvrées, sans engagement."
                  : "Describe your need in 2 minutes. A call where we take the time to scope your project perfectly. Reply within 48 business hours, no commitment."}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/appel"
                  data-cta-tracking="hub_orange_banner_book"
                  className="bg-paper text-terracotta cta-lift focus-visible:ring-paper inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {isFr ? "Réserver un appel" : "Book a call"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/contact"
                  data-cta-tracking="hub_orange_banner_contact"
                  className="text-paper border-paper/40 hover:bg-paper/10 cta-lift focus-visible:ring-paper inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {isFr ? "Nous contacter" : "Contact us"}
                </Link>
              </div>
            </div>
            <div className="hidden md:block">
              <Illustration
                slot="IMPLANTATIONS-02-bandeau-contact"
                src="/images/axion-ia-implantations-bandeau-contact-architectes.png"
                aspectRatio="1:1"
                filenameTarget="public/images/axion-ia-implantations-bandeau-contact-architectes.png"
                alt={
                  isFr
                    ? "Illustration experts IA Axion-IA à votre service — équipe senior, conseil opérationnel, France entière."
                    : "Axion-IA AI experts at your service — senior team, operational consulting, all of France."
                }
                caption={isFr ? "Axion-IA · experts IA seniors" : "Axion-IA · senior AI experts"}
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Top régions par PIB — DÉPLACÉ APRÈS « Toutes les régions »
          (Will 2026-05-26) : contrevendeur pour les régions hors top 6.
          Renommé pour clarifier que c'est un classement, pas un filtre. */}
      <Section
        eyebrow={isFr ? "Classement par PIB" : "GDP ranking"}
        title={isFr ? "Top 6 par" : "Top 6 by"}
        titleEm={isFr ? "PIB régional Eurostat" : "Eurostat regional GDP"}
        description={
          isFr
            ? "Pôles d'intervention prioritaires en 2026. Chaque page détaille les villes proches, le tissu B2B local et nos cas concrets — le même standard premium s'applique aux 7 autres régions, accessibles depuis la liste ci-dessus."
            : "Priority engagement hubs for 2026. Each page details nearby cities, the local B2B fabric and our case studies — the same premium standard applies to the 7 other regions, accessible from the list above."
        }
        tone="paper"
      >
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {topRegions.map((region) => (
            <li key={region.slug}>
              <Link
                href={`/implantations/${region.slug}` as never}
                data-cta-tracking="hub_region_top"
                data-source-region={region.slug}
                className="group bg-paper hover:border-terracotta focus-visible:ring-terracotta border-border-strong/40 shadow-subtle hover:shadow-card block h-full rounded-2xl border-2 p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                      <span
                        aria-hidden="true"
                        className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                      />
                      {region.prefecture}
                      {typeof region.pibBillionsEur === "number"
                        ? ` · ${region.pibBillionsEur} Md€ PIB`
                        : ""}
                    </p>
                    <p
                      className="text-fg mt-3 text-2xl leading-tight font-semibold"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {region.nameFr}
                    </p>
                  </div>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="text-fg-muted group-hover:text-terracotta h-5 w-5 shrink-0 transition"
                  />
                </div>
                <p className="text-fg-soft mt-4 line-clamp-3 text-sm leading-relaxed">
                  {isFr ? region.pitchFr : region.pitchEn}
                </p>
                <div className="text-fg-muted mt-5 flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {fmtPopulation(region.population, isFr ? "fr" : "en")}{" "}
                    {isFr ? "hab." : "inhab."}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {region.departements.length} {isFr ? "départements" : "departments"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* Villes pilotes (V1 = Paris seul) */}
      {indexableVilles.length > 0 ? (
        <Section
          eyebrow={isFr ? "Villes pilotes" : "Pilot cities"}
          title={isFr ? "Pages villes" : "Cities with"}
          titleEm={isFr ? "gold standard" : "gold standard"}
          titleTail={isFr ? " 2026" : " content"}
          description={
            isFr
              ? "Premières pages ville livrées avec un contenu éditorial complet (FAQ géolocalisée, écosystème, cas clients proches)."
              : "First city pages delivered with full editorial content (geolocalized FAQ, ecosystem, nearby case studies)."
          }
          tone="sand"
        >
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {indexableVilles.map((ville) => (
              <li key={ville.slug}>
                <Link
                  href={`/implantations/${ville.region}/${ville.slug}` as never}
                  data-cta-tracking="hub_ville_pilot"
                  data-source-ville={ville.slug}
                  data-source-region={ville.region}
                  className="group bg-paper hover:border-terracotta focus-visible:ring-terracotta border-border-strong/40 shadow-subtle hover:shadow-card block rounded-2xl border-2 p-5 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                        {ville.departementLabel ?? ville.departement}
                      </p>
                      <p
                        className="text-fg mt-2 text-xl leading-tight font-semibold"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {ville.nameFr}
                      </p>
                    </div>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="text-fg-muted group-hover:text-terracotta h-5 w-5 shrink-0 transition"
                    />
                  </div>
                  {ville.copy ? (
                    <p className="text-fg-soft mt-3 line-clamp-2 text-[13px] leading-relaxed">
                      {isFr ? ville.copy.pitchFr : ville.copy.pitchEn}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* CTA final */}
      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Get started"}
        title={isFr ? "Vous démarrez où ?" : "Where do you start?"}
        titleEm={isFr ? "Parlons-en." : "Let's talk."}
        description={
          isFr
            ? "TPE, PME, ETI ou grande entreprise — partout en France, vous bénéficiez du même standard premium senior. Tarifs publics, calendrier temps réel, vos données restent chez vous."
            : "Micro-business, SMB, mid-market or large enterprise — everywhere in France, you get the same premium senior standard. Public pricing, real-time calendar, your data stays yours."
        }
        cta={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Cta href="/appel" variant="primary" size="lg" shape="pill" track="hub_cta_book_final">
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta
              href="/contact"
              variant="ghost"
              size="lg"
              shape="pill"
              track="hub_cta_contact_final"
            >
              {isFr ? "Nous contacter" : "Contact us"}
            </Cta>
          </div>
        }
      />

      {/* Sticky mobile CTA — apparaît au scroll > 600 px, masqué sur lg+. */}
      <StickyMobileCta
        href="/appel"
        label={isFr ? "Réserver un appel" : "Book a call"}
        track="hub-sticky-mobile"
        threshold={600}
      />
    </>
  );
}
