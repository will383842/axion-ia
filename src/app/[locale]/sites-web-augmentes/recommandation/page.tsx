import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { SitesWebLandingPage } from "@/components/services/sites-web/SitesWebLandingPage";
import { getSitesWeb } from "@/content/sites-web";
import { buildProductMetadata } from "@/lib/seo";

const SLUG = "recommandation" as const;

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
      ? "Recommandation produit IA pour votre site · Axion-IA"
      : "AI product recommendation for your site · Axion-IA",
    description: isFr
      ? "Un moteur de recommandation IA qui comprend l'intention du visiteur et suggère les bons produits — cross-sell automatique, panier moyen en hausse, sans cookie tiers."
      : "An AI recommendation engine that understands visitor intent and suggests the right products — automatic cross-sell, higher cart, no third-party cookie.",
    alternates: { fr: c.pathFr, en: c.pathEn },
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <SitesWebLandingPage slug={SLUG} locale={locale as Locale} />;
}
