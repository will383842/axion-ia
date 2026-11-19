import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { AuditDetailPage } from "@/components/sections/AuditDetailPage";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AUDIT_DETAIL_CONFIGS } from "@/content/audit-detail-configs";
import {
  buildProductMetadata,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  buildWebPageJsonLd,
} from "@/lib/seo";

// Sprint 14.10.8 (Will 2026-05-12) — wrapper Audit Stratégique PME via template.

const TIER = "audit-strategique-pme" as const;

// Aucun montant dans les métadonnées (R5a, décision n°7) : les audits sont sur devis.

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const c = AUDIT_DETAIL_CONFIGS[TIER];
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: isFr ? "/audit/strategique-pme" : "/audit/strategic-pme",
    title: isFr
      ? `Audit Stratégique PME · sur devis · Axion-IA`
      : `SME Strategic AI audit · on request · Axion-IA`,
    description: isFr ? c.promiseFr : c.promiseEn,
    alternates: { fr: "/audit/strategique-pme", en: "/audit/strategic-pme" },
  });
}

export default async function AuditStrategiquePmePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // ImageObject @graph — Sprint AEO Phase 5 2026-05-28 (Will). Photo équipe
  // + portrait fondateur pour exposition Google Images + AI Overviews sur
  // requêtes « audit stratégique PME », « audit IA PME 50 à 250 salariés ».
  const c = AUDIT_DETAIL_CONFIGS[TIER];
  const path = isFr ? "/audit/strategique-pme" : "/audit/strategic-pme";
  const imagesJsonLd = buildPageImageGraphJsonLd({
    locale: loc,
    path: "/audit/strategique-pme",
  });
  // Nœud WebPage — porteur VALIDE du `speakable` (h1/h2 + réponses) + `primaryImageOfPage`.
  const webPageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path,
    name: isFr ? "Audit Stratégique PME · Axion-IA" : "SME Strategic AI audit · Axion-IA",
    description: isFr ? c.promiseFr : c.promiseEn,
    speakable: true,
    ...(buildPrimaryImageOfPage("/audit/strategique-pme")
      ? { extra: { primaryImageOfPage: buildPrimaryImageOfPage("/audit/strategique-pme") } }
      : {}),
  });

  return (
    <>
      <AuditDetailPage tier={TIER} locale={loc} />
      <JsonLd data={webPageJsonLd} />
      {imagesJsonLd ? <JsonLd data={imagesJsonLd} /> : null}
    </>
  );
}
