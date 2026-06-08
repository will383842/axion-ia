import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { MethodologyHeroSchema } from "@/components/sections/MethodologyHeroSchema";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { Illustration } from "@/components/visual/Illustration";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  buildProductMetadata,
  buildHowToJsonLd,
  buildArticleJsonLd,
  SITE_EDITORIAL_DATE,
} from "@/lib/seo";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/methodologie",
    title:
      locale === "fr"
        ? "Méthodologie Axion-IA · 4 étapes vers le ROI"
        : "Axion-IA methodology · 4 steps to ROI",
    description:
      locale === "fr"
        ? "La méthode Axion-IA en 4 étapes : cartographie terrain, audit en 5 jours, implémentation en 6-8 semaines, ROI mesuré. Découplée du contrat long. Demandez un audit."
        : "Our methodology: field audit, applied demos, costed plan, piloted implementation.",
    alternates: { fr: "/methodologie", en: "/methodology" },
  });
}

export default async function MethodologyPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Article JSON-LD via factory centralisée — porte les signaux E-E-A-T 2026
  // (Author + dateModified + publisher logo + mainEntityOfPage) automatiquement.
  // Audit perfection 2026-05-12.
  const articleJsonLd = buildArticleJsonLd({
    locale: loc,
    path: loc === "fr" ? "/methodologie" : "/methodology",
    headline: isFr
      ? "Méthodologie Axion-IA · 4 étapes vers le ROI"
      : "Axion-IA methodology · 4 steps to ROI",
    description: isFr
      ? "Notre méthode propriétaire en 4 étapes : identifier sur le terrain, auditer en 5 jours, implémenter en 6-8 semaines, mesurer le ROI réel."
      : "Our proprietary 4-step method: identify in the field, audit in 5 days, implement in 6-8 weeks, measure real ROI.",
    datePublished: "2025-12-01",
    dateModified: SITE_EDITORIAL_DATE,
    articleSection: isFr ? "Méthodologie" : "Methodology",
    keywords: isFr
      ? ["méthodologie IA", "audit IA", "implémentation IA", "ROI IA"]
      : ["AI methodology", "AI audit", "AI implementation", "AI ROI"],
  });

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/methodologie", label: isFr ? "Méthodologie" : "Methodology" }];

  // HowTo JSON-LD — AEO 2026 critical : Google AI Overviews + Perplexity
  // citent les HowTo schemas pour répondre aux requêtes « comment Axion-IA
  // procède ? », « quelles étapes pour un audit IA ? », etc.
  const howToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: "/methodologie",
    name: isFr
      ? "Méthodologie Axion-IA · 4 étapes vers le ROI"
      : "Axion-IA methodology · 4 steps to ROI",
    description: isFr
      ? "Notre méthode propriétaire en 4 étapes : identifier sur le terrain, auditer en 5 jours, implémenter en 6-8 semaines, mesurer le ROI réel."
      : "Our proprietary 4-step method: identify in the field, audit in 5 days, implement in 6-8 weeks, measure real ROI.",
    totalTime: "P12W",
    // Prix d'entrée de la méthode = tarif SSOT de l'intervention Essentielle
    // (la « 1 journée d'intervention » de l'étape Identifier). Jamais hardcodé :
    // dérivé de pricing.ts pour rester aligné si Will fait évoluer la grille.
    estimatedCost: {
      currency: "EUR",
      value: String(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat),
    },
    steps: isFr
      ? [
          {
            name: "Identifier",
            text: "Cartographie terrain en 1 journée d'intervention sur site. 3-5 process candidats à l'IA, démos live sur vos données anonymisées, identification des quick-wins déployables sous 30 jours.",
          },
          {
            name: "Auditer",
            text: "Audit IA en 5 jours : cartographie complète, scoring ROI/complexité par opportunité, plan d'implémentation chiffré priorisé. Livrable PDF 25-40 pages + atelier de restitution.",
          },
          {
            name: "Implémenter",
            text: "Mise en production en 6-8 semaines : cadrage technique, prototype itératif, tests utilisateurs, déploiement progressif, support 30 jours inclus.",
          },
          {
            name: "Mesurer",
            text: "Mesure du ROI réel post-déploiement : heures économisées, coût économisé, impact qualitatif. Itération si dérive de qualité observée.",
          },
        ]
      : [
          {
            name: "Identify",
            text: "Field mapping in 1 day on-site session. 3-5 candidate processes for AI, live demos on your anonymised data, identification of quick-wins deployable within 30 days.",
          },
          {
            name: "Audit",
            text: "5-day AI audit: complete mapping, ROI/complexity scoring per opportunity, costed prioritised implementation plan. 25-40 page PDF deliverable + debrief workshop.",
          },
          {
            name: "Implement",
            text: "Production deployment in 6-8 weeks: technical scoping, iterative prototype, user testing, progressive rollout, 30-day support included.",
          },
          {
            name: "Measure",
            text: "Real ROI measurement post-deployment: hours saved, cost saved, qualitative impact. Iteration if quality drift is observed.",
          },
        ],
  });

  const steps = isFr
    ? [
        {
          n: "01",
          h: "Identifier",
          p: "Cartographie terrain en 1 journée d'intervention sur site. 3-5 process candidats à l'IA, démos live sur vos données anonymisées, identification des quick-wins déployables sous 30 jours.",
        },
        {
          n: "02",
          h: "Auditer",
          p: "Audit IA en 5 jours : cartographie complète, scoring ROI/complexité par opportunité, plan d'implémentation chiffré priorisé. Livrable PDF 25-40 pages + atelier de restitution.",
        },
        {
          n: "03",
          h: "Implémenter",
          p: "Mise en production en 6-8 semaines : cadrage technique, prototype itératif, tests utilisateurs, déploiement progressif, support 30 jours inclus. Stack open-source ou propriétaire selon le cas.",
        },
        {
          n: "04",
          h: "Mesurer",
          p: "Mesure du ROI réel post-déploiement : heures économisées, coût économisé, impact qualitatif. Itération si dérive de qualité observée. Pas d'engagement long terme.",
        },
      ]
    : [
        {
          n: "01",
          h: "Identify",
          p: "Field mapping in 1 day on-site session. 3-5 candidate processes for AI, live demos on your anonymised data, identification of quick-wins deployable within 30 days.",
        },
        {
          n: "02",
          h: "Audit",
          p: "5-day AI audit: complete mapping, ROI/complexity scoring per opportunity, costed prioritised implementation plan. 25-40 page PDF deliverable + debrief workshop.",
        },
        {
          n: "03",
          h: "Implement",
          p: "Production deployment in 6-8 weeks: technical scoping, iterative prototype, user testing, progressive go-live, 30-day support included. Open-source or proprietary stack as needed.",
        },
        {
          n: "04",
          h: "Measure",
          p: "Real ROI measurement post-deployment: hours saved, costs saved, qualitative impact. Iteration if quality drift observed. No long-term commitment.",
        },
      ];

  const whyMethodology = isFr
    ? [
        {
          h: "Sur vos données, pas sur des démos vendeur",
          p: "Chaque étape s'appuie sur vos process réels, vos outils, vos chiffres. On démontre, on ne raconte pas.",
        },
        {
          h: "Découplée du contrat long",
          p: "Vous pouvez vous arrêter après l'audit, après l'implémentation, après la mesure. Aucun lock-in technique ni commercial.",
        },
        {
          h: "Mesurée, pas promise",
          p: "Le ROI est calculé sur des indicateurs convenus avant le déploiement, pas sur des projections marketing.",
        },
      ]
    : [
        {
          h: "On your data, not on vendor demos",
          p: "Every step uses your real processes, tools and numbers. We demonstrate — we don't pitch.",
        },
        {
          h: "Decoupled from long contracts",
          p: "You can stop after the audit, after deployment, after measurement. Zero technical or commercial lock-in.",
        },
        {
          h: "Measured, not promised",
          p: "ROI is calculated on indicators agreed before deployment, not on marketing projections.",
        },
      ];

  // FAQ AEO — Q/R factuelles citables (Google AI Overviews / Perplexity).
  // FaqBlock émet automatiquement le FAQPage JSON-LD via FaqAccordion.
  const methodoFaq = isFr
    ? [
        {
          id: "duree-audit",
          question: "Combien de temps dure un audit IA Axion-IA ?",
          answer:
            "L'audit IA Axion-IA se déroule sur 5 jours : cartographie complète des process, scoring ROI/complexité par opportunité et plan d'implémentation chiffré priorisé. Vous repartez avec un livrable PDF de 25 à 40 pages et un atelier de restitution.",
        },
        {
          id: "arret-apres-audit",
          question: "Peut-on s'arrêter après l'audit, sans poursuivre l'implémentation ?",
          answer:
            "Oui. La méthode est volontairement découplée du contrat long : vous pouvez vous arrêter après l'audit, après l'implémentation ou après la mesure. Aucun lock-in technique ni commercial, et le plan chiffré reste exploitable même si vous internalisez la suite.",
        },
        {
          id: "roi-attendu",
          question: "Quel ROI attendre d'une mission Axion-IA ?",
          answer:
            "Le ROI est calculé sur des indicateurs convenus avant le déploiement (heures économisées, coût économisé, impact qualitatif), pas sur des projections marketing. Il est mesuré sur vos process réels après mise en production, puis ajusté si une dérive de qualité est observée.",
        },
        {
          id: "etapes",
          question: "Quelles sont les étapes de la méthodologie Axion-IA ?",
          answer:
            "Quatre temps clairement séparés, chacun produisant un livrable concret : Identifier (cartographie terrain en 1 journée), Auditer (audit en 5 jours), Implémenter (mise en production en 6-8 semaines, support 30 jours inclus), Mesurer (ROI réel post-déploiement).",
        },
      ]
    : [
        {
          id: "duree-audit",
          question: "How long does an Axion-IA AI audit take?",
          answer:
            "The Axion-IA AI audit runs over 5 days: complete process mapping, ROI/complexity scoring per opportunity and a costed prioritised implementation plan. You leave with a 25-40 page PDF deliverable and a debrief workshop.",
        },
        {
          id: "arret-apres-audit",
          question: "Can we stop after the audit, without continuing the implementation?",
          answer:
            "Yes. The method is deliberately decoupled from long contracts: you can stop after the audit, after implementation or after measurement. Zero technical or commercial lock-in, and the costed plan stays usable even if you handle the rest in-house.",
        },
        {
          id: "roi-attendu",
          question: "What ROI should we expect from an Axion-IA engagement?",
          answer:
            "ROI is calculated on indicators agreed before deployment (hours saved, cost saved, qualitative impact), not on marketing projections. It is measured on your actual processes after go-live, then adjusted if quality drift is observed.",
        },
        {
          id: "etapes",
          question: "What are the steps of the Axion-IA methodology?",
          answer:
            "Four clearly separated phases, each producing a concrete deliverable: Identify (1-day field mapping), Audit (5-day audit), Implement (production in 6-8 weeks, 30-day support included), Measure (real post-deployment ROI).",
        },
      ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* HERO — layout 2 colonnes (text + flow narratif méthodologie). */}
      <section className="bg-halo-warm text-fg relative pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-strong) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at center, white 15%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, white 15%, transparent 70%)",
            opacity: 0.1,
          }}
        />
        <Container className="relative">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            {/* Colonne gauche — eyebrow + titre + description + CTA */}
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Méthodologie" : "Methodology"}
              </p>
              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "4 étapes vers le " : "4 steps to "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "ROI mesurable" : "measurable ROI"}
                </span>
              </h1>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Méthodologie Axion-IA, éprouvée sur 50+ entreprises de la TPE au mid-market. On démontre sur vos données, pas sur des démos vendeur."
                  : "Axion-IA methodology, proven on 50+ companies from small business to mid-market. We demonstrate on your data, not vendor demos."}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta href="/audit" size="lg">
                  {isFr ? "Voir les 4 niveaux d'audit" : "See the 4 audit levels"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <Cta href="/cas-concrets" variant="outline" size="lg">
                  {isFr ? "Voir les cas concrets" : "See case studies"}
                </Cta>
              </div>
            </div>

            {/* Colonne droite — flow narratif méthodologie 4 étapes */}
            <MethodologyHeroSchema
              isFr={isFr}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? "Schéma méthodologie Axion-IA : votre entreprise au départ, 4 étapes méthodologiques (Identifier, Auditer, Implémenter, Mesurer), puis 4 résultats concrets (plan chiffré, process automatisés, équipes formées, ROI mesuré)."
                  : "Axion-IA methodology diagram: your company at the start, 4 method steps (Identify, Audit, Implement, Measure), then 4 concrete outcomes (costed plan, automated processes, trained teams, measured ROI)."
              }
            />
          </div>
        </Container>
      </section>

      {/* SECTION — détail des 4 étapes */}
      <Section
        eyebrow={isFr ? "Le détail" : "In detail"}
        title={isFr ? "Comment se déroule" : "How it"}
        titleEm={isFr ? "concrètement" : "actually unfolds"}
        description={
          isFr
            ? "Quatre temps clairement séparés. Chacun produit un livrable concret. Chacun peut être le dernier."
            : "Four clearly separated phases. Each produces a concrete deliverable. Each can be the last."
        }
      >
        <Container>
          <ol className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n} className="space-y-3">
                <p className="text-primary font-mono text-2xl tabular-nums">{s.n}</p>
                <h2 className="text-fg text-xl leading-tight font-semibold tracking-tight">
                  {s.h}
                </h2>
                <p className="text-fg-soft text-base leading-relaxed">{s.p}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* SECTION — Pourquoi cette méthodologie (extension copy +300 mots) */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Notre parti pris" : "Our principle"}
        title={isFr ? "Pourquoi" : "Why this"}
        titleEm={isFr ? "cette méthode" : "method"}
        description={
          isFr
            ? "Trois principes non-négociables qui guident chaque mission Axion-IA, du diagnostic flash à l'audit stratégique ETI."
            : "Three non-negotiable principles guiding every Axion-IA engagement, from flash diagnosis to strategic mid-cap audit."
        }
      >
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-14">
            {/* Visuel placeholder à gauche en lg, en haut en mobile */}
            <Illustration
              slot="METHO-02-mid"
              aspectRatio="1:1"
              filenameTarget="public/illustrations/methodologie-mid-1.avif"
              caption={
                isFr
                  ? "Compas de précision sur feuille gridée — précision opérationnelle"
                  : "Precision compass on gridded paper — operational precision"
              }
              alt={
                isFr
                  ? "Illustration éditoriale d'un compas de précision au-dessus d'une feuille gridée, symbole de la précision méthodologique d'Axion-IA."
                  : "Editorial illustration of a precision compass over gridded paper, symbol of Axion-IA's methodological precision."
              }
              className="border-terracotta/30 bg-halo-warm shadow-subtle relative w-full overflow-hidden rounded-2xl border-2 border-dashed lg:sticky lg:top-24"
            />
            {/* Liste des 3 principes à droite */}
            <ol className="space-y-7">
              {whyMethodology.map((w, i) => (
                <li key={w.h} className="flex gap-5">
                  <span
                    aria-hidden="true"
                    className="text-terracotta-deep shrink-0 font-mono text-lg tracking-[0.12em] tabular-nums"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-fg text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
                      {w.h}
                    </h3>
                    <p className="text-fg-soft mt-3 text-base leading-relaxed sm:text-lg">{w.p}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </Section>

      {/* SECTION — closing visual avant CtaBlock */}
      <Section tone="canvas">
        <Container>
          <div className="mx-auto max-w-3xl">
            <Illustration
              slot="METHO-04-closing"
              aspectRatio="16:9"
              filenameTarget="public/illustrations/methodologie-closing.avif"
              caption={
                isFr
                  ? "Cycle continu — la méthode appliquée, ronde mais pas répétitive"
                  : "Continuous cycle — method applied, looping but not repeating"
              }
              alt={
                isFr
                  ? "Illustration éditoriale d'un cycle continu représentant la méthodologie Axion-IA appliquée dans la durée."
                  : "Editorial illustration of a continuous cycle representing the Axion-IA methodology applied over time."
              }
            />
          </div>
        </Container>
      </Section>

      {/* FAQ AEO — visible + FAQPage JSON-LD auto via FaqAccordion */}
      <FaqBlock
        tone="canvas"
        eyebrow="FAQ"
        title={isFr ? "Questions" : "Common"}
        titleEm={isFr ? "fréquentes" : "questions"}
        description={
          isFr
            ? "Durée d'audit, engagement, ROI — les réponses concrètes avant de démarrer."
            : "Audit duration, commitment, ROI — concrete answers before you start."
        }
        items={methodoFaq}
      />

      <CtaBlock
        title={isFr ? "Prêt à démarrer ?" : "Ready to start?"}
        description={
          isFr
            ? `Réservez l'Essentielle ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })} pour identifier 3-5 quick-wins en une journée.`
            : `Book the Essential ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })} to identify 3-5 quick-wins in one day.`
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr
              ? `Voir l'Essentielle ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}`
              : `See the Essential ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}`}{" "}
            â†’
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={articleJsonLd} />
      <JsonLd data={howToJsonLd} />
    </>
  );
}
