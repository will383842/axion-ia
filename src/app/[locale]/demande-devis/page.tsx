// Page publique parcours B (Sprint X.5bis — Booking V1).
//
// /fr/demande-devis (FR) + /en/request-quote (EN) — formulaire qualifié pour
// les formats > 5 000 € HT / IA Custom / packs annuels. Pas de slot calendrier.
//
// Cf. 04-PLAN-EXECUTION Sprint X.5bis + UX-E2E-VERIFICATION.

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { UnifiedContactForm } from "@/components/forms/UnifiedContactForm";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ intervention?: string }>;
}

const COPY = {
  fr: {
    title: "Demande de devis qualifiée",
    titleEm: "pour projets sur-mesure",
    description:
      "Pour les formats > 5 000 € HT, IA Custom, packs annuels ou transformations multi-services : remplissez ce formulaire qualifié. William vous recontactera sous 24-48 h ouvrées pour un appel de cadrage personnalisé.",
    breadcrumb: "Demande de devis",
  },
  en: {
    title: "Qualified quote request",
    titleEm: "for custom projects",
    description:
      "For formats > €5,000 (excl. VAT), custom AI, annual packs, or multi-department transformations: fill in this qualified form. William will get back to you within 24-48 business hours for a personalized scoping call.",
    breadcrumb: "Quote request",
  },
} as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const path = isFr ? "/demande-devis" : "/request-quote";
  return buildProductMetadata({
    locale,
    path,
    title: isFr
      ? "Demande de devis · projets IA sur-mesure · Axion-IA"
      : "AI project quote request · Axion-IA",
    description: isFr
      ? "Formulaire pour formats > 5 000 € HT, IA Custom, packs annuels. Réponse sous 24-48 h ouvrées."
      : "Form for formats > €5,000, custom AI, annual packs. Reply within 24-48 business hours.",
    alternates: { fr: "/demande-devis", en: "/request-quote" },
  });
}

export default async function DemandeDevisPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";
  const t = COPY[locale === "fr" ? "fr" : "en"];
  const sp = await searchParams;
  const defaultIntervention = sp.intervention?.trim() || undefined;

  const breadcrumbItems = [{ href: "/demande-devis", label: t.breadcrumb }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <section className="bg-halo-warm relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <Container className="relative">
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Parcours sur-mesure" : "Custom path"}
            </p>
            <h1 className="display-editorial text-fg mt-5">
              {t.title}{" "}
              <span
                className="text-terracotta-deep mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {t.titleEm}
              </span>
            </h1>
            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {t.description}
            </p>
          </div>
        </Container>
      </section>

      <section className="py-12 sm:py-16">
        <Container className="max-w-2xl">
          <UnifiedContactForm
            defaultType="audit"
            advancedOpenByDefault
            source="/demande-devis"
            {...(defaultIntervention ? { defaultSubType: defaultIntervention } : {})}
          />
        </Container>
      </section>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "OrderAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/${locale}/demande-devis`,
            actionPlatform: [
              "http://schema.org/DesktopWebPlatform",
              "http://schema.org/MobileWebPlatform",
            ],
          },
          result: {
            "@type": "Order",
            orderStatus: "http://schema.org/OrderProcessing",
            name: isFr
              ? "Demande de devis personnalisé · Axion-IA"
              : "Custom quote request · Axion-IA",
          },
        }}
        strategy="afterInteractive"
        scriptId="jsonld-order-action"
      />
    </>
  );
}
