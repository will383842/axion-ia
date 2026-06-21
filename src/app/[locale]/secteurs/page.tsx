import type { Metadata } from "next";
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
import {
  buildProductMetadata,
  buildItemListJsonLd,
  buildBreadcrumbJsonLd,
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
      >
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {CLIENT_SECTORS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/${loc}/secteurs/${s.slug}`}
                className="border-border hover:bg-paper flex h-full flex-col gap-2 rounded-2xl border p-6 transition"
              >
                <span className="text-3xl" aria-hidden="true">
                  {s.emoji}
                </span>
                <span className="text-fg text-lg font-semibold">{s.labelFr}</span>
                <span className="text-fg-soft text-sm">
                  {isFr ? `Solutions IA pour ${s.fullFr}.` : `AI solutions for ${s.fullFr}.`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <StickyMobileCta
        href="/reserver"
        label={isFr ? "Réserver un appel" : "Book a call"}
        track="secteurs-hub-sticky-call"
        threshold={500}
      />

      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd
        data={itemListJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-secteurs-itemlist"
      />
    </>
  );
}
