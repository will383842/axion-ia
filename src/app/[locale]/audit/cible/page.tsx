import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { AuditDetailPage } from "@/components/sections/AuditDetailPage";
import { AUDIT_DETAIL_CONFIGS } from "@/content/audit-detail-configs";
import { buildProductMetadata } from "@/lib/seo";

// Sprint 14.10.8 (Will 2026-05-12) — wrapper Audit Ciblé via template SSOT.
// Remplace /audit/process (renommé selon doctrine pricing.ts AUDIT_TIERS).

const TIER = "audit-cible" as const;

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
      ? "Audit IA Ciblé · 1 département · 1 900 → 3 900 € · Axion-IA"
      : "Targeted AI audit · 1 department · €1,900 → €3,900 · Axion-IA",
    description: isFr ? c.promiseFr : c.promiseEn,
    alternates: { fr: "/audit/cible", en: "/audit/targeted" },
  });
}

export default async function AuditCiblePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <AuditDetailPage tier={TIER} locale={locale as Locale} />;
}
