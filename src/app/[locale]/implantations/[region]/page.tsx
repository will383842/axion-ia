import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowUpRight, MapPin, Building2, Briefcase, Wrench } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { fmtPopulation } from "@/lib/intl";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { CtaBlock } from "@/components/sections/CtaBlock";

import { REGIONS, getRegion } from "@/content/regions";
import { getVillesByRegion } from "@/content/villes";
import { AUDIT_TIERS, INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";
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
      ? `${region.nameFr} · Cabinet IA opérationnel`
      : `${region.nameFr} · Operational AI consultancy`,
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
  // LocalBusiness — areaServed = AdministrativeArea régionale.
  const localBusinessJsonLd = buildLocalBusinessJsonLd({
    locale: loc,
    path: `/implantations/${region.slug}`,
    name: isFr
      ? `Axion-IA · cabinet IA opérationnel en ${region.nameFr}`
      : `Axion-IA · operational AI consultancy in ${region.nameFr}`,
    description: isFr ? region.pitchFr : region.pitchEn,
    areaServed: { type: "AdministrativeArea", name: region.nameFr },
    address: { city: region.prefecture, region: region.nameFr, country: "FR" },
    geo: { latitude: region.geo.lat, longitude: region.geo.lon },
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
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={placeJsonLd} />
      <JsonLd data={villesItemList} />

      {/* Hero */}
      <Section
        titleAs="h1"
        eyebrow={isFr ? `Implantations · ${region.prefecture}` : `Locations · ${region.prefecture}`}
        title={isFr ? "Cabinet IA opérationnel en" : "Operational AI consultancy in"}
        titleEm={region.nameFr}
        titleTail={isFr ? "." : "."}
        description={isFr ? region.pitchFr : region.pitchEn}
      >
        <div className="mb-10">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
        <div className="text-fg-muted mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {fmtPopulation(region.population, isFr ? "fr" : "en")}{" "}
            {isFr ? "habitants" : "inhabitants"}
          </span>
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4" aria-hidden="true" />
            {villes.length} {isFr ? "communes ≥ 5 000 hab" : "communes ≥ 5,000 inhab."}
          </span>
          {typeof region.pibBillionsEur === "number" ? (
            <span className="inline-flex items-center gap-2">
              <Briefcase className="h-4 w-4" aria-hidden="true" />
              {region.pibBillionsEur} Md€ {isFr ? "PIB régional" : "regional GDP"}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Cta
            href={`/reserver?ville=${region.prefecture.toLowerCase()}` as never}
            variant="primary"
            size="lg"
            shape="pill"
            track="region_cta_book"
          >
            {isFr
              ? `Réserver · dès ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}`
              : `Book · from ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}`}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Cta>
          <Cta href="/audit" variant="ghost" size="lg" shape="pill" track="region_cta_audit">
            {isFr ? "Demander un audit Flash" : "Request a Flash audit"}
          </Cta>
        </div>
      </Section>

      {/* Pages villes pilotes (gold standard, V1 = Paris IDF seul) */}
      {pilotVilles.length > 0 ? (
        <Section
          eyebrow={isFr ? "Pages villes" : "City pages"}
          title={isFr ? "Contenu local" : "Local content"}
          titleEm={isFr ? "détaillé" : "in depth"}
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

      {/* Maillage canonique vers /audit, /interventions, /implementation */}
      <Section
        eyebrow={isFr ? "Nos 3 services" : "Our 3 services"}
        title={isFr ? "Disponibles partout" : "Available across"}
        titleEm={region.nameFr}
        description={
          isFr
            ? "Toutes nos prestations sont disponibles aux mêmes tarifs publics partout en France métropolitaine."
            : "All our services are available at the same public pricing across all metropolitan France."
        }
        tone="sand"
      >
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
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
              label: isFr ? "Interventions sur site" : "On-site sessions",
              detail: isFr
                ? `1 journée ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })} · jusqu'à 100 personnes · démos sur vos données`
                : `1 day ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })} · up to 100 people · demos on your data`,
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
                data-cta-tracking="region_canonical_link"
                data-source-region={region.slug}
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

      {/* CTA final */}
      <CtaBlock
        eyebrow={isFr ? "Démarrer en région" : "Start in the region"}
        title={isFr ? `Vous êtes en ${region.nameFr} ?` : `You're in ${region.nameFr}?`}
        titleEm={isFr ? "Réservez en ligne" : "Book online"}
        description={
          isFr
            ? `Calendrier réel temps réel. Acompte 50 % à la confirmation. Le champ « ville » sera pré-rempli avec ${region.prefecture}.`
            : `Real-time calendar. 50% deposit on confirmation. The "city" field will be pre-filled with ${region.prefecture}.`
        }
        cta={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Cta
              href={`/reserver?ville=${region.prefecture.toLowerCase()}` as never}
              variant="terracotta"
              size="lg"
              shape="pill"
              track="region_cta_book_final"
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
              track="region_cta_contact_final"
            >
              {isFr ? "Parler à un consultant" : "Speak with a consultant"}
            </Cta>
          </div>
        }
      />
    </>
  );
}
