/**
 * Hub `/fr/implantations` — La Journée IA partout en France (refonte du 2026-11-11).
 *
 * Une seule offre, La Journée IA. Le hub ALLÉGÉ ne liste plus les ~2 157 villes
 * (8,8 Mo de HTML) : seulement les régions et quelques villes principales. Chaque ville
 * reste atteignable depuis sa page région et le sitemap. JSON-LD en ligne.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, MapPin } from "lucide-react";

import { routing } from "@/i18n/routing";
import { fmtPopulation } from "@/lib/intl";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";

import { REGIONS } from "@/content/regions";
import { getIndexableVillesCore } from "@/content/villes/core";
import { EN_BREF_JOURNEE_IA_PARAGRAPHES, remplacerJetons } from "@/content/journee-ia-commun";
import {
  CHEMIN_JOURNEE_IA,
  DATE_MAJ_IMPLANTATIONS,
  TITRE_HUB,
  aVille,
  descriptionHub,
  enRegion,
  lienRendezVous,
} from "@/content/villes/journee-ia-locale";
import { SITE_URL, buildItemListJsonLd, buildProductMetadata } from "@/lib/seo";
import { buildJourneeIaHubJsonLd } from "@/lib/seo/ville-service-jsonld";

interface Props {
  params: Promise<{ locale: string }>;
}

/** Villes principales affichées sur le hub (les plus peuplées ayant une page rédigée). */
const NB_VILLES_PRINCIPALES = 24;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/implantations",
    title: TITRE_HUB,
    description: descriptionHub(),
    alternates: { fr: "/implantations", en: "/locations" },
  });
}

// ISR 24 h : le hub dérive des villes rédigées (config) ; repeuple sans rebuild.
export const revalidate = 86400;

