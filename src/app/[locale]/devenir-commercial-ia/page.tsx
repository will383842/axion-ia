// Hub /devenir-commercial-ia — page France générique (recrutement commerciaux).
// Module INDÉPENDANT (ne réutilise rien en écriture des pages services). Le
// corps (sections) est partagé avec la page [ville] via CommercialPageBody ;
// ici `ville` est omis → pas de section locale (page nationale).

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  CommercialPageBody,
  buildCommercialFaqItems,
} from "@/components/services/devenir-commercial/CommercialPageBody";
import { buildCommercialKeywords } from "@/content/recrutement/commercial-offer";
import { COMMERCIAL_OFFER_DATE_POSTED } from "@/content/recrutement/dates";
import { getHubLocations } from "@/content/recrutement/satellites";
import { getRegion } from "@/content/regions";
import { buildProductMetadata, buildFaqJsonLd, buildWebPageJsonLd, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const title = isFr
    ? "Devenir commercial IA indépendant · revenus déplafonnés · Axion-IA"
    : "Become an independent AI sales rep · uncapped income · Axion-IA";
  return {
    ...buildProductMetadata({
      locale,
      path: "/devenir-commercial-ia",
      title,
      description: isFr
        ? "Emploi commercial dans l'IA partout en France : devenez commercial indépendant (agent commercial, VRP, apporteur d'affaires) et vendez formations, audits et intégrations IA aux TPE, PME, ETI, artisans, commerçants et grandes entreprises. Statut libre, revenus déplafonnés, emploi du temps libre — démarrer ne coûte rien."
        : "Sales job in AI across France: become an independent sales rep and sell AI trainings, audits and integrations to small businesses, SMEs, mid-caps and large enterprises. Free status, uncapped income — getting started costs nothing.",
    }),
    title: { absolute: title },
    keywords: buildCommercialKeywords(),
  };
}

export default async function DevenirCommercialHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const faqItems = buildCommercialFaqItems();
  const faqJsonLd = buildFaqJsonLd({
    items: faqItems.map((it) => ({
      question: isFr ? it.q.fr : it.q.en,
      answer: isFr ? it.a.fr : it.a.en,
    })),
  });

  // JobPosting MULTI-LIEUX (40 hubs) → Google for Jobs fait remonter l'offre
  // pour chaque ville et ses alentours (par proximité), depuis CETTE page France
  // indexée — sans exposer 40 landing pages quasi-dupliquées (anti-doorway).
  const hubPlaces = getHubLocations().map((h) => {
    const regionLabel = getRegion(h.regionSlug)?.nameFr;
    return {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: h.nameFr,
        ...(regionLabel ? { addressRegion: regionLabel } : {}),
        addressCountry: "FR",
      },
    };
  });

  // Pas de validThrough : offre permanente (décision Will 2026-07-03). L'annonce
  // reste active jusqu'à retrait manuel — cohérent avec les offres DB (job-posting.ts).
  const jobJsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: isFr
      ? "Commercial indépendant en IA (agent commercial / VRP)"
      : "Independent AI sales representative",
    description: isFr
      ? "Axion-IA recrute des commerciaux indépendants partout en France pour vendre ses formations, audits, accompagnements 1-to-1 et intégrations IA aux TPE, PME, ETI, artisans, commerçants et grandes entreprises. Statut indépendant, produits souvent finançables, rémunération à la commission déplafonnée, emploi du temps libre."
      : "Axion-IA is hiring independent sales reps across France to sell its AI trainings, audits, 1-on-1 support and integrations to companies of all sizes. Self-employed status, often-fundable products, uncapped commission-based pay.",
    datePosted: COMMERCIAL_OFFER_DATE_POSTED,
    employmentType: "CONTRACTOR",
    occupationalCategory: isFr
      ? "Commercial · Agent commercial · VRP · Apporteur d'affaires"
      : "Sales representative · Independent agent",
    industry: isFr
      ? "Intelligence artificielle · Formation · Services aux entreprises"
      : "Artificial intelligence · Training · Business services",
    skills: isFr
      ? "Prospection commerciale, vente B2B, relation client, sens du contact"
      : "Sales prospecting, B2B selling, client relationship, communication",
    qualifications: isFr
      ? "Fibre commerciale et motivation. Débutants acceptés : nous formons à l'offre IA."
      : "Sales instinct and motivation. Beginners welcome: we train you on the AI offer.",
    responsibilities: isFr
      ? "Démarcher les entreprises, présenter l'offre IA, suivre les comptes sur un dashboard, conclure des ventes."
      : "Prospect companies, present the AI offer, track accounts on a dashboard, close sales.",
    jobBenefits: isFr
      ? "Statut indépendant, revenus déplafonnés, emploi du temps libre, démarrage sans coût, portefeuille conservé, formation à l'offre."
      : "Self-employed status, uncapped income, flexible schedule, no-cost start, keep your portfolio, training provided.",
    incentiveCompensation: isFr
      ? "Rémunération 100 % à la commission : montant fixe par formation vendue, pourcentage de la facture sur les audits et intégrations. Revenus non plafonnés."
      : "100% commission-based pay: flat amount per training sold, percentage of the invoice on audits and integrations. Uncapped income.",
    hiringOrganization: {
      "@type": "Organization",
      name: "Axion-IA (axion-ia.com)",
      url: SITE_URL,
      sameAs: SITE_URL,
    },
    jobLocation: hubPlaces,
    applicantLocationRequirements: { "@type": "Country", name: "France" },
    directApply: true,
    url: `${SITE_URL}/${loc}/devenir-commercial-ia/candidature`,
  } as const;

  // WebPage + Speakable (AEO vocal : titres + réponses directes lisibles à voix haute).
  const webpageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: "/devenir-commercial-ia",
    name: isFr ? "Devenir commercial IA · Axion-IA" : "Become an AI sales rep · Axion-IA",
    speakable: { selectors: ["h1", "[data-speakable]"] },
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs
          items={[
            { href: "/devenir-commercial-ia", label: isFr ? "Devenir commercial" : "Become a rep" },
          ]}
        />
      </Container>

      <CommercialPageBody isFr={isFr} />

      <JsonLd data={jobJsonLd} />
      <JsonLd
        data={webpageJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-commercial-webpage"
      />
      <JsonLd data={faqJsonLd} strategy="afterInteractive" scriptId="jsonld-commercial-faq" />
    </>
  );
}
