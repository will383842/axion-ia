import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { InterventionDetailPage } from "@/components/sections/InterventionDetailPage";
import { INTERVENTION_DETAIL_CONFIGS } from "@/content/intervention-detail-configs";
import { buildProductMetadata } from "@/lib/seo";
import { INTERVENTION_TIERS, getTierById, formatAmount } from "@/content/pricing";

// Sprint 14.10.7 (Will 2026-05-12) — wrapper page détail Productivité dirigeant.
// Contenu centralisé dans `INTERVENTION_DETAIL_CONFIGS["dirigeant-productivite"]`.

const SLUG = "dirigeant-productivite" as const;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const c = INTERVENTION_DETAIL_CONFIGS[SLUG];
  const isFr = locale === "fr";
  const tier = getTierById(INTERVENTION_TIERS, "intervention-dirigeants");
  const price = tier.priceFlat!;
  return buildProductMetadata({
    locale,
    path: isFr ? "/interventions/dirigeant-productivite" : "/interventions/executive-productivity",
    title: isFr
      ? `Productivité dirigeant · 1 jour 1-to-1 · ${formatAmount(price, "fr")} · Axion-IA`
      : `Executive productivity · 1 day 1-on-1 · ${formatAmount(price, "fr", { compact: true })} · Axion-IA`,
    description: isFr ? c.promiseFr : c.promiseEn,
    alternates: {
      fr: "/interventions/dirigeant-productivite",
      en: "/interventions/executive-productivity",
    },
  });
}

export default async function DirigeantProductivitePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <InterventionDetailPage slug={SLUG} locale={locale as Locale} />;
}
