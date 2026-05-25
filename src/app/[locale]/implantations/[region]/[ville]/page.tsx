import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowUpRight, ArrowRight, MapPin, Star, Shield, Users, Check } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { fmtPopulation } from "@/lib/intl";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { VilleHeroSchema } from "@/components/sections/VilleHeroSchema";
import { VilleServiceDetailSection } from "@/components/sections/VilleServiceDetailSection";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { FadeInOnView } from "@/components/motion/FadeInOnView";
import { LogosMarquee } from "@/components/home/LogosMarquee";
import { Illustration } from "@/components/visual/Illustration";
import { CaseStudyMarquee } from "@/components/ville/CaseStudyMarquee";
import { OrangeContactBanner } from "@/components/ville/OrangeContactBanner";
import { AiToolsStack } from "@/components/ville/AiToolsStack";

import { getRegion } from "@/content/regions";
import { VILLES, type Ville } from "@/content/villes";
import { resolveVilleWithCopy } from "@/content/villes/resolve-with-copy";
import { getNearbyVilles, getNearbyCases } from "@/lib/geo";
import { CLIENT_LOGOS, SECTORS } from "@/content/home-data";
import { CASE_STUDIES } from "@/content/case-studies";
import {
  AUDIT_TIERS,
  INTERVENTION_TIERS,
  IMPLEMENTATION_TIERS,
  UN_A_UN_TIERS,
  formatAmount,
  getEntryPriceEur,
  getTierById,
} from "@/content/pricing";
import {
  buildProductMetadata,
  buildItemListJsonLd,
  buildLocalBusinessJsonLd,
  buildPlaceJsonLd,
  buildFaqSpeakableJsonLd,
  buildBreadcrumbJsonLd,
  buildServiceJsonLd,
  SITE_URL,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; region: string; ville: string }>;
}

export function generateStaticParams(): Array<{ region: string; ville: string }> {
  return VILLES.map((v) => ({ region: v.region, ville: v.slug }));
}

// P1-13 (audit re-run 2026-05-15) — ISR sur pages villes pSEO (~2150 routes).
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, region: regionSlug, ville: villeSlug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  // Résolution avec fallback DB (Sprint VilleCopy generator 2026-05-24).
  const ville = await resolveVilleWithCopy(villeSlug);
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

  // Description ≤ 155 chars (cible Google SERP — au-delà → tronqué). Le pitchFr/directAnswerFr
  // peut être plus long (jusqu'à 850 chars Zod) → on truncate proprement à 155 chars.
  const truncateForSerp = (s: string, max = 155): string => {
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > max * 0.7 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
  };
  const rawDescription = isPilot
    ? isFr
      ? (ville.copy?.directAnswerFr ?? ville.copy?.pitchFr ?? "")
      : (ville.copy?.directAnswerEn ?? ville.copy?.pitchEn ?? "")
    : isFr
      ? `Axion-IA intervient à ${ville.nameFr} (${region.nameFr}). Audit IA Flash dès ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "fr")}, intervention sur site 1 journée, implémentation IA. Réservation directe en ligne.`
      : `Axion-IA operates in ${ville.nameFr} (${region.nameFr}). Flash AI audit from ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "en")}, 1-day on-site session, AI implementation. Direct online booking.`;
  const description = truncateForSerp(rawDescription, 155);

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
  if (!isPilot) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

