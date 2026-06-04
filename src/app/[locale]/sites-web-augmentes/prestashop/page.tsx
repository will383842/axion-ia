import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { SitesWebLandingPage } from "@/components/services/sites-web/SitesWebLandingPage";
import { getSitesWeb } from "@/content/sites-web";
import { buildProductMetadata } from "@/lib/seo";

const SLUG = "prestashop" as const;

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const c = getSitesWeb(SLUG);
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: isFr ? c.pathFr : c.pathEn,
    title: isFr
      ? "IA pour PrestaShop : module sur mesure, search, reco · Axion-IA"
      : "AI for PrestaShop: bespoke module, search, reco · Axion-IA",
    description: isFr
      ? "Module PrestaShop sur mesure : recherche sémantique, recommandations, génération et traduction de fiches. Idéal boutiques multilingues. Open-source, hébergement UE."
      : "Bespoke PrestaShop module: semantic search, recommendations, sheet generation and translation. Ideal for multilingual stores. Open-source, EU hosting.",
    alternates: { fr: c.pathFr, en: c.pathEn },
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <SitesWebLandingPage slug={SLUG} locale={locale as Locale} />;
}
