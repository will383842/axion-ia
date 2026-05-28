import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { AuditDetailPage } from "@/components/sections/AuditDetailPage";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AUDIT_DETAIL_CONFIGS } from "@/content/audit-detail-configs";
import { buildProductMetadata, buildImageGraphJsonLd } from "@/lib/seo";

// Sprint 14.10.8 (Will 2026-05-12) — wrapper Audit Flash via template SSOT.

const TIER = "audit-flash" as const;

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
    path: "/audit/flash",
    title: isFr
      ? "Audit Flash IA · 490 € distance / 890 € sur site · Axion-IA"
      : "Flash AI audit · €490 remote / €890 on site · Axion-IA",
    description: isFr ? c.promiseFr : c.promiseEn,
    alternates: { fr: "/audit/flash", en: "/audit/flash" },
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
  const imagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — audit Flash IA TPE et PME"
          : "Axion-IA team — Flash AI audit for small businesses and SMEs",
        alt: isFr
          ? "Équipe Axion-IA en session d'audit Flash IA — cabinet IA opérationnel français accompagnant TPE et PME en 1 demi-journée, à distance 490 € ou sur site 890 €, cartographie IA, ROI rapide."
          : "Axion-IA team in Flash AI audit session — French operational AI consultancy supporting small businesses and SMEs in half a day, remote €490 or on site €890, AI mapping, quick ROI.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "William — Fondateur Axion-IA, auditeur Flash IA"
          : "William — Axion-IA founder, Flash AI auditor",
        alt: isFr
          ? "Portrait de William, fondateur d'Axion-IA. Conduit personnellement les audits Flash IA pour dirigeants TPE et PME — diagnostic accéléré, priorisation des cas d'usage IA, recommandations actionnables."
          : "Portrait of William, Axion-IA founder. Personally conducts Flash AI audits for small business and SME executives — accelerated diagnosis, AI use case prioritization, actionable recommendations.",
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
