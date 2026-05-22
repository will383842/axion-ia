import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { AuditDetailPage } from "@/components/sections/AuditDetailPage";
import { AUDIT_DETAIL_CONFIGS } from "@/content/audit-detail-configs";
import { buildProductMetadata } from "@/lib/seo";

// Sprint 14.10.8 (Will 2026-05-12) — wrapper Audit Stratégique PME via template.

const TIER = "audit-strategique-pme" as const;

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
      ? "Audit Stratégique PME · 4 900 → 9 900 € · Axion-IA"
      : "SME Strategic AI audit · €4,900 → €9,900 · Axion-IA",
    description: isFr ? c.promiseFr : c.promiseEn,
    alternates: { fr: "/audit/strategique-pme", en: "/audit/strategic-pme" },
  });
}

export default async function AuditStrategiquePmePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <AuditDetailPage tier={TIER} locale={locale as Locale} />;
}
