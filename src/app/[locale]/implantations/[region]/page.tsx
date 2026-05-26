import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Building2,
  Briefcase,
  Wrench,
  UserCog,
  Globe,
} from "lucide-react";

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
import { FounderTrustSection } from "@/components/sections/FounderTrustSection";

import { REGIONS, getRegion } from "@/content/regions";
import { getVillesByRegion } from "@/content/villes";
import {
  AUDIT_TIERS,
  INTERVENTION_TIERS,
  UN_A_UN_TIERS,
  IMPLEMENTATION_TIERS,
  formatAmount,
  getTierById,
  getEntryPriceEur,
} from "@/content/pricing";
import {
  buildProductMetadata,
  buildItemListJsonLd,
  buildLocalBusinessJsonLd,
  buildPlaceJsonLd,
  SITE_URL,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; region: string }>;
}

export function generateStaticParams(): Array<{ region: string }> {
  return REGIONS.map((r) => ({ region: r.slug }));
}

// P1-13 (audit re-run 2026-05-15) — ISR sur hub régions pSEO.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, region: regionSlug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const region = getRegion(regionSlug);
  if (!region) return {};
  const isFr = locale === "fr";
  const meta = buildProductMetadata({
    locale,
    path: `/implantations/${region.slug}`,
    title: isFr
      ? `${region.nameFr} · Architectes IA seniors`
      : `${region.nameFr} · Senior AI architects`,
    description: isFr ? region.pitchFr : region.pitchEn,
    alternates: {
      fr: `/implantations/${region.slug}`,
      en: `/locations/${region.slug}`,
    },
  });
  if (region.noindex) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

