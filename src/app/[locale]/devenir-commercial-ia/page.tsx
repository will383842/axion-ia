// Hub /devenir-commercial-ia — page France générique du réseau d'apporteurs
// d'affaires indépendants (l'URL historique est gardée : elle est indexée).
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
import { COMMISSION_FORMATION_PAR_JOURNEE_EUR } from "@/content/pricing";
import { buildCommercialKeywords } from "@/content/recrutement/commercial-offer";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { buildProductMetadata, buildFaqJsonLd, buildWebPageJsonLd } from "@/lib/seo";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  // 2026-09-19 (P4) — « vendue » devient « payée » : un apporteur recommande,
  // il ne vend pas, et sa commission est due à l'encaissement, pas à la vente.
  // 2026-09-29 (JUR-T29) — le montant vient de `pricing.ts` et se dit indicatif,
  // dans le titre comme dans la description ; « signée » et « sans plafond » sortent.
  const jour = COMMISSION_FORMATION_PAR_JOURNEE_EUR;
  const title = isFr
    ? `Apporteur d'affaires IA indépendant · ${jour} € indicatifs par journée payée`
    : `Independent AI business referrer · €${jour} per paid day, as a guide`;
  return {
    ...(await buildProductMetadata({
      locale,
      path: "/devenir-commercial-ia",
      title,
      description: isFr
        ? `À titre indicatif, ${jour} € pour vous par journée de formation IA payée. L'AI Act crée des obligations pour les entreprises qui utilisent l'IA.`
        : `As a guide, €${jour} for you per paid AI training day. The AI Act sets obligations for companies that use AI.`,
    })),
    title: { absolute: title },
    keywords: buildCommercialKeywords({ financementAffichable: isQualiopiCertificationObtenue() }),
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

  // ⛔ Plus d'offre d'emploi schema.org ici (décision Will 2026-09-19, B5). Ce
  // JSON-LD déclarait à Google un POSTE — employeur, « type d'emploi », statuts
  // de mandataire en catégorie — pour une activité d'apporteur d'affaires
  // indépendant, sans mandat ni lien de subordination : exactement la pièce
  // qu'un juge lirait comme l'annonce d'un salariat déguisé. La page et son URL
  // restent, indexées ; seule l'offre d'emploi Google disparaît (perte de
  // Google for Jobs assumée). Ne pas la réintroduire sans repasser par Will —
  // `tests/unit/seo/plus-d-offre-d-emploi-google-pour-les-apporteurs.spec.tsx` la refuse.

  // WebPage + Speakable (AEO vocal : titres + réponses directes lisibles à voix haute).
  const webpageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: "/devenir-commercial-ia",
    name: isFr
      ? "Devenir apporteur d'affaires IA · Axion-IA"
      : "Become an AI business referrer · Axion-IA",
    speakable: { selectors: ["h1", "[data-speakable]"] },
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs
          items={[
            {
              href: "/devenir-commercial-ia",
              label: isFr ? "Devenir apporteur d'affaires" : "Become a referrer",
            },
          ]}
        />
      </Container>

      <CommercialPageBody isFr={isFr} />

      <JsonLd
        data={webpageJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-commercial-webpage"
      />
      <JsonLd data={faqJsonLd} strategy="afterInteractive" scriptId="jsonld-commercial-faq" />
    </>
  );
}