export default async function ImplantationsHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const principales = [...getIndexableVillesCore()]
    .sort((a, b) => b.population - a.population)
    .slice(0, NB_VILLES_PRINCIPALES);

  const breadcrumbItems = [{ href: "/implantations", label: "Implantations" }];

  const jsonLd = [
    ...buildJourneeIaHubJsonLd({
      path: "/implantations",
      titre: TITRE_HUB,
      description: descriptionHub(),
      filAriane: [
        { name: "Accueil", href: "/" },
        { name: "Implantations", href: "/implantations" },
      ],
      speakable: ["#implantations-hero-heading", "[data-en-bref]"],
      datePublished: "2026-05-08",
      dateModified: DATE_MAJ_IMPLANTATIONS,
    }),
    buildItemListJsonLd({
      locale: "fr",
      path: "/implantations",
      name: "La Journée IA, région par région",
      items: REGIONS.map((r, i) => ({
        position: i + 1,
        name: `La Journée IA ${enRegion(r)}`,
        url: `${SITE_URL}/fr/implantations/${r.slug}`,
      })),
    }),
  ];

  return (
    <>
      {/* JSON-LD EN LIGNE : Service Journée IA (France), BreadcrumbList, WebPage, ItemList. */}
      <JsonLdGraph schemas={jsonLd} />

      <section
        aria-labelledby="implantations-hero-heading"
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
            La Journée IA · France entière
          </HeroBadge>
          <div className="mx-auto max-w-3xl text-center">
            <h1
              id="implantations-hero-heading"
              className="text-fg text-[clamp(2rem,4vw,3.5rem)] leading-[1.06] font-semibold tracking-tight"
            >
              La Journée IA partout en France, dans vos locaux
            </h1>
            <p className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl">
              Nous n’avons pas de bureau dans chaque ville : nous venons dans votre entreprise, où
              qu’elle soit. Choisissez votre région ou votre ville.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Cta
                href={lienRendezVous("implantations-haut") as never}
                variant="primary"
                size="lg"
                shape="pill"
                track="hub_cta_diagnostic"
              >
                Réserver le diagnostic gratuit
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Cta>
              <Cta
                href={CHEMIN_JOURNEE_IA}
                variant="ghost"
                size="lg"
                shape="pill"
                track="hub_cta_journee_ia"
              >
                Découvrir la Journée IA
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* ── En bref : les textes communs de la Journée IA ── */}
      <section
        aria-labelledby="implantations-en-bref"
        className="bg-paper border-border border-t py-14 sm:py-16"
      >
        <Container>
          <div className="mx-auto max-w-3xl">
            <p className="text-terracotta mb-4 text-sm font-bold tracking-[0.2em] uppercase">
              En bref
            </p>
            <h2
              id="implantations-en-bref"
              className="text-fg text-[clamp(1.75rem,3.2vw,2.5rem)] leading-tight font-semibold tracking-tight"
            >
              La Journée IA, en bref
            </h2>
            <div
              data-en-bref
              className="text-fg-soft mt-6 space-y-4 text-base leading-relaxed sm:text-lg"
            >
              {EN_BREF_JOURNEE_IA_PARAGRAPHES.map((p) => (
                <p key={p.slice(0, 32)}>{remplacerJetons(p)}</p>
              ))}
            </div>
            <p className="mt-6 text-base">
              <Link
                href={CHEMIN_JOURNEE_IA}
                data-cta-tracking="hub_en_bref_journee_ia"
                className="text-terracotta font-semibold underline-offset-4 hover:underline"
              >
                Voir le déroulé complet de la Journée IA
              </Link>
            </p>
          </div>
        </Container>
      </section>

      {/* ── Les régions ── */}
      <Section
        eyebrow="Région par région"
        title="La Journée IA"
        titleEm="dans votre région"
        description="Chaque page région liste toutes ses communes de plus de 5 000 habitants, département par département."
        tone="sand"
      >
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {REGIONS.map((region) => (
            <li key={region.slug}>
              <Link
                href={`/implantations/${region.slug}` as never}
                data-cta-tracking="hub_region"
                data-source-region={region.slug}
                className="group bg-paper border-border hover:border-terracotta focus-visible:ring-terracotta shadow-subtle hover:shadow-card flex h-full items-start gap-3 rounded-xl border p-4 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
                  <p className="text-fg-muted mt-1 text-[12px] leading-snug">
                    {`${region.departements.length} département${region.departements.length > 1 ? "s" : ""} · ${fmtPopulation(region.population, "fr")} hab.`}
                  </p>
                </div>
                <ArrowUpRight
                  aria-hidden="true"
                  className="text-fg-muted group-hover:text-terracotta mt-1 h-4 w-4 shrink-0 transition"
                />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Villes principales (les autres : via leur région et le sitemap) ── */}
      {principales.length > 0 ? (
        <Section
          eyebrow="Villes principales"
          title="La Journée IA"
          titleEm="ville par ville"
          description="Les plus grandes villes. Toutes les autres communes sont listées sur leur page région."
        >
          <ul className="flex flex-wrap justify-center gap-2">
            {principales.map((v) => (
              <li key={v.slug}>
                <Link
                  href={`/implantations/${v.region}/${v.slug}` as never}
                  data-cta-tracking="hub_ville_principale"
                  data-source-ville={v.slug}
                  className="bg-sand text-fg hover:text-terracotta focus-visible:ring-terracotta inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
                >
                  {`La Journée IA ${aVille(v.nameFr)}`}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* ── CTA final ── */}
      <section
        aria-labelledby="implantations-cta-final"
        className="bg-terracotta text-paper py-14 sm:py-16 lg:py-20"
      >
        <Container>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <h2
              id="implantations-cta-final"
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
              href={lienRendezVous("implantations-bas") as never}
              data-cta-tracking="hub_cta_final_diagnostic"
              className="bg-paper text-terracotta cta-lift focus-visible:ring-paper inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Réserver le diagnostic gratuit
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </section>

      <StickyMobileCta
        href={lienRendezVous("implantations-bas")}
        label="Réserver le diagnostic gratuit"
        track="hub-sticky-mobile"
        threshold={600}
      />
    </>
  );
}
