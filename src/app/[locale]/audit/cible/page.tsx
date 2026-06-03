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

// Sprint 14.10.8 (Will 2026-05-12) — wrapper Audit Ciblé via template SSOT.
// Remplace /audit/process (renommé selon doctrine pricing.ts AUDIT_TIERS).

const TIER = "audit-cible" as const;

// SSOT prix — dérivé de pricing.ts (audit-cible : « À partir de 1 900 € · sur
// devis » depuis 2026-06-03 ; ex-fourchette 1 900–3 900 €, cf. décision Will).
const CIBLE_TIER = getTierById(AUDIT_TIERS, "audit-cible");
const CIBLE_MIN = CIBLE_TIER.priceMin ?? 0;
const CIBLE_FROM_FR = formatAmount(CIBLE_MIN, "fr", { compact: true });
const CIBLE_FROM_EN = formatAmount(CIBLE_MIN, "en", { compact: true });

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
    path: isFr ? "/audit/cible" : "/audit/targeted",
    title: isFr
      ? `Audit IA Ciblé · 1 département · à partir de ${CIBLE_FROM_FR} · Axion-IA`
      : `Targeted AI audit · 1 department · from ${CIBLE_FROM_EN} · Axion-IA`,
    description: isFr ? c.promiseFr : c.promiseEn,
    alternates: { fr: "/audit/cible", en: "/audit/targeted" },
  });
}

export default async function AuditCiblePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // ImageObject @graph — Sprint AEO Phase 5 2026-05-28 (Will). Photo équipe
  // + portrait fondateur pour exposition Google Images + AI Overviews sur
  // requêtes « audit IA ciblé département », « audit IA PME 1 service ».
  const imagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — audit IA ciblé sur 1 département PME"
          : "Axion-IA team — Targeted AI audit on 1 SME department",
        alt: isFr
          ? "Équipe Axion-IA en mission d'audit IA ciblé — cabinet IA opérationnel français spécialisé dans le diagnostic IA d'un département précis (ventes, RH, finance, opérations) pour TPE et PME."
          : "Axion-IA team in Targeted AI audit assignment — French operational AI consultancy specialized in AI diagnosis of a specific department (sales, HR, finance, operations) for small businesses and SMEs.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "William — Fondateur Axion-IA, auditeur IA ciblé"
          : "William — Axion-IA founder, Targeted AI auditor",
        alt: isFr
          ? "Portrait de William, fondateur d'Axion-IA. Conduit personnellement les audits IA ciblés pour dirigeants TPE et PME — diagnostic département par département, cas d'usage chiffrés, plan d'action 90 jours."
          : "Portrait of William, Axion-IA founder. Personally conducts Targeted AI audits for small business and SME executives — department-by-department diagnosis, quantified use cases, 90-day action plan.",
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
