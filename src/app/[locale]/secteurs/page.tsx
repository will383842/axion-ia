import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { CLIENT_SECTORS } from "@/content/sectors";
import { getRepresentativePageImage } from "@/lib/seo/page-images";
import {
  buildProductMetadata,
  buildItemListJsonLd,
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  SITE_URL,
} from "@/lib/seo";

// ============================================================================
// Hub /secteurs — Phase 3 SEO secteurs (2026-06-21). Pilier listant les 10
// secteurs client (santé, BTP, juridique…). Chaque carte mène au pilier
// /secteurs/[secteur], qui déroule les 5 activités Axion-IA contextualisées
// par la pain-matrix sectorielle (contenu unique par combo → anti-doorway HCU :
// pas de page « gabarit ville-swap », mais du contenu métier réellement différencié).
// ============================================================================

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const title = isFr
    ? "L'IA par secteur d'activité · cas d'usage métier · Axion-IA"
    : "AI by business sector · industry use cases · Axion-IA";
  return {
    ...buildProductMetadata({
      locale,
      path: "/secteurs",
      title,
      description: isFr
        ? "L'intelligence artificielle appliquée à votre secteur : comptabilité, BTP, santé, juridique, commerce, industrie, RH, collectivités… Cas d'usage concrets, bénéfices chiffrés et feuille de route par métier."
        : "AI applied to your sector: accounting, construction, healthcare, legal, retail, industry, HR, public sector… Concrete use cases, quantified benefits and a roadmap per industry.",
    }),
    title: { absolute: title },
  };
}

export default async function SecteursHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [{ href: "/secteurs", label: isFr ? "Secteurs" : "Sectors" }];

  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Secteurs" : "Sectors", href: "/secteurs" },
    ],
  });

  // Image représentative (héro) : rendue à droite du h1 ET propagée au JSON-LD
  // ImageObject + sitemap images via le SSOT `page-images.ts` (même URL crawlable).
  const heroImage = getRepresentativePageImage("/secteurs");
  const secteursImagesJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: "/secteurs" });
  const primaryImageOfPage = buildPrimaryImageOfPage("/secteurs");

  const heroMedia = heroImage ? (
    <figure className="shadow-card m-0 overflow-hidden rounded-2xl">
      <Image
        src={heroImage.src}
        alt={isFr ? heroImage.altFr : heroImage.altEn}
        width={heroImage.width}
        height={heroImage.height}
        priority
        sizes="(max-width: 1024px) 100vw, 40vw"
        className="h-auto w-full object-cover"
      />
    </figure>
  ) : undefined;

  // Nœud CollectionPage page-level — porteur du `speakable` (h1). Réutilise
  // EXACTEMENT le titre/description de la metadata (pas de réécriture).
  const collectionPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: "/secteurs",
    name: isFr
      ? "L'IA par secteur d'activité · cas d'usage métier · Axion-IA"
      : "AI by business sector · industry use cases · Axion-IA",
    description: isFr
      ? "L'intelligence artificielle appliquée à votre secteur : comptabilité, BTP, santé, juridique, commerce, industrie, RH, collectivités… Cas d'usage concrets, bénéfices chiffrés et feuille de route par métier."
      : "AI applied to your sector: accounting, construction, healthcare, legal, retail, industry, HR, public sector… Concrete use cases, quantified benefits and a roadmap per industry.",
    speakable: true,
    ...(primaryImageOfPage ? { extra: { primaryImageOfPage } } : {}),
  });

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/secteurs",
    name: isFr
      ? "Secteurs d'activité couverts par Axion-IA"
      : "Business sectors covered by Axion-IA",
    items: CLIENT_SECTORS.map((s, idx) => ({
      position: idx + 1,
      name: s.labelFr,
      url: `${SITE_URL}/${loc}/secteurs/${s.slug}`,
      description: isFr ? `Solutions IA pour ${s.fullFr}.` : `AI solutions for ${s.fullFr}.`,
    })),
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        tone="halo-warm"
        titleAs="h1"
        eyebrow={isFr ? "Secteurs d'activité" : "Business sectors"}
        title={
          isFr
            ? "L'IA concrète, dans le langage de votre métier."
            : "Practical AI, in the language of your trade."
        }
        description={
          isFr
            ? "Chaque secteur a ses contraintes, son vocabulaire et ses gisements de temps. On part de vos cas d'usage réels — pas d'un discours générique — pour vous montrer où l'IA fait gagner du temps et de l'argent."
            : "Every sector has its constraints, vocabulary and time sinks. We start from your real use cases — not a generic pitch — to show where AI saves time and money."
        }
        media={heroMedia}
      >
        <ul className="xs:grid-cols-2 grid grid-cols-1 gap-5 md:grid-cols-3" role="list">
          {CLIENT_SECTORS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/${loc}/secteurs/${s.slug}`}
                className="border-border hover:border-border-strong hover:shadow-card group flex h-full flex-col overflow-hidden rounded-2xl border transition"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={`/illustrations/secteurs/${s.slug}.avif`}
                    alt={
                      isFr
                        ? `${s.labelFr} et intelligence artificielle — Axion-IA accompagne ${s.fullFr}.`
                        : `${s.labelFr} and artificial intelligence — Axion-IA supports ${s.fullFr}.`
                    }
                    width={1600}
                    height={1000}
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                  <span
                    aria-hidden="true"
                    className="bg-bg/85 ring-border-strong/30 absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-lg text-lg ring-1 backdrop-blur"
                  >
                    {s.emoji}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <span className="text-fg text-lg font-semibold">{s.labelFr}</span>
                  <span className="text-fg-soft text-sm leading-relaxed">
                    {isFr ? `Solutions IA pour ${s.fullFr}.` : `AI solutions for ${s.fullFr}.`}
                  </span>
                  <span className="text-terracotta mt-auto pt-2 text-sm font-semibold">
                    {isFr ? "Voir les cas d'usage →" : "See use cases →"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <p className="text-fg-muted mt-8 text-xs">
          {isFr ? "Photos d'illustration : " : "Illustration photos: "}
          <a
            href="https://unsplash.com/?utm_source=axion-ia&utm_medium=referral"
            target="_blank"
            rel="nofollow noopener"
            className="hover:text-fg underline-offset-2 hover:underline"
          >
            Unsplash
          </a>
          {isFr
            ? " — crédits photographes détaillés sur chaque page secteur."
            : " — detailed photographer credits on each sector page."}
        </p>
      </Section>

      <StickyMobileCta
        href="/appel"
        label={isFr ? "Réserver un appel" : "Book a call"}
        track="secteurs-hub-sticky-call"
        threshold={500}
      />

      <JsonLd data={collectionPageJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {secteursImagesJsonLd ? <JsonLd data={secteursImagesJsonLd} /> : null}
      <JsonLd
        data={itemListJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-secteurs-itemlist"
      />
    </>
  );
}
