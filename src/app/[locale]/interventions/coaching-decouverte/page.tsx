import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { IndividualCoachingPage } from "@/components/sections/IndividualCoachingPage";
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
    path: "/interventions/coaching-decouverte",
    title:
      loc === "fr"
        ? "Coaching IA · Découverte personnelle · 1 jour · Axion-IA"
        : "AI Coaching · Personal discovery · 1 day · Axion-IA",
    description:
      loc === "fr"
        ? "Coaching IA individuel 1-to-1 sur votre poste de travail (1 jour). Audit chronophages, installation des outils essentiels, 3 à 5 automatismes opérationnels, plan d'implémentation chiffré. Pour managers, indépendants, dirigeants solo."
        : "1-on-1 individual AI coaching on your workstation (1 day). Time-sinks audit, essential tools installation, 3-5 working automations, quantified implementation plan. For managers, independents, solo executives.",
  });
}

export default async function CoachingDecouvertePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <IndividualCoachingPage slug="coaching-decouverte" locale={locale as Locale} />;
}
