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
    path: "/interventions/coaching-avance",
    title:
      loc === "fr"
        ? "Coaching IA · Productivité avancée · 1 jour · Axion-IA"
        : "AI Coaching · Advanced productivity · 1 day · Axion-IA",
    description:
      loc === "fr"
        ? "Coaching IA individuel 1-to-1 avancé (1 jour) : workflows multi-outils, agents personnels, Claude CLI / API, automatisations sophistiquées. Pour pros déjà à l'aise avec ChatGPT ou Claude qui veulent industrialiser."
        : "Advanced 1-on-1 individual AI coaching (1 day): multi-tool workflows, personal agents, Claude CLI / API, sophisticated automations. For pros already comfortable with ChatGPT or Claude who want to industrialise.",
  });
}

export default async function CoachingAvancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <IndividualCoachingPage slug="coaching-avance" locale={locale as Locale} />;
}
