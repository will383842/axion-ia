import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Clock, Calendar, Users, BarChart3 } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { RoiSimulator } from "@/components/roi/RoiSimulator";
import { Illustration } from "@/components/visual/Illustration";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildFaqJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";

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
        ? "Simulateur gains IA · combien d'heures vous gagnerez · Axion-IA"
        : "AI gains simulator · hours you'll save · Axion-IA",
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
      >
        <Container className="mt-8 max-w-2xl">
          <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
            {[
              { icon: Clock, label: isFr ? "Heures rendues / jour" : "Hours saved / day" },
              { icon: Calendar, label: isFr ? "Jours libérés / mois" : "Days freed / month" },
              { icon: Users, label: isFr ? "38 entreprises observées" : "38 companies tracked" },
              { icon: BarChart3, label: isFr ? "Chiffres terrain" : "Field figures" },
            ].map((pill) => {
              const Icon = pill.icon;
              return (
                <li
                  key={pill.label}
                  className="text-fg-soft inline-flex items-center gap-2 text-sm"
                >
                  <Icon aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
                  <span>{pill.label}</span>
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>

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
                ? "Illustration éditoriale d'un diagramme Sankey représentant le flux d'heures économisées par l'IA chez Axion-IA."
                : "Editorial illustration of a Sankey diagram representing the flow of hours saved by AI at Axion-IA."
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
            ? "L'audit Axion-IA livre un plan d'implémentation chiffré avec ROI mesuré sur vos process réels."
            : "The Axion-IA audit delivers a costed implementation plan with ROI measured on your actual processes."
        }
        cta={
          <Cta href="/audit" size="lg">
            {isFr ? "Demander un audit" : "Request an audit"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd
        data={buildFaqJsonLd({
          items: isFr
            ? [
                {
                  question: "Combien d'heures par jour l'IA peut-elle libérer dans mon équipe ?",
                  answer:
                    "Axion-IA observe en moyenne 1 à 3 heures libérées par personne et par jour suite à une formation IA, selon les profils et les tâches automatisées. Chiffres issus du suivi de 38 entreprises après une session Essentielle.",
                },
                {
                  question: "Comment calculer le ROI d'une formation IA pour une PME ?",
                  answer:
                    "Le simulateur Axion-IA utilise 2 paramètres : taille de l'équipe et heures quotidiennes sur tâches répétitives. Il calcule les heures gagnées par jour, les jours libérés par mois et le nombre d'emails rédigés sans effort — gains directement convertibles en équivalent-temps-plein récupéré.",
                },
                {
                  question:
                    "En combien de temps les résultats sont-ils visibles après une formation IA ?",
                  answer:
                    "Les résultats opérationnels sont visibles dès les premières 72 heures : les participants appliquent immédiatement les workflows appris sur leurs cas réels. L'impact mesurable sur la productivité se confirme sur 4 à 8 semaines de pratique régulière.",
                },
                {
                  question: "Le simulateur ROI Axion-IA donne-t-il des chiffres exacts ?",
                  answer:
                    "Le simulateur fournit des estimations basées sur des observations terrain (38 entreprises suivies). Les résultats réels dépendent du niveau d'adoption interne, des outils retenus et du profil des équipes. Pour un chiffrage personnalisé, l'audit Axion-IA mesure le ROI sur vos process réels.",
                },
              ]
            : [
                {
                  question: "How many hours per day can AI free up in my team?",
                  answer:
                    "Axion-IA observes an average of 1 to 3 hours freed per person per day after AI training, depending on profiles and automated tasks. Figures from tracking 38 companies after an Essential session.",
                },
                {
                  question: "How do you calculate the ROI of AI training for an SME?",
                  answer:
                    "The Axion-IA simulator takes 2 parameters: team size and daily hours on repetitive tasks. It calculates hours saved per day, days freed per month and emails written effortlessly — gains directly convertible into recovered full-time equivalent.",
                },
                {
                  question: "How quickly are results visible after AI training?",
                  answer:
                    "Operational results are visible within the first 72 hours: participants immediately apply learned workflows to their real cases. The measurable impact on productivity is confirmed over 4 to 8 weeks of regular practice.",
                },
                {
                  question: "Does the Axion-IA ROI simulator give exact figures?",
                  answer:
                    "The simulator provides estimates based on field observations (38 companies tracked). Actual results depend on internal adoption levels, tools chosen and team profiles. For personalised figures, the Axion-IA audit measures ROI on your actual processes.",
                },
              ],
        })}
      />
    </>
  );
}
