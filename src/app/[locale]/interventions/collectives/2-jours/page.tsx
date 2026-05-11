import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { CollectiveDurationListing } from "@/components/sections/CollectiveDurationListing";
import { countFormatsByCell } from "@/content/interventions-taxonomy";
import { buildProductMetadata } from "@/lib/seo";

const DURATION_ID = "2-jours" as const;

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
    path: "/interventions/collectives/2-jours",
    title:
      loc === "fr"
        ? `Formation IA 2 jours · approfondie équipe · Axion-IA`
        : `2-day AI training · deep dive for teams · Axion-IA`,
    description:
      loc === "fr"
        ? `Formations IA opérationnelles sur 2 journées consécutives pour vos équipes. ${count > 0 ? `${count} format${count > 1 ? "s" : ""} — équipes IA-fluentes à la sortie.` : "Formats en préparation."}`
        : `Operational AI trainings over 2 consecutive days for your teams. ${count > 0 ? `${count} format${count > 1 ? "s" : ""} — your teams leave AI-fluent.` : "Formats coming soon."}`,
  });
}

export default async function CollectiveDuration2JoursPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <CollectiveDurationListing durationId={DURATION_ID} locale={locale as Locale} />;
}