export default async function VillePage({ params }: Props) {
  const { locale, region: regionSlug, ville: villeSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Résolution avec fallback DB (Sprint VilleCopy generator 2026-05-24).
  const ville = await resolveVilleWithCopy(villeSlug);
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

  // ---- Pages avec copy : rendu gold standard ----
  const copy = ville.copy;
  const nearbyVilles = getNearbyVilles(ville.geo, 8, {
    excludeSlug: ville.slug,
    sameRegion: ville.region,
  });
  const nearbyCases = getNearbyCases(ville.geo, 50, 3);

  // Témoignages ville : priorité aux cas proches (Haversine), complétés par global
  const testimonials = (() => {
    const seen = new Set<string>();
    const result: (typeof CASE_STUDIES)[number][] = [];
    for (const { caseStudy } of nearbyCases) {
      if (!seen.has(caseStudy.slug) && caseStudy[loc].testimonialQuote) {
        seen.add(caseStudy.slug);
        result.push(caseStudy);
      }
    }
    for (const c of CASE_STUDIES) {
      if (result.length >= 6) break;
      if (!seen.has(c.slug) && c[loc].testimonialQuote) {
        seen.add(c.slug);
        result.push(c);
      }
    }
    return result;
  })();

  // Prix dérivés du SSOT pricing.ts
  const interventionEntryPrice = formatAmount(getEntryPriceEur(INTERVENTION_TIERS) ?? 0, loc, {
    compact: true,
  });
  const auditEntryPrice = formatAmount(getEntryPriceEur(AUDIT_TIERS) ?? 0, loc, { compact: true });
  const implEntryPrice = formatAmount(getEntryPriceEur(IMPLEMENTATION_TIERS) ?? 0, loc, {
    compact: true,
  });
  const unAUnEntryPrice = formatAmount(getEntryPriceEur(UN_A_UN_TIERS) ?? 0, loc, {
    compact: true,
  });

  // 5 solutions — style home, textes adaptés à la ville
  const citySolutions = [
    {
      id: "intervene",
      emoji: "🎓",
      shortNameFr: "Formations",
      shortNameEn: "Training",
      taglineFr: "IA en entreprise",
      taglineEn: "AI for companies",
      headlineFr:
        copy.servicesContext?.interventions?.fr ??
        `Ateliers IA sur site à ${ville.nameFr} — demi-journée à 2 jours. Sur vos données réelles, avec vos équipes. Aucun scénario générique.`,
      headlineEn:
        copy.servicesContext?.interventions?.en ??
        `On-site AI workshops in ${ville.nameFr} — half-day to 2 days. On your real data, with your teams. Nothing generic.`,
      priceLabelFr: `À partir de ${interventionEntryPrice} HT`,
      priceLabelEn: `From ${interventionEntryPrice} excl. tax`,
      // Sprint Quality 2026 P0-B Will 2026-05-25 — pointer vers la verticale LOCALE
      // /implantations/[region]/[ville]/interventions (au lieu de la page globale /interventions)
      // pour internal linking SEO + découverte verticales par crawler depuis le hub.
      href: `/implantations/${region.slug}/${ville.slug}/interventions` as never,
    },
    {
      id: "coach",
      emoji: "🧑‍💼",
      shortNameFr: "1-to-1",
      shortNameEn: "1-to-1",
      taglineFr: "Coaching individuel",
      taglineEn: "Personal coaching",
      headlineFr:
        copy.servicesContext?.unAUn?.fr ??
        `Journée 1-to-1 avec William J. à ${ville.nameFr} — cartographie IA de vos processus et 3 chantiers chiffrés, sans engagement.`,
      headlineEn:
        copy.servicesContext?.unAUn?.en ??
        `1-on-1 day with William J. in ${ville.nameFr} — AI mapping of your processes and 3 costed projects, no commitment.`,
      priceLabelFr: `À partir de ${unAUnEntryPrice} HT`,
      priceLabelEn: `From ${unAUnEntryPrice} excl. tax`,
      href: `/implantations/${region.slug}/${ville.slug}/un-a-un` as never,
    },
    {
      id: "audit",
      emoji: "🔍",
      shortNameFr: "Audits",
      shortNameEn: "Audits",
      taglineFr: "Diagnostic & roadmap",
      taglineEn: "Diagnosis & roadmap",
      headlineFr:
        copy.servicesContext?.audit?.fr ??
        `Audit IA Flash à ${ville.nameFr} — diagnostic process 4h, gains chiffrés, roadmap 6 mois. Résultat le jour même.`,
      headlineEn:
        copy.servicesContext?.audit?.en ??
        `Flash AI audit in ${ville.nameFr} — 4h process diagnosis, quantified gains, 6-month roadmap. Same-day result.`,
      priceLabelFr: `À partir de ${auditEntryPrice} HT`,
      priceLabelEn: `From ${auditEntryPrice} excl. tax`,
      href: `/implantations/${region.slug}/${ville.slug}/audits` as never,
    },
    {
      id: "implement",
      emoji: "⚙️",
      shortNameFr: "Implémentations",
      shortNameEn: "Implementation",
      taglineFr: "Automatisations sur mesure",
      taglineEn: "Custom automation",
      headlineFr:
        copy.servicesContext?.implementation?.fr ??
        `Agents IA, automatisations back-office, CRM/ERP augmentés — livrés en production à ${ville.nameFr}. ROI chiffré avant mission.`,
      headlineEn:
        copy.servicesContext?.implementation?.en ??
        `AI agents, back-office automations, augmented CRM/ERP — delivered to production in ${ville.nameFr}. Costed ROI before engagement.`,
      priceLabelFr: `À partir de ${implEntryPrice} HT`,
      priceLabelEn: `From ${implEntryPrice} excl. tax`,
      href: `/implantations/${region.slug}/${ville.slug}/implementations` as never,
    },
    {
      id: "web",
      emoji: "🌐",
      shortNameFr: "Plateforme web & SaaS",
      shortNameEn: "Web platform & SaaS",
      taglineFr: "Sites web & SaaS augmentés IA",
      taglineEn: "AI-augmented websites & SaaS",
      headlineFr: `Sites web, applications métier et plateformes SaaS augmentées par l'IA — conçus pour vos clients à ${ville.nameFr} et en France.`,
      headlineEn: `Websites, business apps and AI-augmented SaaS platforms — built for your clients in ${ville.nameFr} and across France.`,
      priceLabelFr: `À partir de ${implEntryPrice} HT`,
      priceLabelEn: `From ${implEntryPrice} excl. tax`,
      href: `/implantations/${region.slug}/${ville.slug}/sites-web-ia` as never,
    },
  ];

  // 4 segments audience — adaptés à la ville + région
  const audienceSegments = [
    {
      id: "tpe",
      titleFr: "TPE & artisans",
      titleEn: "Micro-businesses",
      leadFr: "Premier outil IA rentable sous 4 semaines.",
      leadEn: "First AI tool profitable within 4 weeks.",
      detailFr: `À ${ville.nameFr}, une TPE peut automatiser sa relance clients, sa facturation ou sa gestion planning IA en moins d'un mois — sans développeur, sans abonnement SaaS supplémentaire.`,
      detailEn: `In ${ville.nameFr}, a micro-business can automate client follow-ups, billing or AI scheduling in under a month — no developer, no extra SaaS subscription.`,
    },
    {
      id: "pme",
      titleFr: "PME 10–250 salariés",
      titleEn: "SMBs 10–250 employees",
      leadFr: "Processus métier automatisés. ROI mesuré.",
      leadEn: "Business processes automated. Measured ROI.",
      detailFr: `Audit de vos processus, identification des 3 chantiers IA prioritaires, implémentation clés en main. Axion-IA livre à ${ville.nameFr} les mêmes standards partout en France — prix identiques, même équipe nationale.`,
      detailEn: `Process audit, 3 priority AI projects identified, turnkey implementation. Axion-IA delivers in ${ville.nameFr} the same standards as anywhere in France — same pricing, same national team.`,
    },
    {
      id: "eti",
      titleFr: "ETI & groupes",
      titleEn: "Mid-market & groups",
      leadFr: "Transformation IA multi-sites, multi-équipes.",
      leadEn: "Multi-site, multi-team AI transformation.",
      detailFr: `Déploiement progressif, formation managers + opérationnels, intégration CRM/ERP existants. Nous intervenons sur vos sites en région ${region.nameFr} et partout en France.`,
      detailEn: `Progressive deployment, manager + operational training, existing CRM/ERP integration. We operate at your sites in ${region.nameFr} and across France.`,
    },
    {
      id: "large",
      titleFr: "Grandes entreprises",
      titleEn: "Large enterprises",
      leadFr: "Pilotes IA cadrés, conformité AI Act.",
      leadEn: "Scoped AI pilots, AI Act compliance.",
      detailFr: `Gouvernance IA, pilotes sur cas métier précis, conformité réglementaire UE. Axion-IA est un partenaire indépendant sans conflit d'intérêt éditeur.`,
      detailEn: `AI governance, pilots on specific business cases, EU regulatory compliance. Axion-IA is an independent partner with no vendor conflict of interest.`,
    },
  ];

  // ---- JSON-LD stack — 8 schemas page-level ----
  const path = `/implantations/${region.slug}/${ville.slug}` as `/${string}`;
  const url = `${SITE_URL}/${loc}${path}`;
  const cityWikiUrl = `https://fr.wikipedia.org/wiki/${encodeURIComponent(ville.nameFr.replace(/ /g, "_"))}`;

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path,
    name: isFr
      ? `Cabinet IA opérationnel à ${ville.nameFr} · Axion-IA`
      : `Operational AI consultancy in ${ville.nameFr} · Axion-IA`,
    description: isFr ? copy.pitchFr : copy.pitchEn,
    serviceType: isFr ? "Cabinet IA opérationnel B2B" : "Operational B2B AI consultancy",
    areasServed: [
      { type: "City", name: ville.nameFr, url },
      {
        type: "AdministrativeArea",
        name: region.nameFr,
        url: `${SITE_URL}/${loc}/${isFr ? "implantations" : "locations"}/${region.slug}`,
      },
      { type: "Country", name: "France" },
    ],
  });

  // Service Area Business safe — pas de bureau physique par ville (ADR 0026)
  const localBusinessJsonLd = buildLocalBusinessJsonLd({
    locale: loc,
    path,
    name: isFr
      ? `Axion-IA · cabinet IA opérationnel à ${ville.nameFr}`
      : `Axion-IA · operational AI consultancy in ${ville.nameFr}`,
    description: isFr ? copy.pitchFr : copy.pitchEn,
    areaServed: { type: "City", name: ville.nameFr },
    address: { city: ville.nameFr, region: region.nameFr, country: "FR" },
  });

  const placeJsonLd = buildPlaceJsonLd({
    locale: loc,
    path,
    name: ville.nameFr,
    geo: { latitude: ville.geo.lat, longitude: ville.geo.lon },
    containedInPlace: {
      name: region.nameFr,
      url: `${SITE_URL}/${loc}/${isFr ? "implantations" : "locations"}/${region.slug}`,
    },
    population: ville.population,
  });

  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Implantations" : "Locations", href: "/implantations" },
      { name: region.nameFr, href: `/implantations/${region.slug}` },
      { name: ville.nameFr, href: path },
    ],
  });

  // `additionalSelectors` étend Speakable au hero (directAnswer visible par voice search
  // AVANT les Q+R). Même pattern que la home (cf. buildFaqSpeakableJsonLd §additionalSelectors).
  const faqSpeakableJsonLd = copy.faqGeolocalisee?.length
    ? buildFaqSpeakableJsonLd({
        items: copy.faqGeolocalisee.map((f) => ({ question: f.q, answer: f.a })),
        additionalSelectors: ["[data-speakable-hero]"],
      })
    : null;

  const personManonJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/fr/equipe/manon#person`,
    name: "Manon",
    jobTitle: isFr ? "Plume éditoriale Axion-IA" : "Editorial voice Axion-IA",
    url: `${SITE_URL}/fr/equipe/manon`,
    worksFor: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Axion-IA" },
    knowsAbout: isFr
      ? [
          "Intelligence artificielle en entreprise",
          "Audit IA",
          "Implantations locales France",
          "Transformation numérique PME",
        ]
      : ["Enterprise AI", "AI audit", "France local presence", "SME digital transformation"],
    knowsLanguage: ["fr-FR"],
    aiGenerated: true,
    additionalType: "https://schema.org/AIGeneratedContent",
    disambiguatingDescription: isFr
      ? "Persona éditoriale Axion-IA. Portrait généré par IA, contenus IA-assistés supervisés par l'équipe Axion-IA (AI Act EU art. 50)."
      : "Axion-IA editorial persona. AI-generated portrait, AI-assisted content supervised by the Axion-IA team (EU AI Act art. 50).",
  } as const;

  const directAnswerText = isFr
    ? (copy.directAnswerFr ?? copy.pitchFr)
    : (copy.directAnswerEn ?? copy.pitchEn);
  const abstractText =
    directAnswerText.length > 160 ? directAnswerText.slice(0, 157) + "…" : directAnswerText;
  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: isFr
      ? `Cabinet IA opérationnel à ${ville.nameFr} · Axion-IA`
      : `Operational AI consultancy in ${ville.nameFr} · Axion-IA`,
    abstract: abstractText,
    alternativeHeadline: `Axion-IA ${ville.nameFr}`,
    description: (isFr ? copy.pitchFr : copy.pitchEn).slice(0, 300),
    inLanguage: loc,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: [
      { "@type": "City", name: ville.nameFr, sameAs: cityWikiUrl },
      { "@type": "AdministrativeArea", name: region.nameFr },
    ],
    breadcrumb: { "@id": `${url}#breadcrumb` },
    primaryImageOfPage: `${SITE_URL}/opengraph-image`,
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/${loc}/appel?ville=${ville.slug}`,
      },
      result: {
        "@type": "Reservation",
        name: isFr
          ? `Réservation intervention IA à ${ville.nameFr}`
          : `AI engagement booking in ${ville.nameFr}`,
      },
    },
  } as const;

  const nearbyItemList =
    nearbyVilles.length > 0
      ? buildItemListJsonLd({
          locale: loc,
          path,
          name: isFr ? `Villes proches de ${ville.nameFr}` : `Cities near ${ville.nameFr}`,
          items: nearbyVilles.map(({ ville: v }, idx) => ({
            position: idx + 1,
            name: v.nameFr,
            url: `${SITE_URL}/${loc}/${isFr ? "implantations" : "locations"}/${v.region}/${v.slug}`,
          })),
        })
      : null;

  const faqItems =
    copy.faqGeolocalisee?.map((f, idx) => ({
      id: `${ville.slug}-faq-${idx}`,
      question: f.q,
      answer: f.a,
    })) ?? [];

  const unsplashPhotos = [
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=faces&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces&q=80",
    "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&h=200&fit=crop&crop=faces&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces&q=80",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=faces&q=80",
  ] as const;

  return (
    <>
      {/* ── 1. HERO localisé ── */}
      <section className="bg-halo-warm relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div>
              <div className="mb-8">
                <Breadcrumbs items={breadcrumbItems} emitJsonLd={false} />
              </div>
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? `Implantations · ${region.nameFr}` : `Locations · ${region.nameFr}`}
              </p>
              <h1 className="display-editorial text-fg">
                {isFr ? "Cabinet IA opérationnel à" : "Operational AI consultancy in"}{" "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {ville.nameFr}
                </span>
                {isFr
                  ? ` et alentours (${ville.departementLabel ?? ville.departement}).`
                  : ` and surroundings (${ville.departementLabel ?? ville.departement}).`}
              </h1>
              <p
                className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
                itemProp="text"
                data-speakable-hero
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
                  href="/appel"
                  variant="primary"
                  size="lg"
                  shape="pill"
                  track="ville_cta_book"
                  data-source-ville={ville.slug}
                >
                  {isFr ? "Réserver un appel" : "Book a call"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta
                  href="/contact"
                  variant="ghost"
                  size="lg"
                  shape="pill"
                  track="ville_cta_contact"
                  data-source-ville={ville.slug}
                >
                  {isFr ? "Nous contacter" : "Contact us"}
                </Cta>
                <Cta
                  href="/cas-concrets"
                  variant="ghost"
                  size="lg"
                  shape="pill"
                  track="ville_cta_realisations"
                  data-source-ville={ville.slug}
                >
                  {isFr ? "Voir nos réalisations" : "Our case studies"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
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

      {/* ── 2. LES 5 SOLUTIONS — identique home, textes adaptés ville ── */}
      <section
        id="services"
        aria-labelledby="services-heading"
        className="bg-paper relative py-20 sm:py-24 lg:py-28"
      >
        <Container>
          <FadeInOnView>
            <div className="mx-auto mb-14 max-w-5xl text-center">
              <p className="text-terracotta mb-5 text-sm font-bold tracking-[0.2em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-2 w-2 rounded-full align-middle" />
                {isFr ? "Nos 5 services à" : "Our 5 services in"} {ville.nameFr}
              </p>
              <h2
                id="services-heading"
                className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
              >
                {isFr ? "Le cabinet IA opérationnel" : "The operational AI consultancy"}{" "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? `top 1 % à ${ville.nameFr}.` : `top 1 % in ${ville.nameFr}.`}
                </span>
              </h2>
              <p className="text-fg-soft mx-auto mt-6 max-w-3xl text-lg leading-relaxed">
                {isFr
                  ? `5 services — formation, coaching 1-to-1, audit, implémentation, plateforme web. Tarifs publics, calendrier temps réel, vos données restent chez vous. Standard d'exécution premium, livrables documentés, impact mesuré.`
                  : `5 services — training, 1-to-1 coaching, audit, implementation, web platform. Public pricing, real-time calendar, your data stays yours. Premium execution standard, documented deliverables, measured impact.`}
              </p>
            </div>
          </FadeInOnView>

          <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4 lg:grid-cols-5">
            {citySolutions.map((v, idx) => (
              <FadeInOnView key={v.id} delay={idx * 80}>
                <li className="h-full">
                  <Link
                    href={v.href}
                    className="group bg-paper border-border hover:border-terracotta hover:shadow-elevated focus-visible:ring-terracotta relative flex h-full flex-col overflow-hidden rounded-2xl border-2 p-6 transition-all duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:p-7"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-terracotta absolute inset-x-0 top-0 h-1.5 origin-left transition-transform duration-300"
                    />
                    <span
                      className="bg-terracotta-soft mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full text-3xl transition-transform duration-300 group-hover:scale-110"
                      aria-hidden="true"
                    >
                      {v.emoji}
                    </span>
                    <h3
                      className="text-fg text-[clamp(1.75rem,2.5vw,2.5rem)] leading-[1.02] font-semibold tracking-tight"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {isFr ? v.shortNameFr : v.shortNameEn}
                    </h3>
                    <p className="text-terracotta mt-1 text-sm font-semibold tracking-tight">
                      {isFr ? v.taglineFr : v.taglineEn}
                    </p>
                    <p className="text-fg-soft mt-4 text-sm leading-relaxed">
                      {isFr ? v.headlineFr : v.headlineEn}
                    </p>
                    <p
                      className="text-fg mt-5 text-base font-bold tracking-tight"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {isFr ? v.priceLabelFr : v.priceLabelEn}
                    </p>
                    <div className="flex-1" />
                    <span className="border-border text-terracotta group-hover:border-terracotta group-hover:text-terracotta-deep mt-6 inline-flex items-center gap-2 border-t pt-4 text-sm font-semibold transition-colors">
                      {isFr ? "Découvrir le service" : "Discover the service"}
                      <ArrowRight
                        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              </FadeInOnView>
            ))}
          </ul>
        </Container>
      </section>

      {/* ── 3. LOGOS MARQUES PARTENAIRES ── */}
      <section
        aria-label={isFr ? "Ils nous font confiance" : "They trust us"}
        className="bg-bg border-border border-t border-b py-12 sm:py-16"
      >
        <Container>
          <LogosMarquee logos={CLIENT_LOGOS} />
        </Container>
      </section>

      {/* ── 4. BLOC 4 PHOTOS — réalisations Axion-IA ── */}
      <section className="bg-paper py-16 sm:py-20">
        <Container>
          <FadeInOnView>
            <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                  <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  {isFr ? "Réalisations · impact mesuré" : "Case studies · measured impact"}
                </p>
                <h2
                  className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "Des implémentations" : "Best-in-class"}{" "}
                  <span className="italic-editorial text-terracotta">
                    {isFr ? "qui font la différence." : "implementations."}
                  </span>
                </h2>
              </div>
              <Link
                href="/cas-concrets"
                className="text-primary inline-flex items-center gap-2 text-sm font-semibold hover:underline"
              >
                {isFr ? "Voir tous les cas" : "View all cases"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <CaseStudyMarquee
              isFr={isFr}
              items={[
                {
                  src: "/images/axion-ia-pipeline-lead-ia-zero-intervention-humaine-7-etapes-banniere.avif",
                  industryFr: "Prospection B2B",
                  industryEn: "B2B prospecting",
                  metric: "0 min/lead",
                  titleFr: "Pipeline lead automatisé · 7 étapes",
                  titleEn: "Automated lead pipeline · 7 steps",
                  altFr: "Pipeline Axion-IA : 7 étapes automatisées du formulaire entrant au CRM.",
                  altEn: "Axion-IA pipeline: 7 automated steps from incoming form to CRM.",
                },
                {
                  src: "/images/axion-ia-recrutement-ia-8-semaines-a-3-semaines-80-pourcent-automatise-banniere.avif",
                  industryFr: "Ressources humaines",
                  industryEn: "Human resources",
                  metric: "8 sem → 3 sem · 80% auto",
                  titleFr: "Recrutement IA · cycle divisé par 2,5",
                  titleEn: "AI recruitment · cycle divided by 2.5",
                  altFr: "Recrutement automatisé Axion-IA : 8 semaines → 3 semaines.",
                  altEn: "Axion-IA automated recruitment: 8 weeks → 3 weeks.",
                },
                {
                  src: "/images/axion-ia-gestion-factures-comptabilite-capture-extraction-validation-ia-banniere.avif",
                  industryFr: "Finance & compta",
                  industryEn: "Finance & accounting",
                  metric: "0 saisie manuelle",
                  titleFr: "Gestion factures · OCR + validation IA",
                  titleEn: "Invoice management · OCR + AI validation",
                  altFr:
                    "Gestion factures Axion-IA : capture OCR + validation IA, zéro saisie manuelle.",
                  altEn:
                    "Axion-IA invoice management: OCR capture + AI validation, zero manual entry.",
                },
                {
                  src: "/images/axion-ia-planning-chantier-gantt-ia-conflits-detectes-temps-reel-banniere.avif",
                  industryFr: "BTP & construction",
                  industryEn: "Construction",
                  metric: "Conflits détectés J-7",
                  titleFr: "Planning Gantt IA · temps réel",
                  titleEn: "AI Gantt planning · real-time",
                  altFr:
                    "Planning Gantt Axion-IA : conflits de ressources détectés automatiquement.",
                  altEn: "Axion-IA Gantt planning: automatically detected resource conflicts.",
                },
                {
                  src: "/images/axion-ia-prevision-tresorerie-90-jours-zero-saisie-zero-surprise-banniere.avif",
                  industryFr: "Trésorerie",
                  industryEn: "Treasury",
                  metric: "Prévision J+90",
                  titleFr: "Prévision trésorerie · 90 jours",
                  titleEn: "Cash forecast · 90 days",
                  altFr: "Prévision trésorerie Axion-IA : projection J+90 sans saisie manuelle.",
                  altEn: "Axion-IA cash forecast: D+90 projection, no manual entry.",
                },
                {
                  src: "/images/axion-ia-onboarding-rh-j-5-j90-90-pourcent-automatise-collaborateur-banniere.avif",
                  industryFr: "RH onboarding",
                  industryEn: "HR onboarding",
                  metric: "90% automatisé",
                  titleFr: "Onboarding RH · J-5 à J+90",
                  titleEn: "HR onboarding · D-5 to D+90",
                  altFr: "Onboarding collaborateur Axion-IA : automatisation 90% de J-5 à J+90.",
                  altEn: "Axion-IA employee onboarding: 90% automation from D-5 to D+90.",
                },
                {
                  src: "/images/axion-ia-reporting-executif-ca-1248000-euros-marge-leads-ia-banniere.avif",
                  industryFr: "Reporting exécutif",
                  industryEn: "Executive reporting",
                  metric: "KPIs temps réel",
                  titleFr: "Reporting exécutif · CA + marge + leads",
                  titleEn: "Executive reporting · revenue + margin + leads",
                  altFr:
                    "Reporting exécutif Axion-IA : CA, marge et leads consolidés en temps réel.",
                  altEn: "Axion-IA executive reporting: revenue, margin and leads in real-time.",
                },
                {
                  src: "/images/axion-ia-architecture-groupe-international-consolidation-financiere-rh-banniere.avif",
                  industryFr: "Groupe international",
                  industryEn: "International group",
                  metric: "3 sem → J+1",
                  titleFr: "Consolidation groupe 4 pays · IA continue",
                  titleEn: "4-country group consolidation · continuous AI",
                  altFr:
                    "Architecture groupe international Axion-IA : 4 entités, consolidation J+1.",
                  altEn:
                    "Axion-IA international group architecture: 4 entities, D+1 consolidation.",
                },
                {
                  src: "/images/axion-ia-crm-scoring-contacts-action-automatique-bon-moment-banniere.avif",
                  industryFr: "CRM augmenté",
                  industryEn: "Augmented CRM",
                  metric: "Action au bon moment",
                  titleFr: "CRM scoring IA · relance contextuelle",
                  titleEn: "AI CRM scoring · contextual follow-up",
                  altFr:
                    "CRM scoring Axion-IA : action automatique au bon moment sur chaque contact.",
                  altEn:
                    "Axion-IA CRM scoring: automatic action at the right moment for each contact.",
                },
                {
                  src: "/images/axion-ia-traitement-reclamations-312-semaine-4-minutes-ia-banniere.avif",
                  industryFr: "Support client",
                  industryEn: "Customer support",
                  metric: "312/sem · 4 min",
                  titleFr: "Traitement réclamations · IA pré-résolutive",
                  titleEn: "Complaint handling · pre-solving AI",
                  altFr: "Traitement réclamations Axion-IA : 312 par semaine en 4 minutes chacune.",
                  altEn: "Axion-IA complaint handling: 312/week in 4 minutes each.",
                },
              ]}
            />
          </FadeInOnView>
        </Container>
      </section>

      {/* ── 5. WILLIAMS J. — déplacement dans la ville et alentours ── */}
      <section
        id="fondateur"
        aria-labelledby="fondateur-heading"
        className="bg-paper border-border border-t py-20 sm:py-24 lg:py-28"
      >
        <Container>
          <FadeInOnView>
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="max-w-xl">
                <p className="text-fg-muted mb-6 text-[12px] font-semibold tracking-[0.2em] uppercase">
                  <span className="bg-terracotta mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  {isFr ? `Le fondateur · ${ville.nameFr}` : `The founder · ${ville.nameFr}`}
                </p>
                <h2
                  id="fondateur-heading"
                  className="text-fg text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.02] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "William J. assure" : "William J. personally delivers"}
                  <br />
                  <span className="text-terracotta italic">
                    {isFr ? "la majorité de nos formations IA" : "most of our AI training sessions"}
                  </span>
                </h2>
                <p className="text-fg-soft mt-7 text-lg leading-relaxed">
                  {isFr
                    ? `William J., fondateur d'Axion-IA, conduit lui-même la majorité des interventions à ${ville.nameFr}${
                        nearbyVilles.length > 0
                          ? ` et dans les communes alentours : ${nearbyVilles
                              .slice(0, 4)
                              .map((nv) => nv.ville.nameFr)
                              .join(", ")}${nearbyVilles.length > 4 ? "…" : ""}`
                          : ""
                      }. Une équipe d'experts seniors triés sur le volet le seconde — même exigence de perfection, même standard d'excellence, aucun consultant junior sur vos missions. Chaque intervention est conduite sur site, chez vous — jamais en visio.`
                    : `William J., Axion-IA founder, personally leads the majority of engagements in ${ville.nameFr}${
                        nearbyVilles.length > 0
                          ? ` and surrounding areas: ${nearbyVilles
                              .slice(0, 4)
                              .map((nv) => nv.ville.nameFr)
                              .join(", ")}${nearbyVilles.length > 4 ? "…" : ""}`
                          : ""
                      }. An expert team of hand-picked senior consultants supports him — same pursuit of perfection, same standard of excellence, never a junior consultant on your engagements. Every engagement is conducted on-site, at your premises — never on video calls.`}
                </p>
                <div className="border-border-strong mt-8 flex items-start gap-4 border-t pt-6">
                  <span className="bg-terracotta mt-1 inline-block h-6 w-0.5 shrink-0 rounded-full" />
                  <p
                    className="text-fg-soft text-base leading-relaxed italic"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr
                      ? `"L'IA n'a de valeur que si vos équipes la maîtrisent. Mes interventions à ${ville.nameFr} transmettent une autonomie réelle : vos collaborateurs montent en compétence pendant la formation, et délivrent un premier gain opérationnel dès le lendemain."`
                      : `"AI only delivers value if your teams master it. My engagements in ${ville.nameFr} transmit real autonomy: your teams build skills during training and deliver their first operational gain by the next day."`}
                  </p>
                </div>
              </div>

              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-xs">
                  <Illustration
                    slot="HOME-04-founder"
                    src="/illustrations/home-founder-william.avif"
                    aspectRatio="4:5"
                    filenameTarget="public/illustrations/home-founder-william.avif"
                    caption={
                      isFr
                        ? "William J. — Fondateur & CEO Axion-IA"
                        : "William J. — Founder & CEO Axion-IA"
                    }
                    figcaption={
                      isFr
                        ? "William J. — Fondateur & CEO Axion-IA"
                        : "William J. — Founder & CEO Axion-IA"
                    }
                    alt={
                      isFr
                        ? "Portrait de William J., fondateur & CEO d'Axion-IA, cabinet IA opérationnel français."
                        : "Portrait of William J., founder & CEO of Axion-IA, French operational AI consultancy."
                    }
                  />
                  <div className="mt-4 text-center">
                    <p className="text-fg text-lg font-semibold">William J.</p>
                    <p className="text-fg-muted text-sm">
                      {isFr ? "Fondateur & CEO · Axion-IA" : "Founder & CEO · Axion-IA"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats bar */}
            <div
              className="border-border-strong mt-16 grid grid-cols-3 divide-x border-t pt-10"
              style={{ borderColor: "var(--color-border-strong)" }}
            >
              {(
                [
                  {
                    numberFr: "Top 1 %",
                    numberEn: "Top 1 %",
                    labelFr: "experts IA B2B en France",
                    labelEn: "AI B2B experts in France",
                  },
                  {
                    numberFr: "Dès le lendemain",
                    numberEn: "From day +1",
                    labelFr: "premier livrable opérationnel",
                    labelEn: "first operational deliverable",
                  },
                  {
                    numberFr: "Gains < 30 jours",
                    numberEn: "Gains < 30 days",
                    labelFr: "temps économisé et coûts évités, mesurés sur vos process",
                    labelEn: "time saved and costs avoided, measured on your processes",
                  },
                ] as const
              ).map((stat, idx) => (
                <div key={idx} className="flex flex-col gap-1 px-6 first:pl-0 last:pr-0">
                  <span
                    className="text-fg text-[clamp(1.25rem,2.5vw,1.75rem)] leading-tight font-semibold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? stat.numberFr : stat.numberEn}
                  </span>
                  <span className="text-fg-soft text-sm leading-snug">
                    {isFr ? stat.labelFr : stat.labelEn}
                  </span>
                </div>
              ))}
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ── 5b. TISSU ÉCONOMIQUE LOCAL — données INSEE uniques (anti-doorway HCU 2024) ── */}
      {(copy.ecosystemFr ?? copy.topSectorsNaf?.length ?? copy.distancesFr) ? (
        <section
          aria-labelledby="ecosystem-heading"
          className="bg-bg border-border border-t py-12 sm:py-16"
        >
          <Container>
            <div className="grid gap-8 lg:grid-cols-3 lg:gap-12">
              {(copy.ecosystemFr ?? copy.distancesFr) ? (
                <div className="lg:col-span-2">
                  <h2
                    id="ecosystem-heading"
                    className="text-fg text-xl leading-tight font-semibold tracking-tight"
                  >
                    {isFr
                      ? `Tissu économique · ${ville.nameFr}`
                      : `Economic landscape · ${ville.nameFr}`}
                  </h2>
                  {(isFr ? copy.ecosystemFr : copy.ecosystemEn) ? (
                    <p className="text-fg-soft mt-4 text-base leading-relaxed">
                      {isFr ? copy.ecosystemFr : copy.ecosystemEn}
                    </p>
                  ) : null}
                  {(isFr ? copy.distancesFr : copy.distancesEn) ? (
                    <p className="text-fg-muted mt-3 flex items-start gap-2 text-sm">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {isFr ? copy.distancesFr : copy.distancesEn}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {copy.topSectorsNaf?.length ? (
                <div>
                  <h3 className="text-fg-muted text-sm font-semibold tracking-[0.14em] uppercase">
                    {isFr ? "Secteurs B2B présents" : "B2B sectors"}
                  </h3>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {copy.topSectorsNaf.map((sector) => (
                      <li
                        key={sector}
                        className="bg-terracotta-soft text-terracotta-deep inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                      >
                        {sector}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Container>
        </section>
      ) : null}

      {/* ── 5b-bis. BANDEAU ORANGE CONTACT (milieu de page — Sprint Quality 2026 Will 2026-05-25) ── */}
      <OrangeContactBanner isFr={isFr} villeSlug={ville.slug} />

      {/* ── 5c. SOURCES D'AUTORITÉ — external links E-E-A-T 2026 ── */}
      <section
        aria-label={isFr ? "Sources d'autorité" : "Authority sources"}
        className="bg-bg border-border border-t py-12 sm:py-16"
      >
        <Container>
          <div className="mx-auto max-w-4xl">
            <p className="text-fg-muted mb-4 text-[13px] font-medium tracking-[0.16em] uppercase">
              <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
              {isFr ? "Sources d'autorité" : "Authority sources"}
            </p>
            <h2
              className="text-fg text-[clamp(1.5rem,3vw,2rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "Références institutionnelles" : "Institutional references"}
            </h2>
            <p className="text-fg-soft mt-3 max-w-2xl text-base leading-relaxed">
              {isFr
                ? "Notre méthodologie respecte les standards officiels français et européens — conformité AI Act, recommandations CNIL et ANSSI."
                : "Our methodology complies with French and European official standards — AI Act, CNIL and ANSSI recommendations."}
            </p>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  label: "CNIL — Intelligence artificielle",
                  url: "https://www.cnil.fr/fr/intelligence-artificielle",
                  org: "CNIL",
                },
                {
                  label: "ANSSI — Sécurité IA générative",
                  url: "https://cyber.gouv.fr/",
                  org: "ANSSI",
                },
                {
                  label: "AI Act EU — Règlement 2024/1689",
                  url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
                  org: "Eur-Lex",
                },
                {
                  label: "France Num — Numérique entreprises",
                  url: "https://www.francenum.gouv.fr/",
                  org: "France Num",
                },
                {
                  label: "BPI France — Financement IA",
                  url: "https://www.bpifrance.fr/",
                  org: "BPI France",
                },
                {
                  label: "INSEE — Statistiques entreprises",
                  url: "https://www.insee.fr/fr/statistiques",
                  org: "INSEE",
                },
              ].map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener nofollow"
                    className="bg-paper border-border hover:border-terracotta group flex items-center justify-between gap-3 rounded-xl border p-3 transition sm:p-4"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-fg truncate text-sm font-semibold">{link.label}</span>
                      <span className="text-fg-muted truncate text-[11px]">{link.org}</span>
                    </span>
                    <ArrowUpRight
                      className="text-terracotta h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ── 6. FORMATIONS — section détaillée ou carte compact ── */}
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
      ) : (
        <Section
          eyebrow={isFr ? "Formations" : "Training"}
          title={isFr ? "Formations IA" : "AI Training"}
          titleEm={`à ${ville.nameFr}`}
          description={
            isFr
              ? `Formations IA sur site à ${ville.nameFr} — montée en compétence accélérée de vos équipes. Sensibilisation, atelier pratique, programme sur mesure : durée flexible adaptée à votre maturité, sur vos données réelles, dans vos locaux. Standard pédagogique premium senior.`
              : `On-site AI training in ${ville.nameFr} — accelerated upskilling for your teams. Awareness sessions, hands-on workshops, custom programs: flexible duration matched to your maturity, on your real data, at your premises. Premium senior teaching standard.`
          }
          tone="canvas"
        >
          <ul className="grid gap-5 sm:grid-cols-3">
            {(
              [
                {
                  titleFr: "Sensibilisation (½j)",
                  titleEn: "Awareness (½ day)",
                  featuresFr: ["Panorama IA 2026", "Cas sectoriels concrets", "Q&R libres"],
                  featuresEn: ["AI 2026 overview", "Sector-specific cases", "Open Q&A"],
                },
                {
                  titleFr: "Atelier pratique (1j)",
                  titleEn: "Practical workshop (1 day)",
                  featuresFr: ["Outils IA sur vos données", "Automatisations live", "Livrable J+1"],
                  featuresEn: ["AI tools on your data", "Live automations", "D+1 deliverable"],
                },
                {
                  titleFr: "Programme sur mesure (2j+)",
                  titleEn: "Custom program (2d+)",
                  featuresFr: ["Parcours adapté métier", "Formation managers + ops", "ROI mesuré"],
                  featuresEn: ["Role-adapted path", "Managers + ops training", "Measured ROI"],
                },
              ] as const
            ).map((card, idx) => (
              <li
                key={idx}
                className="bg-bg border-border-strong/40 shadow-subtle rounded-2xl border-2 p-6"
              >
                <h3
                  className="text-fg text-lg leading-tight font-semibold"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? card.titleFr : card.titleEn}
                </h3>
                <ul className="mt-4 space-y-2">
                  {(isFr ? card.featuresFr : card.featuresEn).map((f) => (
                    <li key={f} className="text-fg-soft flex items-start gap-2 text-sm">
                      <Check
                        className="text-terracotta mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <AiToolsStack isFr={isFr} />
          <div className="mt-8">
            <Cta
              href="/interventions"
              variant="primary"
              size="lg"
              shape="pill"
              track="ville_cta_interventions"
            >
              {isFr ? "Voir les formations" : "View training"}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
          </div>
        </Section>
      )}

      {/* ── 7. AUDITS EN ENTREPRISE ── */}
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
      ) : (
        <Section
          eyebrow={isFr ? "Audits" : "Audits"}
          title={isFr ? "Audit IA en entreprise" : "Enterprise AI audit"}
          titleEm={`à ${ville.nameFr}`}
          description={
            isFr
              ? `Audit IA en profondeur à ${ville.nameFr} — nous entrons dans le cœur de chaque métier, écoutons vos opérationnels, cartographions vos vrais points de friction. Du bas vers le haut, du collaborateur au COMEX. Quelle que soit votre taille d'entreprise, un audit Axion-IA peut commencer dès 490 € (Flash 4h) et s'étendre jusqu'au cadrage complet bout-en-bout de toute votre structure selon vos besoins. Cabinet IA top 1 % en France.`
              : `In-depth AI audit in ${ville.nameFr} — we get inside every business function, interview your operations, map the real friction points. From the floor up to the C-suite. Whatever your company size, an Axion-IA audit can start from €490 (Flash 4h) and scale to a full end-to-end review of your whole structure as needed. Top 1 % AI consultancy in France.`
          }
          tone="paper"
        >
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                {
                  nameFr: "Audit Flash",
                  nameEn: "Flash Audit",
                  subFr: "Diagnostic express · 3 chantiers chiffrés",
                  subEn: "Express diagnosis · 3 costed projects",
                  // Vrais prix SSOT par tier (cf. pricing.ts)
                  price: formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, loc, {
                    compact: true,
                  }),
                },
                {
                  nameFr: "Audit Ciblé",
                  nameEn: "Targeted Audit",
                  subFr: "Plongée 1 processus · entretiens métiers",
                  subEn: "Deep dive 1 process · operations interviews",
                  // "À partir de" plutôt qu'une fourchette — moins effrayant pour les prospects.
                  price: isFr
                    ? `À partir de ${formatAmount(getTierById(AUDIT_TIERS, "audit-cible").priceMin!, "fr", { compact: true })}`
                    : `From ${formatAmount(getTierById(AUDIT_TIERS, "audit-cible").priceMin!, "en", { compact: true })}`,
                },
                {
                  nameFr: "Stratégique PME",
                  nameEn: "SME Strategic",
                  subFr: "Diagnostic transverse · interviews collaborateurs",
                  subEn: "Transverse diagnosis · team interviews",
                  price: isFr
                    ? `À partir de ${formatAmount(getTierById(AUDIT_TIERS, "audit-strategique-pme").priceMin!, "fr", { compact: true })}`
                    : `From ${formatAmount(getTierById(AUDIT_TIERS, "audit-strategique-pme").priceMin!, "en", { compact: true })}`,
                },
                {
                  nameFr: "Stratégique ETI",
                  nameEn: "Mid-cap Strategic",
                  // Audit Will 2026-05-25 : prix et durée FLEXIBLES — une ETI peut avoir besoin
                  // d'un petit cadrage comme d'un audit complet bout-en-bout. Pas de plancher rigide.
                  subFr: "Audit d'envergure · périmètre adapté à votre structure",
                  subEn: "Large-scale audit · scope adapted to your structure",
                  price: isFr ? "Sur mesure" : "Custom scope",
                },
              ] as const
            ).map((tier, idx) => (
              <li
                key={idx}
                className="bg-bg border-border-strong/40 shadow-subtle rounded-2xl border-2 p-6"
              >
                <p
                  className="text-fg text-lg leading-tight font-semibold"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? tier.nameFr : tier.nameEn}
                </p>
                <p className="text-fg-muted mt-1 text-sm">{isFr ? tier.subFr : tier.subEn}</p>
                <p className="text-terracotta mt-4 text-base font-bold">{tier.price}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Cta
              href="/audit"
              variant="primary"
              size="lg"
              shape="pill"
              track="ville_cta_audit_detail"
            >
              {isFr ? "Demander un audit" : "Request an audit"}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
          </div>
        </Section>
      )}

      {/* ── 8. IMPLÉMENTATIONS — section dédiée RENDUE UNIQUEMENT si services.implementation
           est explicitement défini (long-form curaté). Sinon, doublon avec section 4
           Réalisations (photos) + carte impl section 2 → on n'affiche rien.
           Sprint Quality 2026 P1-3 — Will 2026-05-25. ── */}
      {copy.services?.implementation ? (
        <VilleServiceDetailSection
          isFr={isFr}
          service="implementation"
          villeNameFr={ville.nameFr}
          villeSlug={ville.slug}
          regionSlug={ville.region}
          copy={copy.services.implementation[loc]}
          tone="canvas"
        />
      ) : null}

      {/* ── 9. PLATEFORMES WEB & SAAS AUGMENTÉS À L'IA ── */}
      <section className="bg-halo-cool relative py-24 sm:py-28">
        <Container>
          <FadeInOnView>
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="max-w-xl">
                <p className="text-fg-muted mb-6 text-[12px] font-semibold tracking-[0.2em] uppercase">
                  <span className="bg-terracotta mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  {isFr ? "Plateforme web & SaaS" : "Web platform & SaaS"}
                </p>
                <h2
                  className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "Sites web & SaaS" : "Websites & SaaS"}{" "}
                  <span className="italic-editorial text-terracotta">
                    {isFr ? "augmentés à l'IA." : "AI-augmented."}
                  </span>
                </h2>
                <p className="text-fg-soft mt-7 text-lg leading-relaxed">
                  {isFr
                    ? `Site web ou SaaS qui pourrait faire 10× plus avec l'IA ? Axion-IA conçoit et livre des plateformes intelligentes haut de gamme — architecture pensée pour la performance, l'évolutivité et l'impact business. Pour les entreprises ambitieuses de ${ville.nameFr} comme de toute la France.`
                    : `A website or SaaS that could do 10× more with AI? Axion-IA designs and delivers top-tier intelligent platforms — architected for performance, scalability and business impact. For ambitious businesses in ${ville.nameFr} and across France.`}
                </p>
                <ul className="mt-8 space-y-3">
                  {(isFr
                    ? [
                        "Recommandation & search natifs IA",
                        "Chatbots et assistants intégrés",
                        "Génération de contenu automatisée",
                        "RGPD Europe — hébergement UE",
                      ]
                    : [
                        "Native AI recommendation & search",
                        "Integrated chatbots and assistants",
                        "Automated content generation",
                        "EU GDPR — EU hosting",
                      ]
                  ).map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-base">
                      <Check className="text-terracotta h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="text-fg">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-10">
                  <Cta
                    href="/sites-web-augmentes"
                    variant="primary"
                    size="lg"
                    shape="pill"
                    track="ville_cta_web"
                  >
                    {isFr ? "Voir les réalisations web" : "See web case studies"}
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Cta>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(isFr
                  ? [
                      { emoji: "🔍", titleFr: "Search IA", subFr: "Recherche sémantique" },
                      {
                        emoji: "🤖",
                        titleFr: "Chatbot métier",
                        subFr: "RAG sur votre base de connaissance",
                      },
                      {
                        emoji: "📝",
                        titleFr: "Contenu auto",
                        subFr: "Génération & personnalisation",
                      },
                      { emoji: "📊", titleFr: "Dashboard IA", subFr: "Insights temps réel" },
                    ]
                  : [
                      { emoji: "🔍", titleFr: "AI Search", subFr: "Semantic search" },
                      {
                        emoji: "🤖",
                        titleFr: "Business chatbot",
                        subFr: "RAG on your knowledge base",
                      },
                      {
                        emoji: "📝",
                        titleFr: "Auto content",
                        subFr: "Generation & personalisation",
                      },
                      { emoji: "📊", titleFr: "AI dashboard", subFr: "Real-time insights" },
                    ]
                ).map((card, idx) => (
                  <div
                    key={idx}
                    className="bg-paper border-border rounded-2xl border p-5 text-center"
                  >
                    <span className="text-4xl" aria-hidden="true">
                      {card.emoji}
                    </span>
                    <p className="text-fg mt-3 text-base font-semibold">{card.titleFr}</p>
                    <p className="text-fg-muted mt-1 text-xs">{card.subFr}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ── 10. NOUS ACCOMPAGNONS TOUTES LES TAILLES D'ENTREPRISE ── */}
      <section
        id="audience"
        aria-labelledby="audience-heading"
        className="bg-bg py-24 sm:py-28 lg:py-32"
      >
        <Container>
          <FadeInOnView>
            <div className="mb-16 max-w-3xl">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {isFr ? `Entreprises à ${ville.nameFr}` : `Companies in ${ville.nameFr}`}
              </p>
              <h2
                id="audience-heading"
                className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
              >
                {isFr ? "Toutes les tailles," : "Every size,"}{" "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "le même niveau d'excellence." : "the same level of excellence."}
                </span>
              </h2>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed">
                {isFr
                  ? `Artisan, PME, ETI ou grand groupe — à ${ville.nameFr} comme dans toute la région ${region.nameFr}, vous bénéficiez du même standard premium senior. Cabinet IA opérationnel reconnu parmi les top 1 % en France.`
                  : `Sole trader, SMB, mid-market or large enterprise — in ${ville.nameFr} as across ${region.nameFr}, you get the same premium senior standard. Operational AI consultancy ranked top 1 % in France.`}
              </p>
            </div>
          </FadeInOnView>

          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {audienceSegments.map((seg, idx) => (
              <FadeInOnView key={seg.id} delay={idx * 70}>
                <li className="bg-paper border-border hover:border-border-strong flex h-full flex-col gap-4 rounded-2xl border p-7 transition">
                  <h3 className="text-fg text-xl leading-tight font-semibold tracking-tight">
                    {isFr ? seg.titleFr : seg.titleEn}
                  </h3>
                  <p
                    className="text-terracotta text-base leading-snug italic"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? seg.leadFr : seg.leadEn}
                  </p>
                  <p className="text-fg-soft text-sm leading-relaxed">
                    {isFr ? seg.detailFr : seg.detailEn}
                  </p>
                </li>
              </FadeInOnView>
            ))}
          </ul>

          {/* Villes alentours couvertes */}
          {nearbyVilles.length > 0 ? (
            <FadeInOnView>
              <div className="border-border-strong mt-16 border-t pt-12">
                <h2 className="text-fg text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
                  {isFr
                    ? `Axion-IA couvre ${ville.nameFr} et les communes alentours`
                    : `Axion-IA covers ${ville.nameFr} and surrounding areas`}
                </h2>
                <p className="text-fg-soft mt-3 max-w-2xl text-base leading-relaxed">
                  {isFr
                    ? "Interventions sur site, déplacement inclus. Toutes les communes listées sont éligibles aux mêmes tarifs et délais."
                    : "On-site engagements, travel included. All listed areas are eligible for the same pricing and timelines."}
                </p>
                <ul className="mt-6 flex flex-wrap gap-2">
                  <li className="bg-terracotta-soft text-terracotta-deep inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold">
                    {ville.nameFr}
                  </li>
                  {nearbyVilles.map(({ ville: v, distanceKm }) => (
                    <li key={v.slug}>
                      <Link
                        href={`/implantations/${v.region}/${v.slug}` as never}
                        className="bg-sand text-fg-soft hover:bg-terracotta-soft hover:text-terracotta-deep inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition"
                      >
                        {v.nameFr}{" "}
                        <span className="text-fg-muted ml-1.5 text-xs">
                          {Math.round(distanceKm)} km
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeInOnView>
          ) : null}

          {/* Nuage de secteurs */}
          <FadeInOnView>
            <div className="border-border-strong mt-12 border-t pt-12">
              <h2 className="text-fg text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
                {isFr ? "Tous les secteurs" : "All sectors"}
              </h2>
              <ul className="mt-6 flex flex-wrap gap-2">
                {SECTORS.map((sector) => (
                  <li
                    key={sector}
                    className="bg-sand text-fg-soft inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium"
                  >
                    {sector}
                  </li>
                ))}
              </ul>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ── 11. AVIS CLIENTS AVEC PHOTOS (propres à la ville, sans nom de société) ── */}
      {testimonials.length > 0 ? (
        <section
          id="testimonials"
          aria-labelledby="testimonials-heading"
          className="bg-paper py-24 sm:py-28 lg:py-36"
        >
          <Container>
            <FadeInOnView>
              <div className="mx-auto mb-16 max-w-3xl text-center">
                <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                  {isFr ? `Avis clients · ${ville.nameFr}` : `Client reviews · ${ville.nameFr}`}
                </p>
                <h2
                  id="testimonials-heading"
                  className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
                >
                  {isFr ? "Des résultats" : "Outsized"}{" "}
                  <span
                    className="italic-editorial text-terracotta"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? "d'un impact rare." : "impact."}
                  </span>
                </h2>
                <div className="mt-7 inline-flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1" aria-label="5 étoiles sur 5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className="text-terracotta h-5 w-5 fill-current"
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <p className="text-fg-soft text-sm">
                    <span className="text-fg font-bold">4,9 / 5</span>
                    {isFr
                      ? " — basé sur les retours opérationnels"
                      : " — based on operational feedback"}
                  </p>
                </div>
              </div>
            </FadeInOnView>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((c, idx) => {
                const photoUrl = unsplashPhotos[idx % unsplashPhotos.length] ?? unsplashPhotos[0];
                return (
                  <FadeInOnView key={c.slug} delay={idx * 80}>
                    <li className="bg-paper border-border shadow-subtle hover:shadow-card flex h-full flex-col gap-5 rounded-2xl border p-6 transition sm:p-7">
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-0.5"
                          aria-label={isFr ? "Note 5 étoiles sur 5" : "5-star rating"}
                        >
                          {[0, 1, 2, 3, 4].map((i) => (
                            <Star
                              key={i}
                              className="text-terracotta h-4 w-4 fill-current"
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                        <span className="bg-terracotta-soft text-terracotta-deep inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-tight uppercase">
                          <Shield className="h-3 w-3" aria-hidden="true" />
                          {isFr ? "Vérifié" : "Verified"}
                        </span>
                      </div>
                      <span className="bg-bg text-fg border-border inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold">
                        {c.metric}
                      </span>
                      <blockquote
                        cite={`${SITE_URL}/${loc}/cas-concrets/${c.slug}`}
                        className="text-fg flex-1 text-base leading-[1.5] sm:text-lg"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        <span
                          className="text-terracotta mr-1 text-2xl leading-none"
                          aria-hidden="true"
                        >
                          &ldquo;
                        </span>
                        {c[loc].testimonialQuote}
                        <span
                          className="text-terracotta ml-0.5 text-2xl leading-none"
                          aria-hidden="true"
                        >
                          &rdquo;
                        </span>
                      </blockquote>
                      {/* Auteur : photo + rôle + secteur — sans nom de société */}
                      <footer className="border-border mt-2 flex items-center gap-3 border-t pt-4">
                        <span className="ring-paper relative inline-flex h-12 w-12 shrink-0 overflow-hidden rounded-full shadow-sm ring-2">
                          <Image
                            src={photoUrl}
                            alt={`Portrait — ${c[loc].testimonialAuthor}`}
                            width={96}
                            height={96}
                            sizes="48px"
                            quality={85}
                            className="h-full w-full object-cover"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-fg truncate text-sm font-bold">
                            {c[loc].testimonialAuthor}
                          </p>
                          <p className="text-fg-muted truncate text-xs">{c[loc].testimonialRole}</p>
                          <p className="text-terracotta truncate text-[11px] font-semibold">
                            {isFr ? c.industry : c.industryEn}
                          </p>
                        </div>
                      </footer>
                    </li>
                  </FadeInOnView>
                );
              })}
            </ul>
            <div className="mt-12 text-center">
              <Link
                href="/blog"
                className="text-primary hover:text-primary/80 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {isFr
                  ? "Lire nos études de cas et articles IA"
                  : "Read our AI case studies and articles"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </Container>
        </section>
      ) : null}

      {/* ── 12. FAQ VILLE ── */}
      {faqItems.length > 0 ? (
        <FaqBlock
          eyebrow={isFr ? `FAQ · ${ville.nameFr}` : `FAQ · ${ville.nameFr}`}
          title={
            isFr
              ? `Questions fréquentes à ${ville.nameFr}`
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

      {/* ── 13. IMPLÉMENTATION À [VILLE] — CTA concis ── */}
      <CtaBlock
        eyebrow={isFr ? `Démarrer à ${ville.nameFr}` : `Start in ${ville.nameFr}`}
        title={isFr ? `Vous êtes basé à ${ville.nameFr} ?` : `You're based in ${ville.nameFr}?`}
        titleEm={
          isFr
            ? "Réservez un appel téléphonique ou par formulaire"
            : "Book a phone call or contact us by form"
        }
        cta={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Cta
              href="/appel"
              variant="terracotta"
              size="lg"
              shape="pill"
              track="ville_cta_book_final"
              data-source-ville={ville.slug}
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta
              href="/contact"
              variant="outline"
              size="lg"
              shape="pill"
              track="ville_cta_contact_final"
            >
              {isFr ? "Nous contacter" : "Contact us"}
            </Cta>
          </div>
        }
      />

      {/* AI Act art. 50 disclosure */}
      <AiContentDisclaimer locale={loc} />

      {/* JSON-LD — 8 schemas @graph, strategy afterInteractive (-300 ms TBT) */}
      <JsonLdGraph
        schemas={[
          serviceJsonLd,
          localBusinessJsonLd,
          placeJsonLd,
          breadcrumbJsonLd,
          faqSpeakableJsonLd ?? null,
          personManonJsonLd,
          webPageJsonLd,
          nearbyItemList ?? null,
        ]}
        strategy="afterInteractive"
        scriptId={`jsonld-ville-${ville.slug}`}
      />
    </>
  );
}

// ===========================================================================
// Stub minimal pour les ~2 156 villes sans copy éditorial.
// Anti-doorway HCU 2024 : page physique SSG accessible mais `noindex` +
// absente du sitemap (buildImplantationsSitemap filtre sur getIndexableVilles).
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
      title={isFr ? "Axion-IA intervient à" : "Axion-IA covers"}
      titleEm={ville.nameFr}
      description={
        isFr
          ? `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) fait partie des ${fmtPopulation(ville.population, "fr")} habitants éligibles à nos interventions sur site, audits IA et missions d'implémentation. La page locale détaillée est en préparation — réservez dès maintenant via la page régionale.`
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
          href="/appel"
          variant="ghost"
          size="lg"
          shape="pill"
          track="ville_stub_book"
          data-source-ville={ville.slug}
        >
          {isFr ? "Réserver un appel" : "Book a call"}
        </Cta>
      </div>
      <AiContentDisclaimer locale={isFr ? "fr" : "en"} className="mt-8" />
    </Section>
  );
}
