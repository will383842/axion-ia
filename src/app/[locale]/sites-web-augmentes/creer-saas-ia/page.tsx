import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { SitesWebLandingPage } from "@/components/services/sites-web/SitesWebLandingPage";
import { getSitesWeb } from "@/content/sites-web";
import { buildProductMetadata } from "@/lib/seo";

const SLUG = "creer-saas-ia" as const;

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
    title: isFr ? "Créer un SaaS IA sur mesure · Axion-IA" : "Build a bespoke AI SaaS · Axion-IA",
    description: isFr
      ? "On conçoit et développe votre SaaS IA sur mesure, pensé autour de l'IA dès le départ, livré par jalons testables. Code et propriété à vous, hébergé en UE."
      : "We design and build your bespoke AI SaaS, built around AI from day one, delivered by testable milestones. Code and ownership yours, EU-hosted.",
    alternates: { fr: c.pathFr, en: c.pathEn },
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <SitesWebLandingPage slug={SLUG} locale={locale as Locale} />;
}