export default async function RegionPage({ params }: Props) {
  const { locale, region: regionSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const region = getRegion(regionSlug);
  if (!region) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const villes = getVillesByRegion(region.slug);
  // Top 12 villes par population (chefs-lieux + métropoles + sous-préfectures).
  const topVilles = [...villes].sort((a, b) => b.population - a.population).slice(0, 12);
  // Villes pilotes avec copy éditorial (V1 = 0 ou 1 par région : Paris IDF).
  const pilotVilles = villes.filter((v) => !!v.copy);

  const breadcrumbItems = [
    { href: "/implantations", label: isFr ? "Implantations" : "Locations" },
    { href: `/implantations/${region.slug}`, label: region.nameFr },
  ];

  // ---- JSON-LD stack (3 schemas + BreadcrumbList auto via <Breadcrumbs>) ----
  // Sprint Correctif P1-2 (2026-05-23 — audit E2E passe 2 runtime + décision Will) —
  // Service Area Business safe : Axion-IA a 1 siège FR (Paris), pas un bureau
  // dans chaque préfecture régionale. Le LB ne doit pas claim `geo` régional
  // (= prétendre un bureau à ces coordonnées). `placeJsonLd` ci-dessous garde
  // les coords pour décrire la région (Place ≠ LocalBusiness).
  //   ❌ RETIRÉ `geo` (coords région ≠ bureau réel)
  //   ✅ GARDÉ `address` (prefecture + région : zone de service)
  //   ✅ GARDÉ `areaServed: AdministrativeArea` (cœur Service Area Business)
  const localBusinessJsonLd = buildLocalBusinessJsonLd({
    locale: loc,
    path: `/implantations/${region.slug}`,
    name: isFr
      ? `Axion-IA · architectes IA seniors en ${region.nameFr}`
      : `Axion-IA · senior AI architects in ${region.nameFr}`,
    description: isFr ? region.pitchFr : region.pitchEn,
    areaServed: { type: "AdministrativeArea", name: region.nameFr },
    address: { city: region.prefecture, region: region.nameFr, country: "FR" },
  });

  // Place — entité géographique (utile pour AI Overviews + Knowledge Graph).
  const placeJsonLd = buildPlaceJsonLd({
    locale: loc,
    path: `/implantations/${region.slug}`,
    name: region.nameFr,
    geo: { latitude: region.geo.lat, longitude: region.geo.lon },
    containedInPlace: { name: isFr ? "France" : "France" },
    population: region.population,
  });

  // ItemList — top villes de la région (signal AEO/GEO).
  const villesItemList = buildItemListJsonLd({
    locale: loc,
    path: `/implantations/${region.slug}`,
    name: isFr
      ? `Villes en ${region.nameFr} couvertes par Axion-IA`
      : `Cities in ${region.nameFr} covered by Axion-IA`,
    items: topVilles.map((ville, idx) => ({
      position: idx + 1,
      name: ville.nameFr,
      url: `${SITE_URL}/${loc}/${isFr ? "implantations" : "locations"}/${region.slug}/${ville.slug}`,
    })),
  });

  return (
    <>
      {/* V-04 P1 (Sprint Correctif suite 2026-05-22) — LocalBusiness inline
          (Local SEO racine critique), Place + ItemList villes différés
          afterInteractive (-150 à -250 ms TBT page hub région). */}
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={placeJsonLd} strategy="afterInteractive" scriptId="jsonld-region-place" />
      <JsonLd
        data={villesItemList}
        strategy="afterInteractive"
        scriptId="jsonld-region-villes-itemlist"
      />

      {/* Hero région — refonte 2-col (Will 2026-05-26) : copy + illustration
          équilibrées à la manière du hero home. H1 hook par tension
          concurrentielle, sous-ligne énumérant les 5 services Axion-IA,
          puis pitchFr régional + stats inline + CTAs (Réserver un appel /
          Nous contacter). Image globe-services universelle pour les 13
          régions (slot REGION-01-hero, priority LCP). */}
      <section
        aria-labelledby="region-hero-heading"
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
                {isFr
                  ? `Architectes IA · ${region.prefecture}`
                  : `AI architects · ${region.prefecture}`}
              </p>
              <h1
                id="region-hero-heading"
                className="display-editorial text-fg"
                data-speakable-hero
              >
                {isFr ? "Vos concurrents en " : "Your competitors in "}
                <em className="italic-editorial text-terracotta not-italic">
                  <span className="italic" style={{ fontFamily: "var(--font-serif)" }}>
                    {region.nameFr}
                  </span>
                </em>
                {isFr
                  ? " utilisent déjà l'IA. Et vous ?"
                  : " are already using AI. What about you?"}
              </h1>
              {/* Sous-ligne hero — copy unifié home/régions/villes (Will 2026-05-26)
                  Réponse au « Et vous ? » en miroir de la home, avec suffixe
                  géographique localisé à la région. */}
              <p
                className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl"
                data-speakable-hero
              >
                {isFr
                  ? "Axion-IA forme, audite et déploie l'IA dans votre entreprise — de l'automatisation aux plateformes sur mesure, "
                  : "Axion-IA trains, audits and deploys AI in your company — from automation to custom platforms, "}
                <span className="text-fg font-semibold">
                  {isFr ? `en ${region.nameFr}.` : `in ${region.nameEn ?? region.nameFr}.`}
                </span>
              </p>
              {/* CTAs */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Cta
                  href="/appel"
                  variant="primary"
                  size="lg"
                  shape="pill"
                  track="region_cta_book"
                  data-source-region={region.slug}
                >
                  {isFr ? "Réserver un appel" : "Book a call"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta
                  href="/contact"
                  variant="ghost"
                  size="lg"
                  shape="pill"
                  track="region_cta_contact"
                  data-source-region={region.slug}
                >
                  {isFr ? "Nous contacter" : "Contact us"}
                </Cta>
              </div>
            </div>
            {/* Colonne droite — illustration universelle (globe + services).
                Aspect 1:1 → 0 CLS, priority LCP. Cachée sur < lg pour
                garder le focus sur la copy mobile (rendement informationnel). */}
            <div className="hidden lg:block">
              <Illustration
                slot="REGION-01-hero"
                src="/images/axion-ia-proposition-globe-4-services-formations-audit-implementations-carre.avif"
                aspectRatio="1:1"
                filenameTarget="public/images/axion-ia-proposition-globe-4-services-formations-audit-implementations-carre.avif"
                alt={
                  isFr
                    ? `Globe stylisé représentant les services Axion-IA — formations, audits, implémentations, coaching 1-to-1, plateformes web IA — disponibles en ${region.nameFr}.`
                    : `Stylized globe showing Axion-IA services — training, audits, implementations, 1-to-1 coaching, AI web platforms — available in ${region.nameEn ?? region.nameFr}.`
                }
                caption={
                  isFr
                    ? `Architectes IA seniors · ${region.nameFr}`
                    : `Senior AI architects · ${region.nameEn ?? region.nameFr}`
                }
                priority
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Bandeau logos clients — preuve sociale silencieuse juste après le hero
          (même placement que la home). Composant partagé `ClientLogosBand`. */}
      <ClientLogosBand isFr={isFr} />

      {/* Maillage canonique vers les 5 services — placé juste après le hero
          (Will 2026-05-26) : montrer immédiatement les prestations dispo + prix
          d'entrée avant la liste des villes. Grille 5 colonnes desktop. */}
      <Section
        eyebrow={isFr ? "Nos 5 services" : "Our 5 services"}
        title={isFr ? "5 services." : "5 services."}
        titleEm={isFr ? "Mêmes tarifs publics" : "Same public pricing"}
        titleTail={
          isFr ? `partout en ${region.nameFr}.` : `across ${region.nameEn ?? region.nameFr}.`
        }
        description={
          isFr
            ? "Toutes nos prestations sont disponibles aux mêmes tarifs publics partout en France métropolitaine."
            : "All our services are available at the same public pricing across all metropolitan France."
        }
        tone="sand"
      >
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              href: "/audit" as const,
              icon: Briefcase,
              label: isFr ? "Audit IA" : "AI audit",
              detail: isFr
                ? `4 niveaux · Flash ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "fr", { compact: true })} → Stratégique ETI dès ${formatAmount(getTierById(AUDIT_TIERS, "audit-strategique-eti").priceMin!, "fr", { compact: true })}`
                : `4 tiers · Flash ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "en", { compact: true })} → Mid-cap strategic from ${formatAmount(getTierById(AUDIT_TIERS, "audit-strategique-eti").priceMin!, "en", { compact: true })}`,
              accent: "primary" as const,
            },
            {
              href: "/interventions" as const,
              icon: Building2,
              label: isFr ? "Formation IA" : "AI training",
              detail: isFr
                ? `Sur site · dès ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })} · groupes 1-30`
                : `On-site · from ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })} · groups of 1-30`,
              accent: "terracotta" as const,
            },
            {
              href: "/un-a-un" as const,
              icon: UserCog,
              label: isFr ? "Coaching 1-to-1" : "1-to-1 coaching",
              detail: isFr
                ? `Journée 1-to-1 dirigeant · ${formatAmount(getEntryPriceEur(UN_A_UN_TIERS) ?? 0, "fr", { compact: true })} · ROI J+1`
                : `1-on-1 executive day · ${formatAmount(getEntryPriceEur(UN_A_UN_TIERS) ?? 0, "en", { compact: true })} · day-one ROI`,
              accent: "sage" as const,
            },
            {
              href: "/implementation" as const,
              icon: Wrench,
              label: isFr ? "Implémentation IA" : "AI implementation",
              detail: isFr
                ? `Pilote IA dès ${formatAmount(getEntryPriceEur(IMPLEMENTATION_TIERS) ?? 0, "fr", { compact: true })} · production 6-12 sem.`
                : `AI pilot from ${formatAmount(getEntryPriceEur(IMPLEMENTATION_TIERS) ?? 0, "en", { compact: true })} · 6-12 wk production`,
              accent: "terracotta-deep" as const,
            },
            {
              href: "/sites-web-augmentes" as const,
              icon: Globe,
              label: isFr ? "Plateforme web / SaaS IA" : "AI web platform / SaaS",
              detail: isFr
                ? "Sur devis · sites & SaaS IA sur mesure · RGPD Europe"
                : "Quote · custom AI sites & SaaS · EU GDPR",
              accent: "primary" as const,
            },
          ].map(({ href, icon: Icon, label, detail, accent }) => (
            <li key={href}>
              <Link
                href={href}
                data-cta-tracking="region_canonical_link"
                data-source-region={region.slug}
                data-source-target={href}
                className="group bg-paper hover:border-terracotta focus-visible:ring-terracotta border-border-strong/40 shadow-subtle hover:shadow-card flex h-full flex-col rounded-2xl border-2 p-5 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span
                  className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md ${
                    accent === "primary"
                      ? "bg-primary-soft text-primary"
                      : accent === "terracotta"
                        ? "bg-terracotta-soft text-terracotta-deep"
                        : accent === "terracotta-deep"
                          ? "bg-terracotta-soft text-terracotta-deep"
                          : "bg-sand-deep text-sage"
                  }`}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <p
                  className="text-fg text-lg leading-tight font-semibold"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {label}
                </p>
                <p className="text-fg-soft mt-2 flex-1 text-sm leading-relaxed">{detail}</p>
                <p className="text-terracotta mt-4 inline-flex items-center gap-1.5 text-sm font-semibold">
                  {isFr ? "Voir le service" : "See service"}
                  <ArrowUpRight
                    aria-hidden="true"
                    className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* Bandeau orange CTA contact — placé après l'aperçu des 5 services,
          avant la liste des villes. Convertit les visiteurs qui ne descendent
          pas jusqu'au CTA final. Patron Blueprint §17 (mêmes 2 boutons :
          /appel + /contact) avec H2 localisé à la région. */}
      <section className="bg-terracotta py-16 sm:py-20">
        <Container>
          <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <div className="max-w-2xl">
              <h2
                className="text-paper text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr
                  ? `Un projet IA en ${region.nameFr} ? Réponse sous 24 h.`
                  : `An AI project in ${region.nameEn ?? region.nameFr}? Reply within 24 h.`}
              </h2>
              <p className="text-paper/85 mt-3 text-base leading-relaxed sm:text-lg">
                {isFr
                  ? "Décrivez votre projet en 2 minutes. On vous répond sous 24h — sans engagement."
                  : "Describe your project in 2 minutes. We reply within 24h — no commitment."}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link
                href="/appel"
                data-cta-tracking="region_orange_banner_book"
                data-source-region={region.slug}
                className="bg-paper text-terracotta cta-lift focus-visible:ring-paper inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {isFr ? "Réserver un appel" : "Book a call"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                data-cta-tracking="region_orange_banner_contact"
                data-source-region={region.slug}
                className="text-paper border-paper/40 hover:bg-paper/10 cta-lift focus-visible:ring-paper inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {isFr ? "Nous contacter" : "Contact us"}
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Pages villes pilotes (gold standard, V1 = Paris IDF seul) */}
      {pilotVilles.length > 0 ? (
        <Section
          eyebrow={isFr ? "Pages villes" : "City pages"}
          title={isFr ? "Nos pages villes" : "Our"}
          titleEm={isFr ? "premium" : "premium"}
          titleTail={isFr ? "" : "city pages"}
          description={
            isFr
              ? "Ces villes ont une page dédiée enrichie : démographie locale, FAQ géolocalisée, écosystème B2B et cas clients à proximité."
              : "These cities have a dedicated, enriched page: local demographics, geolocalized FAQ, B2B ecosystem and nearby case studies."
          }
          tone="paper"
        >
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pilotVilles.map((ville) => (
              <li key={ville.slug}>
                <Link
                  href={`/implantations/${region.slug}/${ville.slug}` as never}
                  data-cta-tracking="region_pilot_ville"
                  data-source-region={region.slug}
                  data-source-ville={ville.slug}
                  className="group bg-paper hover:border-terracotta focus-visible:ring-terracotta border-border-strong/40 shadow-subtle hover:shadow-card block h-full rounded-2xl border-2 p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                        {ville.departementLabel ?? ville.departement} ·{" "}
                        {fmtPopulation(ville.population, isFr ? "fr" : "en")}{" "}
                        {isFr ? "hab." : "inhab."}
                      </p>
                      <p
                        className="text-fg mt-2 text-2xl leading-tight font-semibold"
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
                    <p className="text-fg-soft mt-4 line-clamp-3 text-sm leading-relaxed">
                      {isFr ? ville.copy.pitchFr : ville.copy.pitchEn}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* TOUTES les villes de la région — groupées par département.
          Sprint 14.9.1 (refonte 2026-05-08) : on expose la couverture
          réelle (~280 communes IDF, ~190 ARA, etc.) au lieu d'un top 12
          factice. Maillage interne massif vers les pages villes pilotes
          + stubs noindex (le crawl ne suit pas les noindex mais l'utilisateur
          peut atterrir et trouver son Axion-IA local). */}
      <Section
        eyebrow={isFr ? "Couverture complète" : "Full coverage"}
        title={
          isFr
            ? `${fmtPopulation(villes.length, "fr")} communes éligibles`
            : `${fmtPopulation(villes.length, "en")} eligible communes`
        }
        titleEm={isFr ? `en ${region.nameFr}` : `in ${region.nameFr}`}
        description={
          isFr
            ? `Toute commune française de plus de 5 000 habitants est éligible aux interventions sur site, audits et missions d'implémentation. Communes groupées par département. ${pilotVilles.length > 0 ? "Les villes marquées ★ ont une page locale enrichie." : ""}`
            : `Any French commune with more than 5,000 inhabitants is eligible for on-site engagements, audits and implementation missions. Communes grouped by department. ${pilotVilles.length > 0 ? "Cities marked ★ have an enriched local page." : ""}`
        }
      >
        {(() => {
          // Groupement par département (clé = code numérique). Tri département
          // par code asc, villes dans chaque département par population desc.
          // `villes` est ReadonlyArray → on copie chaque entrée dans un Array
          // mutable pour pouvoir `push`/`sort`.
          type VilleEntry = (typeof villes)[number];
          const byDept = new Map<string, VilleEntry[]>();
          for (const v of villes) {
            const key = v.departementLabel ?? v.departement;
            const arr = byDept.get(key);
            if (arr) {
              arr.push(v);
            } else {
              byDept.set(key, [v]);
            }
          }
          const sortedDepts = [...byDept.entries()].sort(([a], [b]) =>
            a.localeCompare(b, undefined, { numeric: true }),
          );
          for (const [, arr] of sortedDepts) {
            arr.sort((a: VilleEntry, b: VilleEntry) => b.population - a.population);
          }
          // Si la région a 1 seul département (ex Corse 2A+2B = 2 dept),
          // on garde les <details> pour cohérence visuelle. Premier dept
          // ouvert par défaut pour un aperçu sans clic.
          return (
            <div className="space-y-3">
              {sortedDepts.map(([dept, list], idx) => (
                <details
                  key={dept}
                  open={idx === 0}
                  className="group bg-paper border-border-strong/40 open:shadow-card rounded-2xl border-2 transition"
                >
                  <summary className="hover:bg-sand focus-visible:ring-terracotta flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-5 py-4 transition focus-visible:ring-2 focus-visible:outline-none">
                    <span className="flex items-baseline gap-3">
                      <span
                        className="text-fg text-lg leading-tight font-semibold tracking-tight"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {isFr ? `Département ${dept}` : `Department ${dept}`}
                      </span>
                      <span className="text-fg-muted text-sm tabular-nums">
                        {list.length} {isFr ? "communes" : "communes"}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-fg-muted text-xs transition-transform group-open:rotate-180"
                    >
                      ▾
                    </span>
                  </summary>
                  <ul className="border-border/40 grid grid-cols-2 gap-x-3 gap-y-1 border-t px-5 py-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {list.map((ville) => {
                      const isPilot = !!ville.copy;
                      return (
                        <li key={ville.slug}>
                          <Link
                            href={`/implantations/${region.slug}/${ville.slug}` as never}
                            data-source-region={region.slug}
                            data-source-ville={ville.slug}
                            data-cta-tracking="region_all_villes"
                            className="group/v hover:bg-sand focus-visible:ring-terracotta block rounded-md px-2 py-1.5 transition focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
                          >
                            <span className="text-fg group-hover/v:text-terracotta flex items-baseline gap-1 text-[13px] font-semibold tracking-tight transition">
                              <span className="truncate">{ville.nameFr}</span>
                              {isPilot ? (
                                <span
                                  aria-hidden="true"
                                  className="text-terracotta shrink-0"
                                  title={isFr ? "Page pilote" : "Pilot page"}
                                >
                                  ★
                                </span>
                              ) : null}
                            </span>
                            <span className="text-fg-muted mt-0.5 block text-[10.5px] tabular-nums">
                              {fmtPopulation(ville.population, isFr ? "fr" : "en")}{" "}
                              {isFr ? "hab." : "inhab."}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>
          );
        })()}
      </Section>

      {/* Section fondateur William J. — crédibilité avant le contexte régional
          + CTA final. Composant partagé `FounderTrustSection` (i18n home). */}
      <FounderTrustSection isFr={isFr} />

      {/* Contexte régional — discret, en bas de page (Will 2026-05-26).
          Décision : pitchFr + stats (population / communes / PIB) sortis du
          hero — bruit côté visiteur. Maintenus en bas pour AEO/GEO + anti-
          duplicate-content cross-régions (data différenciée par région). */}
      <section
        aria-labelledby="region-contexte-heading"
        className="bg-bg border-border border-t py-12 sm:py-16"
      >
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.18em] uppercase">
              {isFr ? "Contexte régional" : "Regional context"}
            </p>
            <h2
              id="region-contexte-heading"
              className="text-fg text-xl leading-tight font-semibold tracking-tight sm:text-2xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {region.nameFr}
            </h2>
            <p className="text-fg-soft mx-auto mt-4 max-w-2xl text-sm leading-relaxed sm:text-base">
              {isFr ? region.pitchFr : region.pitchEn}
            </p>
            <div className="text-fg-muted mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {fmtPopulation(region.population, isFr ? "fr" : "en")}{" "}
                {isFr ? "habitants" : "inhabitants"}
              </span>
              <span className="inline-flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                {villes.length} {isFr ? "communes ≥ 5 000 hab" : "communes ≥ 5,000 inhab."}
              </span>
              {typeof region.pibBillionsEur === "number" ? (
                <span className="inline-flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                  {region.pibBillionsEur} Md€ {isFr ? "PIB régional" : "regional GDP"}
                </span>
              ) : null}
            </div>
          </div>
        </Container>
      </section>

      {/* CTA final */}
      <CtaBlock
        eyebrow={isFr ? "Démarrer en région" : "Start in the region"}
        title={isFr ? `Vous êtes en ${region.nameFr} ?` : `You're in ${region.nameFr}?`}
        titleEm={isFr ? "Parlons-en." : "Let's talk."}
        description={
          isFr
            ? `TPE, PME, ETI ou grande entreprise — en ${region.nameFr} comme partout en France, vous bénéficiez du même standard premium senior. Tarifs publics, calendrier temps réel, vos données restent chez vous.`
            : `Micro-business, SMB, mid-market or large enterprise — in ${region.nameFr} as anywhere in France, you get the same premium senior standard. Public pricing, real-time calendar, your data stays yours.`
        }
        cta={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Cta
              href="/appel"
              variant="primary"
              size="lg"
              shape="pill"
              track="region_cta_book_final"
              data-source-region={region.slug}
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta
              href="/contact"
              variant="ghost"
              size="lg"
              shape="pill"
              track="region_cta_contact_final"
              data-source-region={region.slug}
            >
              {isFr ? "Nous contacter" : "Contact us"}
            </Cta>
          </div>
        }
      />

      {/* Sticky mobile CTA — apparaît après scroll > 600 px, masqué sur lg+.
          Garde « Réserver un appel » accessible sur les pages régions longues
          (liste des départements + couverture). */}
      <StickyMobileCta
        href="/appel"
        label={isFr ? "Réserver un appel" : "Book a call"}
        track="region-sticky-mobile"
        threshold={600}
      />
    </>
  );
}
