// Hub canonique 4e verticale `un-a-un`.
// 1 personne ↔ 1 expert IA Axion-IA — coaching individuel, format flexible.
// Cible : tout collaborateur (manager, RH, commercial, opérateur, dirigeant).

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildServiceJsonLd } from "@/lib/seo";
import { Illustration } from "@/components/visual/Illustration";
import { UN_A_UN_TIERS, formatPrice, getEntryTier } from "@/content/pricing";
// Sprint uniformisation 2026-05-24 (Will) — alignement template /implementation.
// Ajout ProcessSteps + FaqAccordion + LocalCoverageSection + LocalGeoFaqSection
// + StickyMobileCta. Contenu MINIMAL (réutilisation existant + Q/R triviales).
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: isFr ? "/un-a-un" : "/one-to-one",
    title: isFr
      ? "Coaching IA individuel 1-to-1 · Axion-IA"
      : "1-to-1 individual AI coaching · Axion-IA",
    description: isFr
      ? "Un expert IA Axion-IA dédié à une personne. Coaching individuel calibré sur le poste, les outils et les objectifs réels du collaborateur — manager, RH, commercial, opérateur, dirigeant."
      : "One Axion-IA AI expert dedicated to one person. Individual coaching calibrated to the role, tools and real objectives of the employee — manager, HR, sales, operator, executive.",
    alternates: { fr: "/un-a-un", en: "/one-to-one" },
  });
}

