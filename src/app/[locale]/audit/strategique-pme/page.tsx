import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { AuditDetailPage } from "@/components/sections/AuditDetailPage";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AUDIT_DETAIL_CONFIGS } from "@/content/audit-detail-configs";
import { buildProductMetadata, buildImageGraphJsonLd } from "@/lib/seo";
import { AUDIT_TIERS, getTierById, formatAmount, formatAmountRange } from "@/content/pricing";

// Sprint 14.10.8 (Will 2026-05-12) — wrapper Audit Stratégique PME via template.

const TIER = "audit-strategique-pme" as const;

// SSOT prix — dérivé de pricing.ts (audit-strategique-pme : priceMin 4900, priceMax 9900).
const PME_TIER = getTierById(AUDIT_TIERS, "audit-strategique-pme");
const PME_MIN = PME_TIER.priceMin ?? 0;
const PME_MAX = PME_TIER.priceMax ?? 0;
// Format FR original « 4 900 → 9 900 € » : un seul « € » en fin (borne min sans « € »).
const PME_RANGE_FR_SINGLE_EUR = `${formatAmount(PME_MIN, "fr", { compact: true }).replace(" €", "")} → ${formatAmount(PME_MAX, "fr", { compact: true })}`;

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
      ? `Audit Stratégique PME · ${PME_RANGE_FR_SINGLE_EUR} · Axion-IA`
      : `SME Strategic AI audit · ${formatAmountRange(PME_MIN, PME_MAX, "en", { compact: true })} · Axion-IA`,
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
  const imagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — audit stratégique IA PME multi-départements"
          : "Axion-IA team — SME strategic AI audit across departments",
        alt: isFr
          ? "Équipe Axion-IA en mission d'audit stratégique IA PME — cabinet IA opérationnel français accompagnant les PME (10-250 salariés) avec cartographie IA exhaustive, ROI chiffré et roadmap 6-12 mois."
          : "Axion-IA team in SME strategic AI audit assignment — French operational AI consultancy supporting SMEs (10-250 employees) with exhaustive AI mapping, quantified ROI and 6-12 month roadmap.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "William — Fondateur Axion-IA, auditeur stratégique IA PME"
          : "William — Axion-IA founder, SME strategic AI auditor",
        alt: isFr
          ? "Portrait de William, fondateur d'Axion-IA. Conduit personnellement les audits stratégiques IA pour dirigeants PME — vision IA d'entreprise, gouvernance, priorisation cas d'usage par valeur, plan d'implémentation 6-12 mois."
          : "Portrait of William, Axion-IA founder. Personally conducts strategic AI audits for SME executives — enterprise AI vision, governance, value-driven use case prioritization, 6-12 month implementation plan.",
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
