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
import { AUDIT_TIERS, getTierById, formatAmount } from "@/content/pricing";

// Sprint 14.10.8 (Will 2026-05-12) — wrapper Audit Stratégique ETI via template.

const TIER = "audit-strategique-eti" as const;

// SSOT prix — dérivé de pricing.ts (audit-strategique-eti : « À partir de 1 900 € »
// depuis 2026-06-03 ; ex-12 000 €, cf. décision Will).
const ETI_TIER = getTierById(AUDIT_TIERS, "audit-strategique-eti");
const ETI_MIN = ETI_TIER.priceMin ?? 0;

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
    path: isFr ? "/audit/strategique-eti" : "/audit/strategic-eti",
    title: isFr
      ? `Audit Stratégique ETI · à partir de ${formatAmount(ETI_MIN, "fr", { compact: true })} · Axion-IA`
      : `Mid-cap Strategic AI audit · from ${formatAmount(ETI_MIN, "en", { compact: true })} · Axion-IA`,
    description: isFr ? c.promiseFr : c.promiseEn,
    alternates: { fr: "/audit/strategique-eti", en: "/audit/strategic-eti" },
  });
}

export default async function AuditStrategiqueEtiPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // ImageObject @graph — Sprint AEO Phase 5 2026-05-28 (Will). Photo équipe
  // + portrait fondateur pour exposition Google Images + AI Overviews sur
  // requêtes « audit stratégique ETI », « audit IA multi-BU 250+ salariés ».
  const c = AUDIT_DETAIL_CONFIGS[TIER];
  const path = isFr ? "/audit/strategique-eti" : "/audit/strategic-eti";
  const imagesJsonLd = buildPageImageGraphJsonLd({
    locale: loc,
    path: "/audit/strategique-eti",
  });
  // Nœud WebPage — porteur VALIDE du `speakable` (h1/h2 + réponses) + `primaryImageOfPage`.
  const webPageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path,
    name: isFr ? "Audit Stratégique ETI · Axion-IA" : "Mid-cap Strategic AI audit · Axion-IA",
    description: isFr ? c.promiseFr : c.promiseEn,
    speakable: true,
    ...(buildPrimaryImageOfPage("/audit/strategique-eti")
      ? { extra: { primaryImageOfPage: buildPrimaryImageOfPage("/audit/strategique-eti") } }
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
