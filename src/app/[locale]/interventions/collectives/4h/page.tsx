import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { CollectiveDurationListing } from "@/components/sections/CollectiveDurationListing";
import { getDuration, countFormatsByCell } from "@/content/interventions-taxonomy";
import { buildProductMetadata } from "@/lib/seo";

const DURATION_ID = "4h" as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const d = getDuration(DURATION_ID);
  const count = countFormatsByCell("collectives", DURATION_ID);
  return buildProductMetadata({
    locale,
    path: "/interventions/collectives/4h",
    title:
      loc === "fr"
        ? `Formation IA 4 heures · demi-journée équipe · Axion-IA`
        : `4-hour AI training · half-day for teams · Axion-IA`,
    description:
      loc === "fr"
        ? `Formations IA opérationnelles ${d.durationDetailFr.toLowerCase()} pour vos équipes sur site. ${count > 0 ? `${count} format${count > 1 ? "s" : ""} disponible${count > 1 ? "s" : ""}.` : "Formats en préparation — sur devis possible dès aujourd'hui."}`
        : `Operational AI trainings ${d.durationDetailEn.toLowerCase()} for your teams on site. ${count > 0 ? `${count} format${count > 1 ? "s" : ""} available.` : "Formats coming soon — bespoke available now."}`,
  });
}

export default async function CollectiveDuration4hPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <CollectiveDurationListing durationId={DURATION_ID} locale={locale as Locale} />;
}
