import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { InterventionDetailPage } from "@/components/sections/InterventionDetailPage";
import { INTERVENTION_DETAIL_CONFIGS } from "@/content/intervention-detail-configs";
import { buildProductMetadata } from "@/lib/seo";

// Sprint 14.10.7 (Will 2026-05-12) — wrapper page détail Conférence plénière.

const SLUG = "conference-pleniere" as const;

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
    path: isFr ? "/interventions/conference-pleniere" : "/interventions/conference-plenary",
    title: isFr
      ? "Conférence plénière IA · 1 journée · 30-500+ personnes · Axion-IA"
      : "AI Plenary Talk · 1 day · 30-500+ people · Axion-IA",
    description: isFr ? c.promiseFr : c.promiseEn,
    alternates: {
      fr: "/interventions/conference-pleniere",
      en: "/interventions/conference-plenary",
    },
  });
}

export default async function ConferencePleniere({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <InterventionDetailPage slug={SLUG} locale={locale as Locale} />;
}
