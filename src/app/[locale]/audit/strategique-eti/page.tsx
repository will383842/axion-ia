import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { AuditDetailPage } from "@/components/sections/AuditDetailPage";
import { AUDIT_DETAIL_CONFIGS } from "@/content/audit-detail-configs";
import { buildProductMetadata } from "@/lib/seo";

// Sprint 14.10.8 (Will 2026-05-12) — wrapper Audit Stratégique ETI via template.

const TIER = "audit-strategique-eti" as const;

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
      ? "Audit Stratégique ETI · à partir de 12 000 € · Axion-IA"
      : "Mid-cap Strategic AI audit · from €12,000 · Axion-IA",
    description: isFr ? c.promiseFr : c.promiseEn,
    alternates: { fr: "/audit/strategique-eti", en: "/audit/strategic-eti" },
  });
}

export default async function AuditStrategiqueEtiPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <AuditDetailPage tier={TIER} locale={locale as Locale} />;
}
