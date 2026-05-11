import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { CollectiveDurationListing } from "@/components/sections/CollectiveDurationListing";
import { countFormatsByCell } from "@/content/interventions-taxonomy";
import { buildProductMetadata } from "@/lib/seo";

const DURATION_ID = "1-jour" as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const count = countFormatsByCell("collectives", DURATION_ID);
  return buildProductMetadata({
    locale,
    path: "/interventions/collectives/1-jour",
    title:
      loc === "fr"
        ? `Formation IA 1 jour · ${count} formats équipe · Axion-IA`
        : `1-day AI training · ${count} team formats · Axion-IA`,
    description:
      loc === "fr"
        ? `Formations IA opérationnelles sur 1 journée (≈ 7 h sur site) pour vos équipes. ${count} format${count > 1 ? "s" : ""} : Essentielle, Gagner du temps, Intervention Claude. De 2 à 30+ personnes.`
        : `Operational AI trainings over 1 day (≈ 7 h on site) for your teams. ${count} format${count > 1 ? "s" : ""}: Essential, Save Time, Claude intervention. From 2 to 30+ people.`,
  });
}

export default async function CollectiveDuration1JourPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <CollectiveDurationListing durationId={DURATION_ID} locale={locale as Locale} />;
}
