import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { SitesWebLandingPage } from "@/components/services/sites-web/SitesWebLandingPage";
import { getSitesWeb } from "@/content/sites-web";
import { buildProductMetadata } from "@/lib/seo";

const SLUG = "woocommerce" as const;

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
      ? "IA pour WooCommerce : assistant, reco, fiches produit · Axion-IA"
      : "AI for WooCommerce: assistant, reco, product sheets · Axion-IA",
    description: isFr
      ? "Greffez l'IA sur votre boutique WooCommerce sans migrer : assistant d'achat, recommandations, génération de fiches, recherche sémantique. Auto-hébergé, hébergement UE."
      : "Graft AI onto your WooCommerce store without migrating: buying assistant, recommendations, sheet generation, semantic search. Self-hosted, EU hosting.",
    alternates: { fr: c.pathFr, en: c.pathEn },
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <SitesWebLandingPage slug={SLUG} locale={locale as Locale} />;
}
