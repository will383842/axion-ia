import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  Euro,
  MapPin,
  ShieldCheck,
  Target,
  TrainFront,
  Users,
  Wrench,
} from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { fmtPopulation } from "@/lib/intl";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { VilleHeroSchema } from "@/components/sections/VilleHeroSchema";
import { VilleServiceDetailSection } from "@/components/sections/VilleServiceDetailSection";

import { getRegion } from "@/content/regions";
import { VILLES, getVille, type Ville } from "@/content/villes";
import { getNearbyVilles, getNearbyCases, getRelatedBlogPosts } from "@/lib/geo";
import {
  AUDIT_TIERS,
  INTERVENTION_TIERS,
  IMPLEMENTATION_TIERS,
  formatPrice,
  formatAmount,
  getEntryTier,
  getTierById,
} from "@/content/pricing";
import {
  buildProductMetadata,
  buildItemListJsonLd,
  buildLocalBusinessJsonLd,
  buildPlaceJsonLd,
  buildFaqSpeakableJsonLd,
  SITE_URL,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; region: string; ville: string }>;
}

export function generateStaticParams(): Array<{ region: string; ville: string }> {
  return VILLES.map((v) => ({ region: v.region, ville: v.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, region: regionSlug, ville: villeSlug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const ville = getVille(villeSlug);
  if (!ville || ville.region !== regionSlug) return {};
  const region = getRegion(regionSlug);
  if (!region) return {};
  const isFr = locale === "fr";
  const isPilot = !!ville.copy;

  const title = isPilot
    ? isFr
      ? `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) · Cabinet IA opérationnel`
      : `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) · Operational AI consultancy`
    : isFr
      ? `${ville.nameFr} · Intervention IA opérationnelle (${region.nameFr})`
      : `${ville.nameFr} · Operational AI engagement (${region.nameFr})`;

  const description = isPilot
    ? isFr
      ? (ville.copy?.directAnswerFr ?? ville.copy?.pitchFr ?? "")
      : (ville.copy?.directAnswerEn ?? ville.copy?.pitchEn ?? "")
    : isFr
      ? `Axion-IA intervient à ${ville.nameFr} (${region.nameFr}). Audit IA Flash dès ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "fr")}, intervention sur site 1 journée, implémentation IA. Réservation directe en ligne.`
      : `Axion-IA operates in ${ville.nameFr} (${region.nameFr}). Flash AI audit from ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "en")}, 1-day on-site session, AI implementation. Direct online booking.`;

  const meta = buildProductMetadata({
    locale,
    path: `/implantations/${region.slug}/${ville.slug}`,
    title,
    description,
    alternates: {
      fr: `/implantations/${region.slug}/${ville.slug}`,
      en: `/locations/${region.slug}/${ville.slug}`,
    },
  });
  // Anti-doorway HCU 2024 — pages sans copy éditorial sortent en `noindex`
  // (la SSG construit la page mais Google ne l'indexe pas tant que Will
  // ne la promeut pas en pilote via un copy/<slug>.ts).
  if (!isPilot) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

export default async function VillePage({ params }: Props) {
  const { locale, region: regionSlug, ville: villeSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const ville = getVille(villeSlug);
  if (!ville || ville.region !== regionSlug) notFound();
  const region = getRegion(regionSlug);
  if (!region) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [
    { href: "/implantations", label: isFr ? "Implantations" : "Locations" },
    { href: `/implantations/${region.slug}`, label: region.nameFr },
    { href: `/implantations/${region.slug}/${ville.slug}`, label: ville.nameFr },
  ];

  // ---- Pages sans copy : stub minimal `noindex` (anti-doorway HCU 2024) ----
  if (!ville.copy) {
    return (
      <VilleStub
        ville={ville}
        regionNameFr={region.nameFr}
        regionSlug={region.slug}
        breadcrumbItems={breadcrumbItems}
        isFr={isFr}
      />
    );
  }

  // ---- Pages avec copy : rendu gold standard 9 sections + 5 schemas JSON-LD ----
  const copy = ville.copy;
  const nearbyVilles = getNearbyVilles(ville.geo, 8, {
    excludeSlug: ville.slug,
    sameRegion: ville.region,
  });
  const nearbyCases = getNearbyCases(ville.geo, 50, 3);
  const relatedPosts = getRelatedBlogPosts(ville, 3);

  // ---- JSON-LD stack (4 schemas + BreadcrumbList auto via <Breadcrumbs>) ----
  const localBusinessJsonLd = buildLocalBusinessJsonLd({
    locale: loc,
    path: `/implantations/${region.slug}/${ville.slug}`,
    name: isFr
      ? `Axion-IA · cabinet IA opérationnel Ã  ${ville.nameFr}`
      : `Axion-IA · operational AI consultancy in ${ville.nameFr}`,
    description: isFr ? copy.pitchFr : copy.pitchEn,
    areaServed: { type: "City", name: ville.nameFr },
    address: {
      city: ville.nameFr,
      region: region.nameFr,
      country: "FR",
      ...(ville.postalCode ? { postalCode: ville.postalCode } : {}),
    },
    geo: { latitude: ville.geo.lat, longitude: ville.geo.lon },
  });

  const placeJsonLd = buildPlaceJsonLd({
    locale: loc,
    path: `/implantations/${region.slug}/${ville.slug}`,
    name: ville.nameFr,
    geo: { latitude: ville.geo.lat, longitude: ville.geo.lon },
    containedInPlace: {
      name: region.nameFr,
      url: `${SITE_URL}/${loc}/${isFr ? "implantations" : "locations"}/${region.slug}`,
    },
    population: ville.population,
  });

  const faqSpeakableJsonLd = copy.faqGeolocalisee?.length
    ? buildFaqSpeakableJsonLd({
        items: copy.faqGeolocalisee.map((f) => ({ question: f.q, answer: f.a })),
      })
    : null;

  const nearbyItemList =
    nearbyVilles.length > 0
      ? buildItemListJsonLd({
          locale: loc,
          path: `/implantations/${region.slug}/${ville.slug}`,
          name: isFr ? `Villes proches de ${ville.nameFr}` : `Cities near ${ville.nameFr}`,
          items: nearbyVilles.map(({ ville: v }, idx) => ({
            position: idx + 1,
            name: v.nameFr,
            url: `${SITE_URL}/${loc}/${isFr ? "implantations" : "locations"}/${v.region}/${v.slug}`,
          })),
        })
      : null;

  // FAQ items pour FaqBlock (accordion). On désactive son JSON-LD interne car
  // on émet déjÃ  le Speakable variant via buildFaqSpeakableJsonLd.
  const faqItems =
    copy.faqGeolocalisee?.map((f, idx) => ({
      id: `${ville.slug}-faq-${idx}`,
      question: f.q,
      answer: f.a,
    })) ?? [];

  return (
    <>
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={placeJsonLd} />
      {faqSpeakableJsonLd ? <JsonLd data={faqSpeakableJsonLd} /> : null}
      {nearbyItemList ? <JsonLd data={nearbyItemList} /> : null}

      {/* 1. HERO localisé — Section h1 custom layout 2-cols (parity /interventions) */}
      <section className="bg-halo-warm relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div>
              <div className="mb-8">
                <Breadcrumbs items={breadcrumbItems} />
              </div>
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? `Implantations · ${region.nameFr}` : `Locations · ${region.nameFr}`}
              </p>
              <h1 className="display-editorial text-fg">
                {isFr ? "Cabinet IA opérationnel Ã " : "Operational AI consultancy in"}{" "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {ville.nameFr}
                </span>
                {isFr
                  ? `, ${ville.departementLabel ?? ville.departement}.`
                  : `, ${ville.departementLabel ?? ville.departement}.`}
              </h1>
              {/* 2. DIRECT ANSWER 40-80 mots citable LLMs (signal AEO/GEO) */}
              <p
                className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
                itemProp="text"
              >
                {isFr
                  ? (copy.directAnswerFr ?? copy.pitchFr)
                  : (copy.directAnswerEn ?? copy.pitchEn)}
              </p>
              <div className="text-fg-muted mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  {fmtPopulation(ville.population, isFr ? "fr" : "en")}{" "}
                  {isFr ? "habitants" : "inhabitants"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {region.nameFr}
                </span>
                {ville.postalCode ? (
                  <span className="inline-flex items-center gap-2 tabular-nums">
                    {ville.postalCode}
                  </span>
                ) : null}
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Cta
                  href={`/reserver?ville=${ville.slug}` as never}
                  variant="primary"
                  size="lg"
                  shape="pill"
                  track="ville_cta_book"
                >
                  {isFr
                    ? `Réserver à ${ville.nameFr} · ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}`
                    : `Book in ${ville.nameFr} · ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}`}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta
                  href="/audit"
                  variant="ghost"
                  size="lg"
                  shape="pill"
                  track="ville_cta_audit"
                  data-source-ville={ville.slug}
                >
                  {isFr
                    ? `Audit IA Flash · ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "fr", { compact: true })}`
                    : `Flash AI audit · ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "en", { compact: true })}`}
                </Cta>
              </div>
            </div>
            {copy.heroSchema ? (
              <VilleHeroSchema
                centerLabel={ville.nameFr}
                {...(copy.heroSchema.centerSubLabel
                  ? { centerSubLabel: copy.heroSchema.centerSubLabel }
                  : {})}
                nodes={copy.heroSchema.satellites}
                ariaLabel={
                  isFr
                    ? `Schéma écosystème B2B de ${ville.nameFr}`
                    : `B2B ecosystem schema of ${ville.nameFr}`
                }
              />
            ) : null}
          </div>
        </Container>
      </section>

      {/* 2. NOS 3 SERVICES À [VILLE] — cÅ“ur de la page (Sprint 14.9.1)
          Indexation maximale : mots-clés long-tail « audit IA [Ville] »,
          « intervention IA [Ville] », « implémentation IA [Ville] » dans
          les h2/h3 + descriptions naturelles. Tarifs publics affichés
          (signal AEO/GEO : Perplexity / Claude / Gemini citent prix). */}
      <Section
        eyebrow={isFr ? "Nos services" : "Our services"}
        title={isFr ? "Trois services Axion-IA Ã " : "Three Axion-IA services in"}
        titleEm={ville.nameFr}
        description={
          isFr
            ? `Tarifs publics affichés, calendrier en temps réel, vous gardez la main sur vos données. Axion-IA délivre ses 3 prestations Ã  ${ville.nameFr} comme partout en France métropolitaine.`
            : `Public pricing displayed, real-time calendar, you keep control of your data. Axion-IA delivers its 3 services in ${ville.nameFr} as anywhere in metropolitan France.`
        }
        tone="paper"
      >
        <ul className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[
            {
              href: "/audit" as const,
              icon: Briefcase,
              h3Fr: `Audit IA Ã  ${ville.nameFr}`,
              h3En: `AI audit in ${ville.nameFr}`,
              priceTier: getEntryTier(AUDIT_TIERS),
              tagline: isFr
                ? "Pyramide 4 niveaux : Flash, Ciblé, Stratégique PME, Stratégique ETI."
                : "4-level pyramid: Flash, Targeted, SME Strategic, Mid-cap Strategic.",
              accent: "primary" as const,
              context:
                copy.servicesContext?.audit?.[isFr ? "fr" : "en"] ??
                (isFr
                  ? `Audit IA Ã  ${ville.nameFr} aux mêmes tarifs publics que partout en France. Diagnostic actionnable et plan d'attaque chiffré.`
                  : `AI audit in ${ville.nameFr} at the same public pricing as anywhere in France. Actionable diagnosis and costed action plan.`),
              ctaFr: "Demander un audit",
              ctaEn: "Request an audit",
            },
            {
              href: "/interventions" as const,
              icon: Building2,
              h3Fr: `Interventions IA Ã  ${ville.nameFr}`,
              h3En: `AI sessions in ${ville.nameFr}`,
              priceTier: getEntryTier(INTERVENTION_TIERS),
              tagline: isFr
                ? "5 formats sur site : Essentielle, Équipes, Managers, Conférence, Dirigeants."
                : "5 on-site formats: Essential, Teams, Managers, Talk, Executives.",
              accent: "terracotta" as const,
              context:
                copy.servicesContext?.interventions?.[isFr ? "fr" : "en"] ??
                (isFr
                  ? `Interventions IA en entreprise Ã  ${ville.nameFr} sur site. Démos sur vos vraies données, pas de scénarios génériques.`
                  : `Corporate AI sessions in ${ville.nameFr} on site. Demos on your real data, no generic scenarios.`),
              ctaFr: "Voir le calendrier",
              ctaEn: "View the calendar",
            },
            {
              href: "/implementation" as const,
              icon: Wrench,
              h3Fr: `Implémentation IA Ã  ${ville.nameFr}`,
              h3En: `AI implementation in ${ville.nameFr}`,
              priceTier: getEntryTier(IMPLEMENTATION_TIERS),
              tagline: isFr
                ? "Mise en production avec ROI chiffré, formation incluse, sans dépendance imposée."
                : "Production deployment with costed ROI, training included, no imposed dependency.",
              accent: "sage" as const,
              context:
                copy.servicesContext?.implementation?.[isFr ? "fr" : "en"] ??
                (isFr
                  ? `Implémentation IA opérationnelle Ã  ${ville.nameFr} : agents, automatisation back-office, intégration CRM/ERP, IA custom. Forfait fixe, aucun abonnement.`
                  : `Operational AI implementation in ${ville.nameFr}: agents, back-office automation, CRM/ERP integration, custom AI. Fixed fee, no subscription.`),
              ctaFr: "Discuter d'un projet",
              ctaEn: "Discuss a project",
            },
          ].map(
            ({
              href,
              icon: Icon,
              h3Fr,
              h3En,
              priceTier,
              tagline,
              accent,
              context,
              ctaFr,
              ctaEn,
            }) => (
              <li key={href}>
                <article
                  className={`bg-bg border-border-strong/40 hover:shadow-card shadow-subtle flex h-full flex-col rounded-2xl border-2 p-6 transition`}
                >
                  <span
                    className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-md ${
                      accent === "primary"
                        ? "bg-primary-soft text-primary"
                        : accent === "terracotta"
                          ? "bg-terracotta-soft text-terracotta-deep"
                          : "bg-sand-deep text-sage"
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
                  </span>
                  <h3
                    className="text-fg text-2xl leading-tight font-semibold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? h3Fr : h3En}
                  </h3>
                  <p
                    className={`mt-2 text-sm font-bold tracking-tight ${
                      accent === "primary"
                        ? "text-primary"
                        : accent === "terracotta"
                          ? "text-terracotta-deep"
                          : "text-sage"
                    }`}
                  >
                    {isFr ? "Dès " : "From "}
                    {formatPrice(priceTier, isFr ? "fr" : "en")}
                  </p>
                  <p className="text-fg mt-3 text-sm leading-snug font-medium">{tagline}</p>
                  <p className="text-fg-soft mt-4 grow text-sm leading-relaxed">{context}</p>
                  <div className="mt-6">
                    <Cta
                      href={href}
                      variant={accent === "terracotta" ? "terracotta" : "primary"}
                      size="md"
                      shape="pill"
                      track={`ville_service_${href.slice(1)}`}
                      data-source-ville={ville.slug}
                      data-source-region={ville.region}
                    >
                      {isFr ? ctaFr : ctaEn}
                      <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                    </Cta>
                  </div>
                </article>
              </li>
            ),
          )}
        </ul>
      </Section>

      {/* 2bis. SECTIONS DÉTAILLÉES PAR SERVICE — perfection extrême Sprint 14.10.1
          Affichées si copy.services renseigné (Paris pilote + futures villes
          enrichies). Chaque section ~500-700 mots : hero + raisons + méthodologie
          + tarifs INSEE + témoignages + garanties. Ces sections font passer la
          page de ~1200 mots Ã  ~5000+ mots — cap perfection #1 sur « audit IA Ville »,
          « formation IA Ville », « implémentation IA Ville ». */}
      {copy.services?.audit ? (
        <VilleServiceDetailSection
          isFr={isFr}
          service="audit"
          villeNameFr={ville.nameFr}
          villeSlug={ville.slug}
          regionSlug={ville.region}
          copy={copy.services.audit[loc]}
          tone="paper"
        />
      ) : null}
      {copy.services?.interventions ? (
        <VilleServiceDetailSection
          isFr={isFr}
          service="interventions"
          villeNameFr={ville.nameFr}
          villeSlug={ville.slug}
          regionSlug={ville.region}
          copy={copy.services.interventions[loc]}
          tone="canvas"
        />
      ) : null}
      {copy.services?.implementation ? (
        <VilleServiceDetailSection
          isFr={isFr}
          service="implementation"
          villeNameFr={ville.nameFr}
          villeSlug={ville.slug}
          regionSlug={ville.region}
          copy={copy.services.implementation[loc]}
          tone="paper"
        />
      ) : null}

      {/* 3. POURQUOI AXIONIA À [VILLE] — différenciation anti-doorway HCU
          + signal autorité (4 différenciateurs concrets, pas du blabla) */}
      <Section
        eyebrow={isFr ? "Pourquoi nous" : "Why us"}
        title={isFr ? "Ce qui change avec Axion-IA Ã " : "What changes with Axion-IA in"}
        titleEm={ville.nameFr}
        description={
          isFr
            ? "Un cabinet IA opérationnel n'est pas un éditeur logiciel ni un cabinet de conseil traditionnel. Voici les 4 différences concrètes que vous obtenez Ã  chaque mission."
            : "An operational AI consultancy is not a software vendor nor a traditional consulting firm. Here are the 4 concrete differences you get on every engagement."
        }
        tone="canvas"
      >
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: MapPin,
              titleFr: "Sur site, pas en visio",
              titleEn: "On site, not on video calls",
              detailFr: `Nous nous déplaçons Ã  ${ville.nameFr} pour kick-off et restitutions. Frais inclus.`,
              detailEn: `We travel to ${ville.nameFr} for kick-off and read-outs. Fees included.`,
            },
            {
              icon: Euro,
              titleFr: "Prix public, pas d'opacité",
              titleEn: "Public pricing, no opacity",
              detailFr: "Tarifs affichés sur le site. Aucun jeu de devis, aucune surfacturation.",
              detailEn: "Pricing displayed on the site. No quote game, no overbilling.",
            },
            {
              icon: ShieldCheck,
              titleFr: "Aucun lock-in technologique",
              titleEn: "No tech lock-in",
              detailFr: "Pas d'abonnement, pas de SaaS imposé. Vous repartez avec les outils.",
              detailEn: "No subscription, no SaaS imposed. You leave with the tools.",
            },
            {
              icon: Target,
              titleFr: "ROI chiffré avant et après",
              titleEn: "Costed ROI before and after",
              detailFr: "On quantifie le gain avant la mission, on prouve après. Pas de baratin.",
              detailEn: "We quantify the gain before the mission, we prove it after. No fluff.",
            },
          ].map(({ icon: Icon, titleFr, titleEn, detailFr, detailEn }, idx) => (
            <li
              key={idx}
              className="bg-paper border-border-strong/40 shadow-subtle rounded-2xl border-2 p-5"
            >
              <span className="bg-terracotta-soft text-terracotta-deep mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md">
                <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <p
                className="text-fg text-base leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? titleFr : titleEn}
              </p>
              <p className="text-fg-soft mt-3 text-sm leading-relaxed">
                {isFr ? detailFr : detailEn}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* 4. CAS CLIENTS PROCHES — Haversine 50 km, fallback silencieux */}
      {nearbyCases.length > 0 ? (
        <Section
          eyebrow={isFr ? "Cas clients proches" : "Nearby case studies"}
          title={isFr ? "DéjÃ  déployé" : "Already deployed"}
          titleEm={isFr ? "Ã  proximité" : "nearby"}
          description={
            isFr
              ? `Cas anonymisés Ã  moins de 50 km de ${ville.nameFr}. ROI chiffré, contexte, livrables.`
              : `Anonymized cases within 50 km of ${ville.nameFr}. Costed ROI, context, deliverables.`
          }
          tone="paper"
        >
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {nearbyCases.map(({ caseStudy, distanceKm }) => (
              <li key={caseStudy.slug}>
                <Link
                  href={`/cas-concrets/${caseStudy.slug}` as never}
                  data-cta-tracking="ville_nearby_case"
                  data-source-ville={ville.slug}
                  className="group bg-bg hover:border-terracotta focus-visible:ring-terracotta border-border-strong/40 shadow-subtle hover:shadow-card block h-full rounded-2xl border-2 p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                    {isFr ? caseStudy.industry : caseStudy.industryEn} · {Math.round(distanceKm)} km
                  </p>
                  <p
                    className="text-fg mt-2 text-lg leading-tight font-semibold"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? caseStudy.fr.title : caseStudy.en.title}
                  </p>
                  <p className="text-fg-soft mt-3 line-clamp-3 text-sm leading-relaxed">
                    {isFr ? caseStudy.fr.excerpt : caseStudy.en.excerpt}
                  </p>
                  <p className="text-terracotta mt-4 text-sm font-semibold">{caseStudy.metric}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* 6. VILLES PROCHES (Haversine) — maillage régional */}
      {nearbyVilles.length > 0 ? (
        <Section
          eyebrow={isFr ? "Maillage régional" : "Regional mesh"}
          title={isFr ? "Villes proches" : "Cities near"}
          titleEm={ville.nameFr}
          description={
            isFr
              ? "Communes éligibles aux interventions sur site, triées par distance. Cliquez pour voir leur page locale."
              : "Communes eligible for on-site engagements, sorted by distance. Click to see their local page."
          }
        >
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {nearbyVilles.map(({ ville: v, distanceKm }) => (
              <li key={v.slug}>
                <Link
                  href={`/implantations/${v.region}/${v.slug}` as never}
                  data-source-region={v.region}
                  data-source-ville={v.slug}
                  className="group hover:bg-sand focus-visible:ring-terracotta block rounded-lg px-3 py-2.5 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span
                    className="text-fg group-hover:text-terracotta block text-sm font-semibold tracking-tight transition"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {v.nameFr}
                  </span>
                  <span className="text-fg-muted mt-0.5 block text-[11px] tabular-nums">
                    {Math.round(distanceKm)} km · {fmtPopulation(v.population, isFr ? "fr" : "en")}{" "}
                    {isFr ? "hab." : "inhab."}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* 7. FAQ géolocalisée (Speakable JSON-LD émis ailleurs) */}
      {faqItems.length > 0 ? (
        <FaqBlock
          eyebrow={isFr ? `FAQ · ${ville.nameFr}` : `FAQ · ${ville.nameFr}`}
          title={
            isFr
              ? `Questions fréquentes Ã  ${ville.nameFr}`
              : `Frequently asked questions in ${ville.nameFr}`
          }
          description={
            isFr
              ? `Réponses adaptées aux entreprises de ${ville.nameFr} et ${region.nameFr}.`
              : `Answers tailored to businesses in ${ville.nameFr} and ${region.nameFr}.`
          }
          items={faqItems}
          emitJsonLd={false}
          tone="sand"
        />
      ) : null}

      {/* 8. ARTICLES BLOG LIÉS — silence si rien ne matche */}
      {relatedPosts.length > 0 ? (
        <Section
          eyebrow={isFr ? "Articles & ressources" : "Articles & resources"}
          title={isFr ? "Lecture complémentaire" : "Further reading"}
          titleEm={ville.nameFr}
          tone="paper"
        >
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {relatedPosts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}` as never}
                  className="group bg-bg hover:border-terracotta focus-visible:ring-terracotta border-border-strong/40 shadow-subtle hover:shadow-card block h-full rounded-2xl border-2 p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                    {post.category} · {post.readingTime}
                  </p>
                  <p
                    className="text-fg mt-2 text-lg leading-tight font-semibold"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? post.fr.title : post.en.title}
                  </p>
                  <p className="text-fg-soft mt-3 line-clamp-3 text-sm leading-relaxed">
                    {isFr ? post.fr.excerpt : post.en.excerpt}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* 9. TISSU LOCAL — bandeau dense data INSEE + secteurs + accès.
          Anti-doorway HCU 2024 : preuve de différenciation par ville
          (les LLMs vérifient que chaque page ville a des data uniques). */}
      <Section
        eyebrow={isFr ? "Tissu local" : "Local fabric"}
        title={isFr ? "Données économiques" : "Economic data"}
        titleEm={ville.nameFr}
        description={
          isFr
            ? `Sources : INSEE recensement légal (code commune ${ville.inseeCode}) + Sirene 2024. Données différenciées spécifiques Ã  ${ville.nameFr} (signal anti-doorway HCU 2024).`
            : `Sources: INSEE legal census (commune code ${ville.inseeCode}) + Sirene 2024. City-specific differentiated data for ${ville.nameFr} (anti-doorway HCU 2024 signal).`
        }
        tone="paper"
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Démographie */}
          <article className="bg-bg border-border-strong/40 rounded-2xl border-2 p-6">
            <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-primary mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Démographie" : "Demographics"}
            </p>
            <p
              className="text-fg mt-3 text-2xl leading-tight font-semibold"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {fmtPopulation(ville.population, isFr ? "fr" : "en")}{" "}
              <span className="text-fg-soft text-base font-normal">
                {isFr ? "habitants" : "inhabitants"}
              </span>
            </p>
            <p className="text-fg-soft mt-3 text-sm leading-relaxed">
              {isFr
                ? `Code INSEE ${ville.inseeCode} · département ${ville.departementLabel ?? ville.departement}${ville.postalCode ? ` · ${ville.postalCode}` : ""}. Recensement légal INSEE 2024.`
                : `INSEE code ${ville.inseeCode} · department ${ville.departementLabel ?? ville.departement}${ville.postalCode ? ` · ${ville.postalCode}` : ""}. INSEE 2024 legal census.`}
            </p>
          </article>

          {/* Secteurs NAF */}
          {copy.topSectorsNaf?.length ? (
            <article className="bg-bg border-border-strong/40 rounded-2xl border-2 p-6">
              <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Top secteurs B2B" : "Top B2B sectors"}
              </p>
              <p
                className="text-fg mt-3 text-xl leading-tight font-semibold"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "Tissu dominant" : "Dominant fabric"}
              </p>
              <ul className="mt-4 space-y-1.5">
                {copy.topSectorsNaf.map((sector, idx) => (
                  <li key={idx} className="text-fg-soft text-sm leading-snug">
                    <span className="text-fg-muted mr-2 text-xs tabular-nums">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    {sector}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}

          {/* Distances + accès */}
          {(isFr ? copy.distancesFr : (copy.distancesEn ?? copy.distancesFr)) ? (
            <article className="bg-bg border-border-strong/40 rounded-2xl border-2 p-6">
              <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-sage mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Logistique & accès" : "Logistics & access"}
              </p>
              <p
                className="text-fg mt-3 inline-flex items-center gap-2 text-xl leading-tight font-semibold"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                <TrainFront aria-hidden="true" className="h-5 w-5" />
                {isFr ? "Gares & aéroports" : "Stations & airports"}
              </p>
              <p className="text-fg-soft mt-3 text-sm leading-relaxed">
                {isFr ? copy.distancesFr : (copy.distancesEn ?? copy.distancesFr)}
              </p>
            </article>
          ) : null}
        </div>
      </Section>

      {/* 10. ÉCOSYSTÈME LOCAL — paragraphe différenciateur (gros texte) */}
      {(isFr ? copy.ecosystemFr : (copy.ecosystemEn ?? copy.ecosystemFr)) ? (
        <Section
          eyebrow={isFr ? "Écosystème" : "Ecosystem"}
          title={isFr ? "Le tissu B2B" : "The B2B fabric"}
          titleEm={`de ${ville.nameFr}`}
          tone="canvas"
        >
          <p
            className="text-fg max-w-3xl text-xl leading-relaxed sm:text-2xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? copy.ecosystemFr : (copy.ecosystemEn ?? copy.ecosystemFr)}
          </p>
        </Section>
      ) : null}

      {/* CTA final pré-rempli ville */}
      <CtaBlock
        eyebrow={isFr ? `Démarrer Ã  ${ville.nameFr}` : `Start in ${ville.nameFr}`}
        title={isFr ? `Vous êtes basé Ã  ${ville.nameFr} ?` : `You're based in ${ville.nameFr}?`}
        titleEm={isFr ? "Réservez en ligne" : "Book online"}
        description={
          isFr
            ? `Calendrier réel temps réel. Acompte 50 % Ã  la confirmation. Le champ « ville » sera pré-rempli avec ${ville.nameFr}.`
            : `Real-time calendar. 50% deposit on confirmation. The "city" field will be pre-filled with ${ville.nameFr}.`
        }
        cta={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Cta
              href={`/reserver?ville=${ville.slug}` as never}
              variant="terracotta"
              size="lg"
              shape="pill"
              track="ville_cta_book_final"
              data-source-ville={ville.slug}
            >
              {isFr
                ? `Voir le calendrier · ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}`
                : `View the calendar · ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}`}
            </Cta>
            <Cta
              href="/contact"
              variant="outline"
              size="lg"
              shape="pill"
              track="ville_cta_contact_final"
            >
              {isFr ? "Parler Ã  un consultant" : "Speak with a consultant"}
            </Cta>
          </div>
        }
      />
    </>
  );
}

// ===========================================================================
// Stub minimal pour les ~2 156 villes sans copy éditorial.
// Anti-doorway HCU 2024 : la page existe physiquement (SSG, accessible aux
// visiteurs qui tomberaient dessus via lien interne) mais porte
// `<meta robots="noindex">` (cf. generateMetadata) et n'apparaît pas dans
// le sitemap (cf. buildImplantationsSitemap qui filtre sur getIndexableVilles).
// Le contenu est sciemment minimal — pas de FAQ génériques copiées-collées,
// pas de wall-of-text — pour éviter de polluer le crawl si un humain l'ouvre.
// ===========================================================================
interface VilleStubProps {
  ville: Ville;
  regionNameFr: string;
  regionSlug: string;
  breadcrumbItems: ReadonlyArray<{ href: string; label: string }>;
  isFr: boolean;
}
function VilleStub({ ville, regionNameFr, regionSlug, breadcrumbItems, isFr }: VilleStubProps) {
  return (
    <Section
      titleAs="h1"
      eyebrow={isFr ? `Implantations · ${regionNameFr}` : `Locations · ${regionNameFr}`}
      title={isFr ? "Axion-IA intervient Ã " : "Axion-IA covers"}
      titleEm={ville.nameFr}
      description={
        isFr
          ? `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) fait partie des ${fmtPopulation(ville.population, "fr")} habitants éligibles Ã  nos interventions sur site, audits IA et missions d'implémentation. La page locale détaillée est en préparation — réservez dès maintenant via la page régionale.`
          : `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) is part of the ${fmtPopulation(ville.population, "en")} inhabitants eligible to our on-site engagements, AI audits and implementation missions. The detailed local page is in preparation — book now via the regional page.`
      }
    >
      <div className="mb-8">
        <Breadcrumbs items={breadcrumbItems} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Cta
          href={`/implantations/${regionSlug}` as never}
          variant="primary"
          size="lg"
          shape="pill"
          track="ville_stub_back_region"
        >
          {isFr ? `Voir la région ${regionNameFr}` : `See the ${regionNameFr} region`}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Cta>
        <Cta
          href={`/reserver?ville=${ville.slug}` as never}
          variant="ghost"
          size="lg"
          shape="pill"
          track="ville_stub_book"
          data-source-ville={ville.slug}
        >
          {isFr
            ? `Réserver une intervention · ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}`
            : `Book an engagement · ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}`}
        </Cta>
      </div>
    </Section>
  );
}
