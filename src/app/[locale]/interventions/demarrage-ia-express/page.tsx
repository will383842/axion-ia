import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { CollectiveTrainingPage } from "@/components/sections/CollectiveTrainingPage";
import { buildProductMetadata } from "@/lib/seo";
import { INTERVENTION_TIERS, getTierById, formatAmount } from "@/content/pricing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const tier = getTierById(INTERVENTION_TIERS, "intervention-4h");
  const price = tier.priceFlat!;
  return buildProductMetadata({
    locale,
    path: "/interventions/demarrage-ia-express",
    title:
      loc === "fr"
        ? `Démarrage IA Express · formation 4 h · ${formatAmount(price, "fr")} · Axion-IA`
        : `AI Express Kickoff · 4-h training · ${formatAmount(price, "en", { compact: true })} · Axion-IA`,
    description:
      loc === "fr"
        ? `Demi-journée (4 h) pour démystifier l'IA dans votre équipe : panorama outils 2026, démos live sur cas réels de votre secteur, 2-3 prompts opérationnels testés. ${formatAmount(price, "fr")}, 2 à 12 personnes, sur site.`
        : `Half-day (4 h) to demystify AI for your team: 2026 tools panorama, live demos on real cases from your sector, 2-3 operational prompts tested. ${formatAmount(price, "en")}, 2 to 12 people, on site.`,
  });
}

export default async function DemarrageIaExpressPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <CollectiveTrainingPage slug="demarrage-ia-express" locale={locale as Locale} />;
}
