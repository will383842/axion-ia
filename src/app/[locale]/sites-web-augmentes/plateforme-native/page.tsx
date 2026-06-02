import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { SitesWebLandingPage } from "@/components/services/sites-web/SitesWebLandingPage";
import { getSitesWeb } from "@/content/sites-web";
import { buildProductMetadata } from "@/lib/seo";

const SLUG = "plateforme-native" as const;

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
      ? "Créer une plateforme SaaS IA-native · Axion-IA"
      : "Build an AI-native SaaS platform · Axion-IA",
    description: isFr
      ? "Une plateforme SaaS sur mesure pensée autour de l'IA dès la conception, sur vos données métier, hébergée en UE. Code et propriété à vous. Forfait fixe."
      : "A bespoke SaaS platform designed around AI from day one, on your business data, EU-hosted. Code and ownership yours. Fixed fee.",
    alternates: { fr: c.pathFr, en: c.pathEn },
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <SitesWebLandingPage slug={SLUG} locale={locale as Locale} />;
}
