/**
 * Page région — La Journée IA en {Région} (refonte SEO/GEO du 2026-11-11).
 *
 * Une seule offre, La Journée IA : plus de grille « 5 services », plus de `LocalBusiness`
 * avec une adresse dans le chef-lieu (Axion-IA n'a pas de bureau dans chaque région).
 * JSON-LD en ligne (Service Journée IA localisé + BreadcrumbList + WebPage + FAQPage).
 * Chaque ville de la région reste atteignable depuis la liste par département.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, MapPin, Building2 } from "lucide-react";

import { routing } from "@/i18n/routing";
import { fmtPopulation } from "@/lib/intl";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";

import { REGIONS, getRegion } from "@/content/regions";
import { getVillesByRegion } from "@/content/villes";
import {
  aVille,
  CHEMIN_JOURNEE_IA,
  DATE_MAJ_IMPLANTATIONS,
  ancresJourneeIa,
  depuisRegion,
  descriptionRegion,
  enRegion,
  faqRegion,
  h1Region,
  lienRendezVous,
  nomDepartement,
  paragrapheRegion,
  titreRegion,
} from "@/content/villes/journee-ia-locale";
import { buildProductMetadata } from "@/lib/seo";
import { buildJourneeIaRegionJsonLd } from "@/lib/seo/ville-service-jsonld";

interface Props {
  params: Promise<{ locale: string; region: string }>;
}

export function generateStaticParams(): Array<{ region: string }> {
  return REGIONS.map((r) => ({ region: r.slug }));
}

// P1-13 (audit re-run 2026-05-15) — ISR sur hub régions pSEO.
export const revalidate = 86400;
export const dynamicParams = true;

/** Nombre de villes principales mises en avant (les autres restent dans la liste complète). */
const NB_VILLES_PRINCIPALES = 12;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, region: regionSlug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const region = getRegion(regionSlug);
  if (!region) return {};
  const meta = await buildProductMetadata({
    locale,
    path: `/implantations/${region.slug}`,
    title: titreRegion(region),
    description: descriptionRegion(region),
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

  const villes = getVillesByRegion(region.slug);
  const parPopulation = [...villes].sort((a, b) => b.population - a.population);
  // Villes principales : les plus peuplées qui ont une page rédigée (indexable à terme).
  const principales = parPopulation.filter((v) => !!v.copy).slice(0, NB_VILLES_PRINCIPALES);
  const departements = new Set(villes.map((v) => v.departementLabel ?? v.departement));
  const [ancre1, ancre2] = ancresJourneeIa(region.slug);
  const path = `/implantations/${region.slug}`;
  const titre = titreRegion(region);
  const faq = faqRegion(region);

  const breadcrumbItems = [
    { href: "/implantations", label: "Implantations" },
    { href: path, label: region.nameFr },
  ];

  const jsonLd = buildJourneeIaRegionJsonLd({
    path,
    titre,
    description: descriptionRegion(region),
    region,
    filAriane: [
      { name: "Accueil", href: "/" },
      { name: "Implantations", href: "/implantations" },
      { name: region.nameFr, href: path },
    ],
    speakable: ["#region-hero-heading", "[data-journee-ia-region]"],
    datePublished: "2026-05-08",
    dateModified: DATE_MAJ_IMPLANTATIONS,
  });

  // Villes groupées par département (code croissant), puis par population décroissante.
  type VilleEntry = (typeof villes)[number];
  const parDepartement = new Map<string, VilleEntry[]>();
  for (const v of parPopulation) {
    const cle = v.departementLabel ?? v.departement;
    const liste = parDepartement.get(cle);
    if (liste) liste.push(v);
    else parDepartement.set(cle, [v]);
  }
  const departementsTries = [...parDepartement.entries()].sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  return (
    <>
      {/* JSON-LD EN LIGNE : Service Journée IA (areaServed = la région), BreadcrumbList,
          WebPage. La FAQPage est émise par `FaqAccordion`, en ligne aussi. */}
      <JsonLdGraph schemas={jsonLd} />

      {/* ── Hero ── */}
      <section
        aria-labelledby="region-hero-heading"
        className="bg-halo-warm relative overflow-hidden py-16 sm:py-20 lg:py-24"
      >
        <Container className="relative">
          <div className="mb-8">
            <Breadcrumbs items={breadcrumbItems} emitJsonLd={false} />
          </div>
          <HeroBadge className="mb-8 sm:mb-10">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            {`La Journée IA · ${region.nameFr}`}
          </HeroBadge>
          <div className="mx-auto max-w-3xl text-center">
            <h1
              id="region-hero-heading"
              className="text-fg text-[clamp(2rem,4vw,3.5rem)] leading-[1.06] font-semibold tracking-tight"
            >
              {h1Region(region)}
            </h1>
            <p className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl">
              {`Une journée chez vous, ${enRegion(region)}, comme partout en France : le matin, nous chiffrons vos plus gros gains ; l’après-midi, nous formons vos équipes sur leurs propres dossiers.`}
            </p>
            <div className="text-fg-muted mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {fmtPopulation(region.population, "fr")} habitants
              </span>
              {villes.length > 0 ? (
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  {`${fmtPopulation(villes.length, "fr")} communes de plus de 5 000 habitants`}
                </span>
              ) : null}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Cta
                href={lienRendezVous(depuisRegion(region.slug, "haut")) as never}
                variant="primary"
                size="lg"
                shape="pill"
                track="region_cta_diagnostic"
                data-source-region={region.slug}
              >
                Réserver le diagnostic gratuit
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Cta>
              <Cta
                href={CHEMIN_JOURNEE_IA}
                variant="ghost"
                size="lg"
                shape="pill"
                track="region_cta_journee_ia"
                data-source-region={region.slug}
              >
                Découvrir la Journée IA
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* ── La Journée IA en {Région} ── */}
      <section
        aria-labelledby="region-journee-ia"
        className="bg-paper border-border border-t py-14 sm:py-16 lg:py-20"
      >
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2
              id="region-journee-ia"
              className="text-fg text-[clamp(1.75rem,3.2vw,2.5rem)] leading-tight font-semibold tracking-tight"
            >
              {`La Journée IA ${enRegion(region)}`}
            </h2>
            <p
              data-journee-ia-region
              className="text-fg-soft mt-6 text-base leading-relaxed sm:text-lg"
            >
              {paragrapheRegion(region, {
                communes: villes.length,
                departements: departements.size,
                principales: parPopulation.slice(0, 3).map((v) => v.nameFr),
              })}
            </p>
            <p className="mt-6 text-base">
              <Link
                href={CHEMIN_JOURNEE_IA}
                data-cta-tracking="region_journee_ia"
                data-source-region={region.slug}
                className="text-terracotta font-semibold underline-offset-4 hover:underline"
              >
                {ancre1.charAt(0).toUpperCase() + ancre1.slice(1)}
              </Link>
            </p>
            {principales.length > 0 ? (
              <>
                <h3
                  className="text-fg mt-10 text-xl leading-tight font-semibold"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {`Villes principales ${enRegion(region)}`}
                </h3>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {principales.map((v) => (
                    <li key={v.slug}>
                      <Link
                        href={`/implantations/${region.slug}/${v.slug}` as never}
                        data-cta-tracking="region_ville_principale"
                        data-source-ville={v.slug}
                        className="bg-sand text-fg hover:text-terracotta focus-visible:ring-terracotta inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {`La Journée IA ${aVille(v.nameFr)}`}
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </Container>
      </section>

      {/* ── Toutes les villes, par département : chaque ville reste atteignable ── */}
      {villes.length > 0 ? (
        <Section
          eyebrow="Toutes les villes"
          title={`${fmtPopulation(villes.length, "fr")} communes`}
          titleEm={enRegion(region)}
          description="Communes de plus de 5 000 habitants, groupées par département. La Journée IA se tient dans les locaux de votre entreprise, quelle que soit la commune."
          tone="sand"
        >
          <div className="space-y-3">
            {departementsTries.map(([code, liste], idx) => (
              <details
                key={code}
                open={idx === 0}
                className="group bg-paper border-border-strong/40 open:shadow-card rounded-2xl border-2 transition"
              >
                <summary className="hover:bg-sand focus-visible:ring-terracotta flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-5 py-4 transition focus-visible:ring-2 focus-visible:outline-none">
                  <span className="flex items-baseline gap-3">
                    <span
                      className="text-fg text-lg leading-tight font-semibold tracking-tight"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {`${nomDepartement({ departement: code })} (${code})`}
                    </span>
                    <span className="text-fg-muted text-sm tabular-nums">
                      {liste.length} {liste.length > 1 ? "communes" : "commune"}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-fg-muted text-xs transition-transform group-open:rotate-180"
                  >
                    ▾
                  </span>
                </summary>
                <ul className="border-border/40 grid grid-cols-2 gap-x-3 gap-y-1 border-t px-5 py-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {liste.map((v) => (
                    <li key={v.slug}>
                      <Link
                        href={`/implantations/${region.slug}/${v.slug}` as never}
                        className="text-fg hover:text-terracotta block truncate rounded-md px-2 py-1.5 text-[13px] font-semibold tracking-tight transition"
                      >
                        {v.nameFr}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </Section>
      ) : null}

      {/* ── FAQ régionale (FAQPage en ligne, réponses = textes visibles) ── */}
      <Section eyebrow="Questions fréquentes" title="La Journée IA" titleEm={enRegion(region)}>
        <Container>
          <FaqAccordion className="mx-auto max-w-3xl" items={faq} />
          <p className="mt-8 text-center text-base">
            <Link
              href={CHEMIN_JOURNEE_IA}
              data-cta-tracking="region_faq_journee_ia"
              data-source-region={region.slug}
              className="text-terracotta font-semibold underline-offset-4 hover:underline"
            >
              {ancre2.charAt(0).toUpperCase() + ancre2.slice(1)}
            </Link>
          </p>
        </Container>
      </Section>

      {/* ── CTA final ── */}
      <section
        aria-labelledby="region-cta-final"
        className="bg-terracotta text-paper py-14 sm:py-16 lg:py-20"
      >
        <Container>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <h2
              id="region-cta-final"
              className="text-paper text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Votre Journée IA commence par 45 minutes gratuites
            </h2>
            <p className="text-paper/85 text-base leading-relaxed sm:text-lg">
              Diagnostic IA gratuit de 45 minutes, en visio ou par téléphone : une première tâche
              chiffrée, et la date de votre journée fixée ensemble.
            </p>
            <Link
              href={lienRendezVous(depuisRegion(region.slug, "bas")) as never}
              data-cta-tracking="region_cta_final_diagnostic"
              data-source-region={region.slug}
              className="bg-paper text-terracotta cta-lift focus-visible:ring-paper inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Réserver le diagnostic gratuit
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </section>

      <StickyMobileCta
        href={lienRendezVous(depuisRegion(region.slug, "bas"))}
        label="Réserver le diagnostic gratuit"
        track="region-sticky-mobile"
        threshold={600}
      />
    </>
  );
}
