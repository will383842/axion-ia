import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { AuditDetailPage } from "@/components/sections/AuditDetailPage";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AUDIT_DETAIL_CONFIGS } from "@/content/audit-detail-configs";
import { buildProductMetadata, buildImageGraphJsonLd } from "@/lib/seo";
import { AUDIT_TIERS, getTierById, formatAmount } from "@/content/pricing";

// Sprint 14.10.8 (Will 2026-05-12) — wrapper Audit Stratégique ETI via template.

const TIER = "audit-strategique-eti" as const;

// SSOT prix — dérivé de pricing.ts (audit-strategique-eti : priceMin 12000).
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
  const imagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — audit stratégique IA ETI multi-BU"
          : "Axion-IA team — mid-cap strategic AI audit, multi-BU",
        alt: isFr
          ? "Équipe Axion-IA en mission d'audit stratégique IA ETI — cabinet IA opérationnel français pour entreprises de taille intermédiaire (250+ salariés, multi-BU), avec gouvernance IA, cartographie cross-fonctions et roadmap exécutive."
          : "Axion-IA team in mid-cap strategic AI audit assignment — French operational AI consultancy for mid-cap enterprises (250+ employees, multi-BU), with AI governance, cross-function mapping and executive roadmap.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "William — Fondateur Axion-IA, auditeur stratégique IA ETI"
          : "William — Axion-IA founder, mid-cap strategic AI auditor",
        alt: isFr
          ? "Portrait de William, fondateur d'Axion-IA. Conduit personnellement les audits stratégiques IA ETI — interview comité exécutif, gouvernance IA multi-BU, AI Act compliance, plan stratégique IA pluri-annuel."
          : "Portrait of William, Axion-IA founder. Personally conducts mid-cap strategic AI audits — executive committee interviews, multi-BU AI governance, AI Act compliance, multi-year strategic AI plan.",
        width: 800,
        height: 1000,
        encodingFormat: "image/avif",
      },
    ],
  });

  return (
    <>
      <AuditDetailPage tier={TIER} locale={loc} />
      <JsonLd data={imagesJsonLd} />
    </>
  );
}
