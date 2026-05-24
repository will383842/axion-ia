import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { CollectiveTrainingPage } from "@/components/sections/CollectiveTrainingPage";
import { buildProductMetadata } from "@/lib/seo";

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
    path: "/interventions/atelier-ia-cible",
    title:
      loc === "fr"
        ? "Atelier IA ciblé · formation 4 h · 590 € HT · Axion-IA"
        : "Targeted AI Workshop · 4-h training · €590 · Axion-IA",
    description:
      loc === "fr"
        ? "Demi-journée (4 h) focalisée sur UN cas d'usage métier précis (rédaction commerciale, analyse de documents, automatisation reporting, traduction…). Chaque participant repart avec le cas implémenté sur son poste. 590 € HT, 2 à 15 personnes."
        : "Half-day (4 h) focused on ONE specific business case (sales writing, document analysis, reporting automation, translation…). Each participant leaves with the case implemented on their workstation. €590 (excl. VAT), 2 to 15 people.",
  });
}

export default async function AtelierIaCiblePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <CollectiveTrainingPage slug="atelier-ia-cible" locale={locale as Locale} />;
}
