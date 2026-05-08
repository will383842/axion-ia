import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  MapPin,
  TrainFront,
  Users,
  Wrench,
} from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { VilleHeroSchema } from "@/components/sections/VilleHeroSchema";

import { getRegion } from "@/content/regions";
import { VILLES, getVille, type Ville } from "@/content/villes";
import { getNearbyVilles, getNearbyCases, getRelatedBlogPosts } from "@/lib/geo";
import {
  buildProductMetadata,
  buildBreadcrumbJsonLd,
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
      ? `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) · Cabinet IA opérationnel · AxionIA`
      : `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) · Operational AI consultancy · AxionIA`
    : isFr
      ? `${ville.nameFr} · AxionIA intervient ici (${region.nameFr})`
      : `${ville.nameFr} · AxionIA covers this area (${region.nameFr})`;

  const description = isPilot
    ? isFr
      ? (ville.copy?.directAnswerFr ?? ville.copy?.pitchFr ?? "")
      : (ville.copy?.directAnswerEn ?? ville.copy?.pitchEn ?? "")
    : isFr
      ? `AxionIA intervient à ${ville.nameFr} (${region.nameFr}). Audit IA Flash dès 490 € HT, intervention sur site 1 journée, implémentation IA. Réservation directe en ligne.`
      : `AxionIA operates in ${ville.nameFr} (${region.nameFr}). Flash AI audit from €490, 1-day on-site session, AI implementation. Direct online booking.`;

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

  // ---- JSON-LD stack (5 schemas empilés) ----
  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Implantations" : "Locations", href: "/implantations" },
      { name: region.nameFr, href: `/implantations/${region.slug}` },
      { name: ville.nameFr, href: `/implantations/${region.slug}/${ville.slug}` },
    ],
  });

  const localBusinessJsonLd = buildLocalBusinessJsonLd({
    locale: loc,
    path: `/implantations/${region.slug}/${ville.slug}`,
    name: isFr
      ? `AxionIA · cabinet IA opérationnel à ${ville.nameFr}`
      : `AxionIA · operational AI consultancy in ${ville.nameFr}`,
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
  // on émet déjà le Speakable variant via buildFaqSpeakableJsonLd.
  const faqItems =
    copy.faqGeolocalisee?.map((f, idx) => ({
      id: `${ville.slug}-faq-${idx}`,
      question: f.q,
      answer: f.a,
    })) ?? [];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={placeJsonLd} />
      {faqSpeakableJsonLd ? <JsonLd data={faqSpeakableJsonLd} /> : null}
      {nearbyItemList ? <JsonLd data={nearbyItemList} /> : null}

      {/* 1. HERO localisé — Section h1 custom layout 2-cols (parity /interventions) */}
      <section className="bg-halo-warm relative overflow-hidden py-20 sm:py-24 lg:py-32">
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
                {isFr ? "Cabinet IA opérationnel à" : "Operational AI consultancy in"}{" "}
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
                  {ville.population.toLocaleString(isFr ? "fr-FR" : "en-US")}{" "}
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
                  {isFr ? `Réserver à ${ville.nameFr} · 490 €` : `Book in ${ville.nameFr} · €490`}
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
                  {isFr ? "Audit IA Flash · 490 €" : "Flash AI audit · €490"}
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

      {/* 3. DÉMOGRAPHIE + SECTEURS NAF + DISTANCES — bloc data dense */}
      <Section
        eyebrow={isFr ? "Tissu local" : "Local fabric"}
        title={isFr ? "Données économiques" : "Economic data"}
        titleEm={ville.nameFr}
        description={
          isFr
            ? "Source : INSEE (recensement légal 2024) + Sirene 2024. Données différenciées par ville (anti-doorway HCU 2024)."
            : "Source: INSEE (2024 legal census) + Sirene 2024. City-specific differentiated data (anti-doorway HCU 2024)."
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
              {ville.population.toLocaleString(isFr ? "fr-FR" : "en-US")}{" "}
              <span className="text-fg-soft text-base font-normal">{isFr ? "hab." : "inhab."}</span>
            </p>
            <p className="text-fg-soft mt-3 text-sm leading-relaxed">
              {isFr
                ? `Code INSEE ${ville.inseeCode} · département ${ville.departementLabel ?? ville.departement}. Recensement légal INSEE 2024.`
                : `INSEE code ${ville.inseeCode} · department ${ville.departementLabel ?? ville.departement}. INSEE 2024 legal census.`}
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
                {isFr ? "Top secteurs NAF" : "Top NAF sectors"}
              </p>
              <p
                className="text-fg mt-3 text-xl leading-tight font-semibold"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "Tissu B2B dominant" : "Dominant B2B fabric"}
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

          {/* Distances */}
          {(isFr ? copy.distancesFr : (copy.distancesEn ?? copy.distancesFr)) ? (
            <article className="bg-bg border-border-strong/40 rounded-2xl border-2 p-6">
              <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-sage mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Accès" : "Access"}
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

      {/* 4. ÉCOSYSTÈME LOCAL — paragraphe différenciateur (gros texte) */}
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

      {/* 5. CAS CLIENTS PROCHES — Haversine 50 km, fallback silencieux */}
      {nearbyCases.length > 0 ? (
        <Section
          eyebrow={isFr ? "Cas clients proches" : "Nearby case studies"}
          title={isFr ? "Déjà déployé" : "Already deployed"}
          titleEm={isFr ? "à proximité" : "nearby"}
          description={
            isFr
              ? `Cas anonymisés à moins de 50 km de ${ville.nameFr}. ROI chiffré, contexte, livrables.`
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
                    {Math.round(distanceKm)} km ·{" "}
                    {v.population.toLocaleString(isFr ? "fr-FR" : "en-US")}{" "}
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

      {/* 9. CTA final + maillage canonique 3 services */}
      <Section
        eyebrow={isFr ? "Nos services" : "Our services"}
        title={isFr ? "Disponibles à" : "Available in"}
        titleEm={ville.nameFr}
        description={
          isFr
            ? "Aucun surcoût géographique. Frais de déplacement intégrés au forfait pour les capitales régionales."
            : "No geographic surcharge. Travel fees included for regional capitals."
        }
        tone="canvas"
      >
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              href: "/audit" as const,
              icon: Briefcase,
              label: isFr ? "Audit IA" : "AI audit",
              detail: isFr
                ? "4 niveaux · Flash 490 € → Stratégique ETI dès 12 000 €"
                : "4 tiers · Flash €490 → Mid-cap strategic from €12,000",
              accent: "primary" as const,
            },
            {
              href: "/interventions" as const,
              icon: Building2,
              label: isFr ? "Interventions sur site" : "On-site sessions",
              detail: isFr
                ? "1 journée 490 € · jusqu'à 100 personnes · démos sur vos données"
                : "1 day €490 · up to 100 people · demos on your data",
              accent: "terracotta" as const,
            },
            {
              href: "/implementation" as const,
              icon: Wrench,
              label: isFr ? "Implémentation IA" : "AI implementation",
              detail: isFr
                ? "Mise en production sur 6-12 semaines · ROI chiffré"
                : "Production deployment over 6-12 weeks · costed ROI",
              accent: "sage" as const,
            },
          ].map(({ href, icon: Icon, label, detail, accent }) => (
            <li key={href}>
              <Link
                href={href}
                data-cta-tracking="ville_canonical_link"
                data-source-ville={ville.slug}
                data-source-target={href}
                className="group bg-paper hover:border-terracotta focus-visible:ring-terracotta border-border-strong/40 shadow-subtle hover:shadow-card block h-full rounded-2xl border-2 p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span
                  className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md ${
                    accent === "primary"
                      ? "bg-primary-soft text-primary"
                      : accent === "terracotta"
                        ? "bg-terracotta-soft text-terracotta-deep"
                        : "bg-sand-deep text-sage"
                  }`}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <p
                  className="text-fg text-xl leading-tight font-semibold"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {label}
                </p>
                <p className="text-fg-soft mt-3 text-sm leading-relaxed">{detail}</p>
                <p className="text-terracotta mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">
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

      {/* CTA final pré-rempli ville */}
      <CtaBlock
        eyebrow={isFr ? `Démarrer à ${ville.nameFr}` : `Start in ${ville.nameFr}`}
        title={isFr ? `Vous êtes basé à ${ville.nameFr} ?` : `You're based in ${ville.nameFr}?`}
        titleEm={isFr ? "Réservez en ligne" : "Book online"}
        description={
          isFr
            ? `Calendrier réel temps réel. Acompte 50 % à la confirmation. Le champ « ville » sera pré-rempli avec ${ville.nameFr}.`
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
              {isFr ? "Voir le calendrier · 490 €" : "View the calendar · €490"}
            </Cta>
            <Cta
              href="/contact"
              variant="outline"
              size="lg"
              shape="pill"
              track="ville_cta_contact_final"
            >
              {isFr ? "Parler à un consultant" : "Speak with a consultant"}
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
      title={isFr ? "AxionIA intervient à" : "AxionIA covers"}
      titleEm={ville.nameFr}
      description={
        isFr
          ? `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) fait partie des ${ville.population.toLocaleString("fr-FR")} habitants éligibles à nos interventions sur site, audits IA et missions d'implémentation. La page locale détaillée est en préparation — réservez dès maintenant via la page régionale.`
          : `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) is part of the ${ville.population.toLocaleString("en-US")} inhabitants eligible to our on-site engagements, AI audits and implementation missions. The detailed local page is in preparation — book now via the regional page.`
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
          {isFr ? "Réserver une intervention · 490 €" : "Book an engagement · €490"}
        </Cta>
      </div>
    </Section>
  );
}
