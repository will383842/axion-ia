import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { InterventionDetailPage } from "@/components/sections/InterventionDetailPage";
import { INTERVENTION_DETAIL_CONFIGS } from "@/content/intervention-detail-configs";
import { buildProductMetadata } from "@/lib/seo";

// Sprint 14.10.7 (Will 2026-05-12) — wrapper page détail Vision IA stratégique.

const SLUG = "dirigeant-vision-strategique" as const;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const c = INTERVENTION_DETAIL_CONFIGS[SLUG];
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: isFr
      ? "/interventions/dirigeant-vision-strategique"
      : "/interventions/executive-strategic-vision",
    title: isFr
      ? "Vision IA stratégique · 1 jour 1-to-1 · sur devis · Axion-IA"
      : "Strategic AI vision · 1 day 1-on-1 · on request · Axion-IA",
    description: isFr ? c.promiseFr : c.promiseEn,
    alternates: {
      fr: "/interventions/dirigeant-vision-strategique",
      en: "/interventions/executive-strategic-vision",
    },
  });
}

export default async function DirigeantVisionStrategiquePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <InterventionDetailPage slug={SLUG} locale={locale as Locale} />;
}
