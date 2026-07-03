// Hub /implementation/par-fonction (audit maillage 2026-07-03).
//
// Avant, les pages `/implementation/par-fonction/[slug]` (catalogue par fonction
// métier) n'avaient AUCUN lien entrant HTML ni page hub — découvrables au sitemap
// uniquement. Ce hub les de-orphelinise (parité avec /implementation/par-techno)
// et donne une porte d'entrée « par fonction d'entreprise » complémentaire de
// l'entrée « par brique techno ».

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
import { AUTOMATISATIONS } from "@/content/automatisations";
import { buildProductMetadata, buildItemListJsonLd, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? "/implementation/par-fonction" : "/implementation/by-function",
    title:
      locale === "fr"
        ? "Automatisation IA par fonction d'entreprise · Axion-IA"
        : "AI automation by business function · Axion-IA",
    description:
      locale === "fr"
        ? "Automatisations IA par fonction : service client, ventes & prospection, marketing, opérations, finance, RH… Ce que l'on installe chez vous, en forfait fixe, sans abonnement."
        : "AI automation by business function: customer service, sales & prospecting, marketing, operations, finance, HR… What we install for you, fixed price, no subscription.",
    alternates: {
      fr: "/implementation/par-fonction",
      en: "/implementation/by-function",
    },
  });
}

export default async function ImplementationByFunctionPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [
    { href: "/implementation", label: isFr ? "Implémentation IA" : "AI implementation" },
    {
      href: isFr ? "/implementation/par-fonction" : "/implementation/by-function",
      label: isFr ? "Par fonction" : "By function",
    },
  ];

  // ItemList JSON-LD — expose les catégories par fonction (AEO/GEO : chaque
  // catégorie a sa page dédiée `pathFr`/`pathEn`).
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: isFr ? "/implementation/par-fonction" : "/implementation/by-function",
    name: isFr
      ? "Automatisations IA Axion-IA · par fonction d'entreprise"
      : "Axion-IA AI automations · by business function",
    items: AUTOMATISATIONS.map((cat, idx) => {
      const c = cat[loc];
      return {
        position: idx + 1,
        name: c.cardTitle,
        url: `${SITE_URL}/${loc}${isFr ? cat.pathFr : cat.pathEn}`,
      };
    }),
  });

  return (
    <>
      <JsonLd data={itemListJsonLd} />

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={isFr ? "Module 3 · Par fonction métier" : "Module 3 · By business function"}
        title={isFr ? "Automatisez par" : "Automate by"}
        titleEm={isFr ? "fonction d'entreprise" : "business function"}
        description={
          isFr
            ? "Vous raisonnez en métiers (service client, ventes, marketing, opérations…) ? Voici, fonction par fonction, ce que l'on installe chez vous — en forfait fixe, sans abonnement."
            : "You think in terms of business functions (customer service, sales, marketing, operations…)? Here is, function by function, what we install for you — fixed price, no subscription."
        }
      />

      <Section eyebrow={isFr ? "Catalogue par fonction" : "Catalogue by function"}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AUTOMATISATIONS.map((cat) => {
            const c = cat[loc];
            return (
              <li key={cat.slug}>
                <CaseStudyCard
                  href={(isFr ? cat.pathFr : cat.pathEn) as never}
                  title={c.cardTitle}
                  excerpt={c.cardTagline}
                  industry={c.eyebrow}
                />
              </li>
            );
          })}
        </ul>
      </Section>

      <CtaBlock
        title={isFr ? "Vous ne savez pas par où commencer ?" : "Not sure where to start?"}
        description={
          isFr
            ? "Décrivez votre besoin : on vous oriente vers la fonction où l'IA vous rapportera le plus vite."
            : "Describe your need: we point you to the function where AI will pay off fastest for you."
        }
        cta={
          <Cta href="/contact" size="lg" track="par-fonction-contact">
            {isFr ? "Décrire mon besoin" : "Describe my need"} →
          </Cta>
        }
        tone="dark"
      />
    </>
  );
}
