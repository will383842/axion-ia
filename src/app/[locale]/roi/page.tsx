import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { RoiSimulator } from "@/components/roi/RoiSimulator";
import { Illustration } from "@/components/visual/Illustration";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";

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
        ? "Simulateur gains IA · combien d'heures vous gagnerez · AxionIA"
        : "AI gains simulator · hours you'll save · AxionIA",
    description:
      locale === "fr"
        ? "Combien d'heures par jour, par personne, votre équipe gagnera après une formation IA ? 2 curseurs simples, gains concrets : heures rendues, jours libérés, emails écrits sans effort."
        : "How many hours per day, per person, will your team save after an AI training? 2 simple sliders, concrete gains: hours freed, days back, effortless emails.",
  });
}

export default async function RoiPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/roi", label: isFr ? "Simulateur ROI" : "ROI simulator" }];

  const labels = isFr
    ? {
        intro:
          "2 curseurs simples. Voyez en direct combien d'heures votre équipe gagnera par jour, combien de jours seront libérés par mois, combien d'emails seront écrits sans effort. Pas de jargon, des chiffres concrets.",
        teamSize: "Combien de collaborateurs concernés ?",
        hoursDailyOnRepetitive: "Heures par jour sur tâches répétitives ?",
        hoursDailyHint:
          "Rédaction d'emails, comptes-rendus, recherche d'infos, classement, synthèses. Estimez à la louche, par personne et par jour.",
        resultIntro: "Voici à quoi ressemblera votre semaine",
        hoursSavedPerDay: "Gagnées par jour, par personne",
        daysLiberatedPerMonth: "Jours libérés par mois sur l'équipe",
        emailsAutoPerMonth: "Emails rédigés sans effort par mois",
        reportsAutoPerMonth: "Comptes-rendus / synthèses générés par mois",
        pctTimeFreed: "Du temps quotidien rendu à la valeur ajoutée",
        estimateNote:
          "Chiffres observés chez les 38 entreprises sortant d'une formation Essentielle. Vos résultats dépendent de l'adoption interne et des outils retenus.",
      }
    : {
        intro:
          "2 simple sliders. See live how many hours per day your team will save, how many days are freed up per month, how many emails are written effortlessly. No jargon, just concrete figures.",
        teamSize: "How many employees involved?",
        hoursDailyOnRepetitive: "Hours per day on repetitive tasks?",
        hoursDailyHint:
          "Email writing, minutes, info research, filing, summaries. Estimate roughly, per person, per day.",
        resultIntro: "Here's what your week will look like",
        hoursSavedPerDay: "Saved per day, per person",
        daysLiberatedPerMonth: "Days freed per month across the team",
        emailsAutoPerMonth: "Effortless emails written per month",
        reportsAutoPerMonth: "Minutes / summaries generated per month",
        pctTimeFreed: "Of daily time returned to value-add work",
        estimateNote:
          "Figures observed across the 38 companies completing an Essential session. Your results depend on internal adoption and tools chosen.",
      };

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Gains concrets quotidiens" : "Concrete daily gains"}
        title={isFr ? "Combien d'heures votre équipe" : "How many hours will your team"}
        titleEm={isFr ? "gagnera" : "save"}
        titleTail={isFr ? " après la formation ?" : " after training?"}
        description={
          isFr
            ? "Pas de % ROI, pas de payback en mois. Juste les heures rendues à votre équipe — chiffres observés chez les entreprises ayant suivi l'Essentielle."
            : "No ROI %, no payback months. Just the hours returned to your team — figures observed across companies completing the Essential session."
        }
      />

      <Section tone="halo-warm">
        <Container className="max-w-4xl">
          <Illustration
            slot="ROI-01-sankey"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/roi-hero.avif"
            caption={
              isFr
                ? "Sankey opérationnel — flux d'heures canalisé vers la valeur ajoutée"
                : "Operational sankey — hours channelled toward value-add work"
            }
            alt={
              isFr
                ? "Illustration éditoriale d'un diagramme Sankey représentant le flux d'heures économisées par l'IA chez AxionIA."
                : "Editorial illustration of a Sankey diagram representing the flow of hours saved by AI at AxionIA."
            }
            priority
          />
        </Container>
      </Section>

      <Section>
        <Container className="max-w-5xl">
          <RoiSimulator labels={labels} />
        </Container>
      </Section>

      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Illustration
            slot="ROI-02-closing"
            aspectRatio="1:1"
            filenameTarget="public/illustrations/roi-closing.avif"
            caption={
              isFr
                ? "Cadran horaire éditorial — temps rendu à l'équipe"
                : "Editorial hour dial — time returned to the team"
            }
            alt={
              isFr
                ? "Illustration éditoriale d'un cadran horaire représentant les heures rendues à l'équipe grâce à l'IA."
                : "Editorial illustration of an hour dial representing hours returned to the team thanks to AI."
            }
          />
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
    </>
  );
}
