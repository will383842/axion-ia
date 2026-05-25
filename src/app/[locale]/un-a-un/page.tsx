// Hub canonique 4e verticale `un-a-un`.
// 1 personne ↔ 1 expert IA Axion-IA — coaching individuel, format flexible.
// Cible : tout collaborateur (manager, RH, commercial, opérateur, dirigeant).
//
// Sprint A Phase 3 — refactor : page assembleuse de composants Phase 2 sous
// `src/components/services/un-a-un/`. Le contenu détaillé (hero, cible,
// méthodologie, FAQ, CTA final) est encapsulé dans des composants partagés
// avec les pages ville `/fr/implantations/{region}/{ville}/un-a-un`.

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildServiceJsonLd } from "@/lib/seo";
import { UN_A_UN_TIERS, getEntryTier } from "@/content/pricing";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { UnAUnHero } from "@/components/services/un-a-un/UnAUnHero";
import { UnAUnTarget } from "@/components/services/un-a-un/UnAUnTarget";
import { UnAUnMethodology } from "@/components/services/un-a-un/UnAUnMethodology";
import { UnAUnFaq } from "@/components/services/un-a-un/UnAUnFaq";
import { UnAUnCtaBlock } from "@/components/services/un-a-un/UnAUnCtaBlock";

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: isFr ? "/un-a-un" : "/one-to-one",
    title: isFr
      ? "Coaching IA individuel 1-to-1 · Axion-IA"
      : "1-to-1 individual AI coaching · Axion-IA",
    description: isFr
      ? "1 expert IA dédié à 1 personne. Coaching individuel calibré sur le poste et les objectifs du collaborateur — manager, RH, commercial, dirigeant. Résultats mesurables."
      : "1 AI expert dedicated to 1 person. Coaching calibrated to role and objectives — manager, HR, sales, executive. Measurable results.",
    alternates: { fr: "/un-a-un", en: "/one-to-one" },
  });
}

export default async function UnAUnHubPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";
  const path = isFr ? "/un-a-un" : "/one-to-one";
  const entryTier = getEntryTier(UN_A_UN_TIERS);

  const serviceJsonLd = buildServiceJsonLd({
    locale,
    path,
    name: isFr ? "Coaching IA individuel 1-to-1" : "1-to-1 individual AI coaching",
    description: isFr
      ? "Accompagnement individuel IA : 1 collaborateur accompagné par 1 expert Axion-IA. Sessions calibrées sur le poste, les outils et les objectifs de la personne. Partout en France métropolitaine."
      : "Individual AI coaching: 1 employee coached by 1 Axion-IA expert. Sessions calibrated to the role, tools and objectives of the person. Anywhere in metropolitan France.",
    serviceType: isFr ? "Coaching IA individuel" : "Individual AI coaching",
    priceEur: entryTier.priceFlat ?? 990,
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs
          items={[{ href: path, label: isFr ? "Accompagnement 1-to-1" : "1-to-1 coaching" }]}
        />
      </Container>

      <UnAUnHero isFr={isFr} />
      <UnAUnTarget isFr={isFr} />
      <UnAUnMethodology isFr={isFr} />

      {/* Couverture nationale — composant centralisé Sprint 14.9 levier 3 */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'accompagnement 1-to-1 IA"
        serviceLabelEn="1-to-1 AI coaching"
        serviceSlug="un-a-un"
        tone="paper"
      />

      {/* FAQ géo locale — composant centralisé (FAQS_BY_SERVICE pré-existants) */}
      <LocalGeoFaqSection isFr={isFr} service="un-a-un" tone="sand" />

      <UnAUnFaq isFr={isFr} />
      <UnAUnCtaBlock isFr={isFr} />

      {/* CTA mobile sticky — apparaît au scroll, masqué sur lg+ */}
      <StickyMobileCta
        href="/contact"
        label={isFr ? "Démarrer mon 1-to-1" : "Start my 1-to-1"}
        track="un-a-un-sticky-mobile"
      />

      <JsonLd data={serviceJsonLd} />
    </>
  );
}