export default async function UnAUnHubPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";
  const entryTier = getEntryTier(UN_A_UN_TIERS);
  const formattedPrice = formatPrice(entryTier, isFr ? "fr" : "en");
  const path = isFr ? "/un-a-un" : "/one-to-one";

  const serviceJsonLd = buildServiceJsonLd({
    locale,
    path,
    name: isFr ? "Coaching IA individuel 1-to-1" : "1-to-1 individual AI coaching",
    description: isFr
      ? "Accompagnement individuel IA : 1 collaborateur accompagné par 1 expert Axion-IA. Sessions calibrées sur le poste, les outils et les objectifs de la personne. Partout en France métropolitaine."
      : "Individual AI coaching: 1 employee coached by 1 Axion-IA expert. Sessions calibrated to the role, tools and objectives of the person. Anywhere in metropolitan France.",
    serviceType: isFr ? "Coaching IA individuel" : "Individual AI coaching",
    priceEur: entryTier.priceFlat ?? 990,
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs
          items={[{ href: path, label: isFr ? "Accompagnement 1-to-1" : "1-to-1 coaching" }]}
        />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={isFr ? "Accompagnement IA individuel" : "Individual AI coaching"}
        title={isFr ? "Un expert IA" : "One AI expert"}
        titleEm={isFr ? "pour une personne" : "for one person"}
        description={
          isFr
            ? "Un collaborateur, un expert IA Axion-IA. Pas une formation groupe, pas un audit d'entreprise — un accompagnement individuel calibré sur le poste réel, les outils du quotidien et les objectifs concrets de la personne."
            : "One employee, one Axion-IA AI expert. Not a group training, not a company audit — individual coaching calibrated to the real role, daily tools and concrete objectives of the person."
        }
      >
        <Container className="text-fg max-w-3xl">
          <p data-aeo="tldr" className="tldr-answer mb-6 text-lg leading-relaxed">
            {isFr
              ? `L'accompagnement 1-to-1 d'Axion-IA met en relation un collaborateur (manager, RH, commercial, opérateur, dirigeant…) avec un expert IA dédié. Les sessions sont calibrées sur le poste, les outils et les objectifs réels — pas sur un programme générique. À partir de ${formattedPrice}.`
              : `Axion-IA's 1-to-1 coaching connects one employee (manager, HR, sales, operator, executive…) with a dedicated AI expert. Sessions are calibrated to the role, tools and real objectives — not a generic programme. From ${formattedPrice}.`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Cta href="/contact" variant="primary" size="lg" shape="pill">
              {isFr ? "Démarrer mon accompagnement" : "Start my coaching"}
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href={"/interventions" as never} variant="ghost" size="lg" shape="pill">
              {isFr ? "Voir les formations groupe" : "See group training"}
            </Cta>
          </div>

          {/* Hero illustration — Sprint visual 2026-05-22 */}
          <div className="mx-auto mt-10 max-w-3xl">
            <Illustration
              slot="UN-A-UN-01-hero"
              aspectRatio="16:9"
              priority
              filenameTarget="public/illustrations/un-a-un-hero.avif"
              alt={
                isFr
                  ? "Illustration éditoriale — coaching IA individuel 1-to-1, expert Axion-IA et collaborateur"
                  : "Editorial illustration — 1-to-1 individual AI coaching, Axion-IA expert and employee"
              }
              caption={isFr ? "Coaching 1-to-1 IA · Axion-IA" : "1-to-1 AI Coaching · Axion-IA"}
            />
          </div>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "Pour qui ?" : "Who for?"}
        title={isFr ? "Tout collaborateur" : "Any employee"}
        titleEm={isFr ? "qui veut vraiment maîtriser l'IA" : "who wants to truly master AI"}
        tone="sand"
      >
        <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
          <p>
            {isFr
              ? "Le 1-to-1 n'est pas réservé aux dirigeants. Il s'adresse à n'importe quel collaborateur qui a un poste précis, des outils précis, et des objectifs précis — et qui veut intégrer l'IA dans son travail réel, pas dans un cours théorique."
              : "The 1-to-1 is not reserved for executives. It is for any employee who has a specific role, specific tools, and specific objectives — and who wants to integrate AI into their actual work, not in a theoretical course."}
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              {isFr
                ? "Manager d'équipe qui veut gagner du temps sur le reporting et le pilotage"
                : "Team manager who wants to save time on reporting and management"}
            </li>
            <li>
              {isFr
                ? "Commercial qui veut accélérer la prospection et la rédaction de propositions"
                : "Sales rep who wants to accelerate prospecting and proposal writing"}
            </li>
            <li>
              {isFr
                ? "RH qui veut automatiser les tâches répétitives (fiches de poste, onboarding, suivi)"
                : "HR professional who wants to automate repetitive tasks (job descriptions, onboarding, tracking)"}
            </li>
            <li>
              {isFr
                ? "Opérateur ou technicien qui veut utiliser l'IA pour documenter, analyser et décider plus vite"
                : "Operator or technician who wants to use AI to document, analyse and decide faster"}
            </li>
            <li>
              {isFr
                ? "Dirigeant qui veut comprendre et piloter l'IA sans passer par l'IT"
                : "Executive who wants to understand and steer AI without going through IT"}
            </li>
          </ul>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "Format" : "Format"}
        title={isFr ? "Comment ça se passe" : "How it works"}
      >
        <Container>
          <ProcessSteps
            orientation="horizontal"
            steps={[
              {
                id: "step-1-cadrage",
                title: isFr ? "Cadrage individuel" : "Individual scoping",
                description: isFr
                  ? "30 min, gratuit. On apprend à connaître le poste, les outils utilisés, les tâches chronophages et les objectifs prioritaires de la personne."
                  : "30 min, free. We get to know the role, tools used, time-consuming tasks and priority objectives of the person.",
              },
              {
                id: "step-2-coaching",
                title: isFr ? "Sessions de coaching" : "Coaching sessions",
                description: isFr
                  ? "En visio ou sur site selon la préférence. Rythme adapté à l'agenda — pas de format imposé. Chaque session travaille sur des cas réels tirés du quotidien de la personne."
                  : "Remote or on-site according to preference. Pace adapted to the schedule — no imposed format. Each session works on real cases from the person's daily life.",
              },
              {
                id: "step-3-progression",
                title: isFr ? "Progression mesurable" : "Measurable progress",
                description: isFr
                  ? "À chaque étape, on valide ce qui est acquis et on ajuste la suite. L'objectif : que la personne soit autonome sur l'IA dans son poste — pas dépendante d'un prestataire."
                  : "At each stage, we validate what has been acquired and adjust what comes next. The objective: the person becomes autonomous with AI in their role — not dependent on a provider.",
              },
            ]}
          />
        </Container>
      </Section>

      {/* Couverture nationale — composant centralisé Sprint 14.9 levier 3 */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'accompagnement 1-to-1 IA"
        serviceLabelEn="1-to-1 AI coaching"
        serviceSlug="un-a-un"
        tone="paper"
      />

      {/* FAQ géo locale — composant centralisé (FAQS_BY_SERVICE pré-existants) */}
      <LocalGeoFaqSection isFr={isFr} service="un-a-un" tone="sand" />

      {/* FAQ générique 1-to-1 (5 questions essentielles, contenu factuel) */}
      <Section
        eyebrow={isFr ? "Questions fréquentes" : "Frequent questions"}
        title={isFr ? "L'essentiel" : "The essentials"}
        titleEm={isFr ? "à savoir" : "to know"}
      >
        <Container>
          <FaqAccordion
            className="mx-auto max-w-3xl"
            items={
              isFr
                ? [
                    {
                      id: "duree-session",
                      question: "Combien de temps dure une session ?",
                      answer:
                        "La journée standard fait 7 h sur site (9h-17h avec pause déjeuner). En visio, on adapte par blocs de 2-3 h selon l'agenda de la personne. Pas de format imposé.",
                    },
                    {
                      id: "prix",
                      question: "Combien ça coûte ?",
                      answer: `${formattedPrice} pour la journée 1-to-1 dirigeant. Pour un collaborateur clé (non-dirigeant), 890 € HT. Frais de déplacement facturés en sus selon distance/durée — devis transparent avant signature.`,
                    },
                    {
                      id: "visio-ou-site",
                      question: "Visio ou sur site ?",
                      answer:
                        "Au choix. La visio fonctionne très bien pour le coaching IA (partage d'écran sur les outils réels de la personne). Le sur site est privilégié quand il faut voir le contexte physique (atelier, ligne de production, point de vente).",
                    },
                    {
                      id: "outils",
                      question: "Quels outils IA sont enseignés ?",
                      answer:
                        "Ceux que la personne utilise déjà ou qui correspondent à son poste : ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, NotebookLM, plus les automatisations métier (Make, Zapier) si pertinent. Pas de techno imposée — on travaille sur ses outils réels.",
                    },
                    {
                      id: "garantie",
                      question: "Garantie de résultat ?",
                      answer:
                        "Si la personne n'a rien tiré de la journée (cas extrêmement rare), on rembourse intégralement. Concrètement, 100 % de nos clients 1-to-1 ressortent avec 3-5 automatisations ou améliorations directement applicables à leur poste.",
                    },
                  ]
                : [
                    {
                      id: "session-length",
                      question: "How long is a session?",
                      answer:
                        "Standard day is 7 h on-site (9am-5pm with lunch break). Remotely, we adapt in 2-3 h blocks based on the person's schedule. No imposed format.",
                    },
                    {
                      id: "price",
                      question: "How much does it cost?",
                      answer: `${formattedPrice} for the 1-to-1 executive day. For a key employee (non-executive), €890 ex. VAT. Travel expenses billed separately based on distance/duration — transparent quote before signature.`,
                    },
                    {
                      id: "remote-or-onsite",
                      question: "Remote or on-site?",
                      answer:
                        "Either. Remote works very well for AI coaching (screen sharing on the person's real tools). On-site is preferred when the physical context matters (workshop, production line, point of sale).",
                    },
                    {
                      id: "tools",
                      question: "Which AI tools are taught?",
                      answer:
                        "The ones the person already uses or that fit their role: ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, NotebookLM, plus business automations (Make, Zapier) if relevant. No imposed tech — we work on their real tools.",
                    },
                    {
                      id: "guarantee",
                      question: "Guarantee?",
                      answer:
                        "If the person got nothing from the day (extremely rare), we refund in full. Concretely, 100 % of our 1-to-1 customers come out with 3-5 automations or improvements directly applicable to their role.",
                    },
                  ]
            }
          />
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Prêt à progresser sur l'IA ?" : "Ready to progress on AI?"}
        description={
          isFr
            ? `À partir de ${formattedPrice}, sans engagement, en visio ou sur site partout en France métropolitaine.`
            : `From ${formattedPrice}, no commitment, remote or on-site anywhere in metropolitan France.`
        }
        cta={
          <Cta href="/contact" size="lg">
            {isFr ? "Démarrer mon accompagnement 1-to-1" : "Start my 1-to-1 coaching"}
          </Cta>
        }
        tone="dark"
      />

      {/* CTA mobile sticky — apparaît au scroll, masqué sur lg+ */}
      <StickyMobileCta
        href="/contact"
        label={isFr ? "Démarrer mon 1-to-1" : "Start my 1-to-1"}
        track="un-a-un-sticky-mobile"
      />

      <JsonLd data={serviceJsonLd} />
    </>
  );
}
