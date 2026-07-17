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

// Sprint 14.10.8 (Will 2026-05-12) — wrapper Audit Flash via template SSOT.

const TIER = "audit-flash" as const;

// SSOT prix — dérivé de pricing.ts (audit-flash : 1190 € HT présentiel, 1 journée
// complète sur site — Will 2026-05-31, suppression du 490 € distanciel).
const FLASH_TIER = getTierById(AUDIT_TIERS, "audit-flash");
const FLASH_ONSITE = FLASH_TIER.priceFlat ?? 0;

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
    path: "/audit/tpe-1-jour",
    // Will 2026-07-17 — les audits s'annoncent toujours en « à partir de ». Ici
    // « dès » et non le « À partir de » de `formatTierPrice` : le title SERP
    // tient en ~60 car. et « À partir de » le pousserait à 72 (tronqué par
    // Google). Même sens, montant toujours issu du SSOT.
    title: isFr
      ? `Audit IA sur place · dès ${formatAmount(FLASH_ONSITE, "fr", { compact: true })} · 1 journée · Axion-IA`
      : `On-site AI audit · from ${formatAmount(FLASH_ONSITE, "en", { compact: true })} · 1 full day · Axion-IA`,
    description: isFr ? c.promiseFr : c.promiseEn,
    alternates: { fr: "/audit/tpe-1-jour", en: "/audit/tpe-1-jour" },
  });
}

export default async function AuditFlashPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // ImageObject @graph — Sprint AEO Phase 5 2026-05-28 (Will). Photo équipe
  // + portrait fondateur pour exposition Google Images + AI Overviews sur
  // requêtes « audit flash IA », « audit IA TPE PME 490 € sur site ».
  const c = AUDIT_DETAIL_CONFIGS[TIER];
  const imagesJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: "/audit/tpe-1-jour" });
  // Nœud WebPage — porteur VALIDE du `speakable` (h1/h2 + réponses) + `primaryImageOfPage`.
  const webPageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: "/audit/tpe-1-jour",
    name: isFr
      ? "Audit IA sur place · 1 journée complète · Axion-IA"
      : "On-site AI audit · 1 full day · Axion-IA",
    description: isFr ? c.promiseFr : c.promiseEn,
    speakable: true,
    ...(buildPrimaryImageOfPage("/audit/tpe-1-jour")
      ? { extra: { primaryImageOfPage: buildPrimaryImageOfPage("/audit/tpe-1-jour") } }
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
