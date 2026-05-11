import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { CollectiveDurationListing } from "@/components/sections/CollectiveDurationListing";
import { buildProductMetadata } from "@/lib/seo";

const DURATION_ID = "3-jours-plus" as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  return buildProductMetadata({
    locale,
    path: "/interventions/collectives/3-jours-plus",
    title:
      loc === "fr"
        ? `Formation IA 3 jours et + · sur devis · Axion-IA`
        : `3-day+ AI training · on request · Axion-IA`,
    description:
      loc === "fr"
        ? `Formation IA sur mesure de 3 jours ou plus pour vos équipes — cadrage personnalisé par appel, devis détaillé sous 48 h ouvrées, facturation après l'intervention.`
        : `Bespoke AI training of 3 days or more for your teams — personalised framing by call, detailed quote within 48 business hours, invoicing after the session.`,
  });
}

export default async function CollectiveDuration3JoursPlusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <CollectiveDurationListing durationId={DURATION_ID} locale={locale as Locale} />;
}
