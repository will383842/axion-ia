import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { RoiSimulator } from "@/components/roi/RoiSimulator";
import { buildProductMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/roi",
    title:
      locale === "fr"
        ? "Simulateur ROI IA · estimer vos économies · AxionIA"
        : "AI ROI simulator · estimate your savings · AxionIA",
    description:
      locale === "fr"
        ? "Estimez en 30 secondes les économies annuelles d'une implémentation IA dans votre entreprise. 4 paramètres, calcul instantané."
        : "Estimate annual savings of an AI implementation for your company in 30 seconds. 4 inputs, instant computation.",
  });
}

export default async function RoiPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Simulateur ROI" : "ROI simulator", href: "/roi" },
    ],
  });

  const labels = isFr
    ? {
        teamSize: "Taille équipe",
        averageSalaryK: "Salaire annuel moyen brut",
        repetitiveTaskPct: "% tâches répétitives automatisables",
        aiCoverage: "Couverture IA réaliste",
        annualSavings: "Économies annuelles estimées",
        hoursSavedPerWeek: "Heures gagnées par semaine",
        paybackWeeks: "Délai retour sur investissement",
        intro:
          "Estimation basée sur un coût employeur chargé +40 %, 46 semaines travaillées, déploiement IA initial 5 000 €. Ajustez les paramètres pour calibrer.",
        estimateNote:
          "Estimation indicative · ROI réel mesuré après audit IA AxionIA. Aucune garantie de résultat.",
      }
    : {
        teamSize: "Team size",
        averageSalaryK: "Average annual gross salary",
        repetitiveTaskPct: "% repetitive tasks (automatable)",
        aiCoverage: "Realistic AI coverage",
        annualSavings: "Estimated annual savings",
        hoursSavedPerWeek: "Hours saved per week",
        paybackWeeks: "Payback period",
        intro:
          "Estimate based on employer-loaded cost +40 %, 46 working weeks, initial AI deployment €5,000. Adjust the inputs to calibrate.",
        estimateNote:
          "Indicative estimate · actual ROI measured after AxionIA AI audit. No outcome guarantee.",
      };

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Simulateur · accent green" : "Simulator · green accent"}
        title={isFr ? "Estimez votre ROI IA en 30 secondes" : "Estimate your AI ROI in 30 seconds"}
        description={
          isFr
            ? "4 paramètres, calcul instantané, basé sur les modèles utilisés en audit AxionIA."
            : "4 parameters, instant calculation, based on the models used in AxionIA audits."
        }
      />

      <Section>
        <Container className="max-w-5xl">
          <RoiSimulator labels={labels} />
        </Container>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Aller plus loin" : "Go further"}
        title={
          isFr ? "Validez votre estimation par un audit" : "Validate the estimate with an audit"
        }
        description={
          isFr
            ? "L'audit AxionIA livre un plan d'implémentation chiffré avec ROI mesuré sur vos process réels."
            : "The AxionIA audit delivers a costed implementation plan with ROI measured on your actual processes."
        }
        cta={
          <Cta href="/audit" size="lg">
            {isFr ? "Demander un audit" : "Request an audit"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={breadcrumb} />
    </>
  );
}
