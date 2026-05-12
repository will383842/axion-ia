import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { InterventionDetailPage } from "@/components/sections/InterventionDetailPage";
import { INTERVENTION_DETAIL_CONFIGS } from "@/content/intervention-detail-configs";
import { buildProductMetadata } from "@/lib/seo";

// Sprint 14.10.7 (Will 2026-05-12) — wrapper page détail Keynote IA événementielle.

const SLUG = "conference-keynote" as const;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const c = INTERVENTION_DETAIL_CONFIGS[SLUG];
  const isFr = locale === "fr";
  // Path locale-aware (cohérence avec les autres wrappers — slug identique
  // FR/EN ici, mais le pattern reste générique pour un futur split.)
  const PATH_FR = "/interventions/conference-keynote";
  const PATH_EN = "/interventions/conference-keynote";
  return buildProductMetadata({
    locale,
    path: isFr ? PATH_FR : PATH_EN,
    title: isFr
      ? "Keynote IA · événementielle · 1-2 h · soirée OK · Axion-IA"
      : "AI Keynote · event format · 1-2 h · evening OK · Axion-IA",
    description: isFr ? c.promiseFr : c.promiseEn,
    alternates: { fr: PATH_FR, en: PATH_EN },
  });
}

export default async function ConferenceKeynotePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <InterventionDetailPage slug={SLUG} locale={locale as Locale} />;
}
