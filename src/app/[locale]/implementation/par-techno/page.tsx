import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CaseStudyCard } from "@/components/marketing/CaseStudyCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { IMPLEMENTATIONS } from "@/content/implementation";
import {
  IMPLEMENTATION_TIERS,
  formatAmount,
  formatAmountRange,
  getEntryPriceEur,
  getTierById,
} from "@/content/pricing";
import { buildProductMetadata, buildItemListJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? "/implementation/par-techno" : "/implementation/by-technology",
    title:
      locale === "fr"
        ? "Implémentation IA par technologie · 9 prestations · Axion-IA"
        : "AI implementation by technology · 9 services · Axion-IA",
    description:
      locale === "fr"
        ? "9 prestations d'implémentation IA par brique technologique : chatbot, agents autonomes, structuration, CRM/ERP, documents, intégrations, no-code, IA Custom premium."
        : "9 AI implementation services by tech building block: chatbot, autonomous agents, structuring, CRM/ERP, documents, integrations, no-code, premium custom AI.",
    alternates: {
      fr: "/implementation/par-techno",
      en: "/implementation/by-technology",
    },
  });
}

export default async function ImplementationByTechPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/implementation", label: isFr ? "Implémentation IA" : "AI implementation" },
    {
      href: isFr ? "/implementation/par-techno" : "/implementation/by-technology",
      label: isFr ? "Par technologie" : "By technology",
    },
  ];

  // ItemList JSON-LD — expose les 9 prestations IMPLEMENTATIONS au crawler
  // (AEO/GEO 2026 : LLMs résolvent « quelles prestations IA Axion-IA par
  // brique technologique ? » avec URL par item — chaque slug a sa page
  // dédiée /implementation/${slug}).
  const detailPath = isFr ? "/implementation/par-techno" : "/implementation/by-technology";
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: detailPath,
    name: isFr
      ? "9 prestations d'implémentation IA Axion-IA · par technologie"
      : "9 Axion-IA AI implementation services · by technology",
    items: IMPLEMENTATIONS.map((item, idx) => {
      const c = item[loc];
      return {
        position: idx + 1,
        name: c.title,
        url: `${SITE_URL}/${loc}/implementation/${item.slug}`,
        description: c.answer.slice(0, 200),
      };
    }),
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Module 3 · Approche techno" : "Module 3 · Tech-driven"}
        title={isFr ? "Implémentation IA par" : "AI implementation by"}
        titleEm={isFr ? "brique techno" : "building block"}
        description={
          isFr
            ? `Si vous raisonnez en briques techniques (chatbot, agents autonomes, structuration de données, IA Custom...), 9 prestations packagées vous attendent. De ${formatAmount(getEntryPriceEur(IMPLEMENTATION_TIERS) ?? 0, "fr", { compact: true })} à ${formatAmount(getTierById(IMPLEMENTATION_TIERS, "impl-ia-custom").priceMax!, "fr")}, livraison 2 à 12 semaines.`
            : `If you think in technical building blocks (chatbot, autonomous agents, data structuring, custom AI...), 9 packaged services are ready. From ${formatAmount(getEntryPriceEur(IMPLEMENTATION_TIERS) ?? 0, "en", { compact: true })} to ${formatAmount(getTierById(IMPLEMENTATION_TIERS, "impl-ia-custom").priceMax!, "en")}, 2-12 week delivery.`
        }
      />

      <Section eyebrow={isFr ? "9 prestations packagées" : "9 packaged services"}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {IMPLEMENTATIONS.map((item) => {
            const c = item[loc];
            return (
              <li key={item.slug}>
                <CaseStudyCard
                  href={`/implementation/${item.slug}`}
                  title={c.title}
                  excerpt={c.answer.slice(0, 160) + "…"}
                  industry={c.eyebrow}
                />
              </li>
            );
          })}
        </ul>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Premium" : "Premium"}
        title={isFr ? "IA Custom · grands comptes" : "Custom AI · large accounts"}
        description={
          isFr
            ? `Pour les implémentations sur mesure ${formatAmountRange(getTierById(IMPLEMENTATION_TIERS, "impl-ia-custom").priceMin!, getTierById(IMPLEMENTATION_TIERS, "impl-ia-custom").priceMax!, "fr")}. Équipe dédiée, modèles fine-tuned sur vos données.`
            : `For tailor-made implementations ${formatAmountRange(getTierById(IMPLEMENTATION_TIERS, "impl-ia-custom").priceMin!, getTierById(IMPLEMENTATION_TIERS, "impl-ia-custom").priceMax!, "en")}. Dedicated team, models fine-tuned on your data.`
        }
        cta={
          <Cta href="/implementation/ia-custom" size="lg" track="par-techno-iacustom">
            {isFr ? "Découvrir IA Custom" : "Discover Custom AI"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={itemListJsonLd} />
    </>
  );
}
