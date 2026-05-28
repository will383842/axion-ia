// Server Component — listing des formations d'une cellule (Collectives × durée).
// Utilisé par les 4 pages :
//   /interventions/collectives/4h
//   /interventions/collectives/1-jour
//   /interventions/collectives/2-jours
//   /interventions/collectives/3-jours-plus  (variante isQuoteOnly)
//
// Sprint 14.10.7 (2026-05-11).

import type { ReactNode } from "react";
import { ArrowRight, Clock, Sparkles, Mail } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { InterventionFormatCard } from "@/components/sections/InterventionFormatCard";
// Sprint perfection 2026-05-28 (Will) — enrichissement SEO/AEO sous-pages
// durée : ajout FAQ Speakable + couverture locale + sticky CTA mobile pour
// parité avec la page hub /collectives.
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import {
  type CollectiveDuration,
  getDuration,
  getFamily,
  getFormatsByCell,
  quoteContactPath,
} from "@/content/interventions-taxonomy";
import { buildCourseJsonLd, buildItemListJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  durationId: CollectiveDuration;
  locale: Locale;
}

const TIGHT_X = "lg:px-6 xl:px-10";

export function CollectiveDurationListing({ durationId, locale }: Props): ReactNode {
  const isFr = locale === "fr";
  const duration = getDuration(durationId);
  const family = getFamily("collectives");
  const formats = getFormatsByCell("collectives", durationId);
  const isQuote = duration.isQuoteOnly === true;
  const isEmpty = !isQuote && formats.length === 0;
  const contactHref = quoteContactPath(duration, locale);

  // Sprint perfection 2026-05-28 (Will) — retrait du 1er item `/interventions`
  // qui redirige 301 vers `/collectives` (hub /interventions supprimé refonte
  // 2026-05-28, voir routes.ts:38-40). Breadcrumb 2 niveaux propres : famille
  // → durée. Évite la boucle navigationnelle « parent mort ».
  const breadcrumbItems = [
    {
      href: "/interventions/collectives",
      label: isFr ? family.labelFr : family.labelEn,
    },
    {
      href: locale === "fr" ? duration.pathFr : duration.pathEn,
      label: isFr ? duration.labelFr : duration.labelEn,
    },
  ];

  // ItemList JSON-LD pour les formats — factory centralisée seo.ts
  // (audit perfection 2026-05-12).
  const itemListJsonLd =
    formats.length > 0
      ? buildItemListJsonLd({
          locale,
          path: locale === "fr" ? duration.pathFr : duration.pathEn,
          name: isFr ? duration.labelFr : duration.labelEn,
          items: formats.map((f, idx) => ({
            position: idx + 1,
            name: isFr ? f.labelFr : f.labelEn,
            url: `${SITE_URL}/${locale}${locale === "fr" ? f.pathFr : f.pathEn}`,
            description: isFr ? f.taglineFr : f.taglineEn,
          })),
        })
      : null;

  // Sprint perfection 2026-05-28 (Will) — FAQ Speakable par palier durée.
  // Q/R spécifiques à chaque palier (effectif, contenu, prix, frais déplacement,
  // garantie) pour éviter le duplicate content SEO entre les 4 sous-pages.
  // FaqAccordion injecte automatiquement FAQPage JSON-LD + Speakable.
  const FAQ_BY_DURATION: Record<
    CollectiveDuration,
    {
      fr: ReadonlyArray<{ id: string; question: string; answer: string }>;
      en: ReadonlyArray<{ id: string; question: string; answer: string }>;
    }
  > = {
    "4h": {
      fr: [
        {
          id: "4h-objectif",
          question: "Que peut-on accomplir en 4 heures ?",
          answer:
            "Une demi-journée express pour découvrir l'IA, identifier 2-3 cas d'usage prioritaires et installer une première automatisation. Format idéal pour cadrer ou amorcer une démarche IA sans bloquer une journée complète.",
        },
        {
          id: "4h-effectif",
          question: "Combien de participants en 4 heures ?",
          answer:
            "De 2 à 20 personnes en prix fixe. Au-delà, on bascule sur le palier 1 jour ou Conférence pour garder de l'interaction.",
        },
        {
          id: "4h-frais",
          question: "Frais de déplacement inclus ?",
          answer:
            "Non. Logement (si nécessaire), repas et forfait trajet facturés en sus, calculés selon distance/durée. Devis transparent avant signature.",
        },
        {
          id: "4h-suivi",
          question: "Suivi inclus après la formation 4 heures ?",
          answer:
            "Oui — support 30 jours pour répondre aux questions post-formation par email. Option maintenance standard 290 €/mois pour aller plus loin.",
        },
      ],
      en: [
        {
          id: "4h-objectif",
          question: "What can be done in 4 hours?",
          answer:
            "An express half-day to discover AI, identify 2-3 priority use cases and install a first automation. Ideal to scope or kick off an AI initiative without blocking a full day.",
        },
        {
          id: "4h-effectif",
          question: "How many participants in 4 hours?",
          answer:
            "From 2 to 20 people, flat price. Beyond that, switch to the 1-day tier or Conference to keep interaction.",
        },
        {
          id: "4h-frais",
          question: "Travel expenses included?",
          answer:
            "No. Lodging (if needed), meals and travel allowance billed separately, calculated by distance/duration. Transparent quote before signature.",
        },
        {
          id: "4h-suivi",
          question: "Follow-up included after the 4-hour session?",
          answer:
            "Yes — 30-day email support for post-training questions. Standard maintenance option €290/month for deeper work.",
        },
      ],
    },
    "1-jour": {
      fr: [
        {
          id: "1j-objectif",
          question: "Que livre une formation IA d'1 jour ?",
          answer:
            "Une journée complète (≈ 7 h sur site) avec cadrage du matin, ateliers pratiques l'après-midi, plan d'action le soir. Chaque participant maîtrise 3-5 automatisations applicables à ses tâches dès le lendemain.",
        },
        {
          id: "1j-formats",
          question: "Quels formats 1 jour disponibles ?",
          answer:
            "Trois formats au choix : Essentielle (découverte opérationnelle large), Gagner du temps (automatisations métier ciblées), Intervention Claude (focus Anthropic Claude pour rédaction et analyse).",
        },
        {
          id: "1j-effectif",
          question: "Combien de participants en 1 jour ?",
          answer:
            "De 2 à 30 personnes en 3 tranches tarifaires (2-8 / 9-15 / 16-30). Au-delà, on bascule sur Conférence (sur devis).",
        },
        {
          id: "1j-outils",
          question: "Quels outils IA utilisés en formation 1 jour ?",
          answer:
            "Ceux que votre équipe utilise déjà ou qui collent au métier : ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, NotebookLM + automatisations Make/Zapier si pertinent. Pas de techno imposée.",
        },
        {
          id: "1j-frais",
          question: "Frais de déplacement inclus en formation 1 jour ?",
          answer:
            "Non. Logement, repas et forfait trajet facturés en sus, calculés au cas par cas selon distance/durée. Devis transparent avant signature.",
        },
      ],
      en: [
        {
          id: "1j-objectif",
          question: "What does a 1-day AI training deliver?",
          answer:
            "A full day (≈ 7 h on site) with morning scoping, afternoon hands-on workshops, evening action plan. Each participant masters 3-5 automations applicable to their tasks from day one.",
        },
        {
          id: "1j-formats",
          question: "Which 1-day formats are available?",
          answer:
            "Three formats: Essential (broad operational discovery), Save Time (targeted business automations), Claude Intervention (Anthropic Claude focus for writing and analysis).",
        },
        {
          id: "1j-effectif",
          question: "How many participants in 1 day?",
          answer:
            "From 2 to 30 people in 3 price brackets (2-8 / 9-15 / 16-30). Beyond that, switch to Conference (on quote).",
        },
        {
          id: "1j-outils",
          question: "Which AI tools are used in 1-day training?",
          answer:
            "The ones your team already uses or that fit the roles: ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, NotebookLM + Make/Zapier automations if relevant. No imposed tech.",
        },
        {
          id: "1j-frais",
          question: "Travel expenses included in 1-day training?",
          answer:
            "No. Lodging, meals and travel allowance billed separately, calculated by distance/duration. Transparent quote before signature.",
        },
      ],
    },
    "2-jours": {
      fr: [
        {
          id: "2j-objectif",
          question: "Pourquoi choisir 2 jours plutôt qu'1 jour ?",
          answer:
            "Pour aller en profondeur : approfondissement des cas réels de l'équipe, transfert IA-fluence durable, automatisations multi-étapes complexes. Les 2 jours permettent d'installer les méthodes, pas seulement de les présenter.",
        },
        {
          id: "2j-effectif",
          question: "Combien de participants en 2 jours ?",
          answer:
            "De 2 à 30 personnes en 3 tranches tarifaires (2-8 / 9-15 / 16-30) — même grille que le format 1 jour. Au-delà, on bascule sur 3 jours+ sur mesure.",
        },
        {
          id: "2j-contenu",
          question: "Que couvre une formation IA de 2 jours ?",
          answer:
            "Jour 1 : panorama IA + outils + premières automatisations. Jour 2 : cas métier avancés + intégrations (Make, Zapier, agents) + plan de déploiement équipe. Programme calibré sur les profils présents.",
        },
        {
          id: "2j-frais",
          question: "Frais de déplacement inclus en formation 2 jours ?",
          answer:
            "Non. Logement (2 nuits sur site), repas et forfait trajet facturés en sus. Devis transparent avant signature.",
        },
      ],
      en: [
        {
          id: "2j-objectif",
          question: "Why choose 2 days over 1 day?",
          answer:
            "To go deeper: deep dive into real team cases, durable AI-fluency transfer, complex multi-step automations. 2 days installs methods rather than just presenting them.",
        },
        {
          id: "2j-effectif",
          question: "How many participants in 2 days?",
          answer:
            "From 2 to 30 people in 3 price brackets (2-8 / 9-15 / 16-30) — same grid as the 1-day format. Beyond that, switch to bespoke 3-days+.",
        },
        {
          id: "2j-contenu",
          question: "What does a 2-day AI training cover?",
          answer:
            "Day 1: AI overview + tools + first automations. Day 2: advanced business cases + integrations (Make, Zapier, agents) + team deployment plan. Programme calibrated to profiles present.",
        },
        {
          id: "2j-frais",
          question: "Travel expenses included in 2-day training?",
          answer:
            "No. Lodging (2 nights on site), meals and travel allowance billed separately. Transparent quote before signature.",
        },
      ],
    },
    "3-jours-plus": {
      fr: [
        {
          id: "3jplus-objectif",
          question: "Quand choisir 3 jours ou plus ?",
          answer:
            "Pour les séminaires dirigeants, off-sites équipe, programmes multi-sites, ou contenus ultra-spécifiques nécessitant un déploiement progressif. Chaque programme est unique — on cadre par appel, on construit ensemble.",
        },
        {
          id: "3jplus-process",
          question: "Comment se déroule la demande de devis 3 jours+ ?",
          answer:
            "1) Cadrage par visio pour comprendre votre besoin et vos contraintes. 2) Programme personnalisé construit ensemble — durée, contenu, modalités. 3) Devis détaillé sous 48 h ouvrées. 4) Facturation après l'intervention.",
        },
        {
          id: "3jplus-effectif",
          question: "Y a-t-il une limite de participants ?",
          answer:
            "Non. Pour les multi-sites, on construit un dispositif avec des sessions parallèles ou un déploiement échelonné. Pour les off-sites cadres, on peut adapter en groupes de 6-12 pour maximiser l'interaction.",
        },
        {
          id: "3jplus-tarif",
          question: "Quel est le prix d'une formation 3 jours et plus ?",
          answer:
            "Sur devis — varie selon nombre de jours, effectif, complexité du contenu, frais de déplacement. À titre indicatif : un programme 3 jours pour 15 personnes démarre généralement à partir de 8 000 € HT.",
        },
      ],
      en: [
        {
          id: "3jplus-objectif",
          question: "When to choose 3 days or more?",
          answer:
            "For executive seminars, team off-sites, multi-site programmes, or ultra-specific content requiring progressive deployment. Each programme is unique — we frame by call, build together.",
        },
        {
          id: "3jplus-process",
          question: "How does the 3-days+ quote process work?",
          answer:
            "1) Framing video call to understand need and constraints. 2) Personalised programme built together — duration, content, format. 3) Detailed quote within 48 business hours. 4) Invoicing after the session.",
        },
        {
          id: "3jplus-effectif",
          question: "Is there a participant limit?",
          answer:
            "No. For multi-site, we build a setup with parallel sessions or staged deployment. For executive off-sites, we can adapt in groups of 6-12 to maximise interaction.",
        },
        {
          id: "3jplus-tarif",
          question: "What's the price for 3+ days training?",
          answer:
            "On quote — varies by days, headcount, content complexity, travel expenses. As reference: a 3-day programme for 15 people typically starts from €8,000 ex VAT.",
        },
      ],
    },
  };

  const faqItems = isFr ? FAQ_BY_DURATION[durationId].fr : FAQ_BY_DURATION[durationId].en;

  // City Domination 2026-05-18 P1-2 (audit A4 P1) — Course JSON-LD activé
  // pour citation AEO "formation IA" par Google AI Overviews / Perplexity /
  // Claude. Le naming brand reste "intervention" en URL et copy, mais le
  // schema déclare la sémantique formative pour ne pas rater l'opportunité
  // AEO sur les requêtes "formation IA 1 jour", "formation ChatGPT entreprise",
  // etc. Non émis sur les paliers `isQuoteOnly` (3-jours-plus) qui sont
  // sur-mesure (pas de prix fixe → Course Offer incohérent).
  const courseJsonLd = !isQuote
    ? buildCourseJsonLd({
        locale,
        path: locale === "fr" ? duration.pathFr : duration.pathEn,
        name: isFr
          ? `Intervention IA opérationnelle ${duration.labelFr}`
          : `Operational AI session — ${duration.labelEn}`,
        description: isFr
          ? `Intervention IA opérationnelle sur ${duration.labelFr.toLowerCase()} pour décideurs, managers et équipes. Format intervention Axion-IA (cabinet IA opérationnel français). De 2 à 30+ personnes selon le format choisi.`
          : `Operational AI engagement over ${duration.labelEn.toLowerCase()} for decision-makers, managers and teams. Axion-IA intervention format (operational AI consultancy, France). From 2 to 30+ people depending on chosen format.`,
        courseMode: ["Onsite"],
        ...(duration.iso8601Duration ? { duration: duration.iso8601Duration } : {}),
        audienceType: isFr
          ? "Décideurs, managers, équipes opérationnelles (B2B)"
          : "Decision-makers, managers, operational teams (B2B)",
        about: "IA opérationnelle (ChatGPT, Claude, Mistral, agents IA, automatisations)",
      })
    : null;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO PALIER */}
      <section className="bg-halo-warm text-fg relative overflow-hidden py-14 sm:py-16 lg:py-20">
        <Container className={cn("relative", TIGHT_X)}>
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className={cn(
                  "mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle",
                  isQuote ? "bg-terracotta-deep" : "bg-terracotta",
                )}
              />
              {isFr ? "Formations équipe" : "Team trainings"}
              <span className="mx-2 opacity-50">·</span>
              {isFr ? duration.shortFr : duration.shortEn}
            </p>

            <h1 className="display-editorial text-fg mt-5">
              {isFr ? duration.labelFr : duration.labelEn}
            </h1>

            <p className="text-fg-soft mt-5 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {isFr ? duration.durationDetailFr : duration.durationDetailEn}
              {!isQuote && formats.length > 0
                ? isFr
                  ? ` — ${formats.length} formation${formats.length > 1 ? "s" : ""} disponible${formats.length > 1 ? "s" : ""}.`
                  : ` — ${formats.length} training${formats.length > 1 ? "s" : ""} available.`
                : ""}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {!isQuote ? (
                <Cta
                  href="/reserver"
                  size="lg"
                  className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-[0_8px_24px_-8px_rgba(205,107,72,0.6)]"
                  track={`collectives-${duration.slug}-hero-primary`}
                >
                  {isFr ? "Pré-réserver sur le calendrier" : "Pre-book on the calendar"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
              ) : (
                <Cta href={contactHref} size="lg" track={`collectives-${duration.slug}-hero-quote`}>
                  {isFr ? "Demander un devis sur mesure" : "Request a bespoke quote"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
              )}
              <Cta
                href="/interventions/collectives"
                variant="outline"
                size="lg"
                track={`collectives-${duration.slug}-hero-back`}
              >
                {isFr ? "← Autres durées" : "← Other durations"}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* CORPS */}
      {isQuote ? (
        // -----------------------------------------------------------------
        // Variante DEVIS (3 jours et plus) — pas de cards, juste invitation
        // claire à contacter avec objet pré-rempli.
        // -----------------------------------------------------------------
        <Section
          tone="paper"
          eyebrow={isFr ? "Sur mesure" : "Bespoke"}
          title={isFr ? "3 jours ou plus :" : "3 days or more:"}
          titleEm={isFr ? "on construit avec vous" : "we build it with you"}
          description={
            isFr
              ? "Au-delà de 2 jours consécutifs, chaque programme est unique. On cadre par appel, on construit ensemble, on chiffre sous 48 h ouvrées."
              : "Beyond 2 consecutive days, every programme is unique. We frame by call, build together, and quote within 48 business hours."
          }
          contentClassName={TIGHT_X}
        >
          <div className="bg-paper border-border shadow-subtle mx-auto max-w-2xl rounded-3xl border p-8 sm:p-10">
            <div className="bg-terracotta-soft text-terracotta-deep mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl">
              <Sparkles aria-hidden="true" className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <h2 className="text-fg text-2xl leading-tight font-semibold">
              {isFr
                ? "Décrivez votre besoin · on revient sous 48 h"
                : "Describe your need · we get back within 48 h"}
            </h2>
            <p className="text-fg-soft mt-3 text-base leading-relaxed">
              {isFr
                ? "Le formulaire de contact est pré-rempli avec l'objet « formation collective sur mesure ». Précisez la durée souhaitée, le nombre de participants, et les sujets que vous voulez couvrir."
                : "The contact form is pre-filled with the subject « bespoke team training ». State the desired duration, headcount, and topics you want to cover."}
            </p>
            <ul className="mt-6 space-y-2.5 text-[14.5px]">
              {(isFr
                ? [
                    "Cadrage par visio pour comprendre votre besoin et vos contraintes",
                    "Programme personnalisé construit ensemble — durée, contenu, modalités",
                    "Devis détaillé sous 48 h ouvrées · facture après l'intervention",
                  ]
                : [
                    "Framing video call to understand your need and constraints",
                    "Personalised programme built together — duration, content, format",
                    "Detailed quote within 48 business hours · invoice after the session",
                  ]
              ).map((line, i) => (
                <li key={i} className="text-fg flex items-start gap-3">
                  <span className="bg-terracotta-soft text-terracotta-deep mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                    <ArrowRight aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <Cta href={contactHref} size="lg" track={`collectives-${duration.slug}-quote-form`}>
                <Mail aria-hidden="true" className="h-4 w-4" />
                {isFr ? "Ouvrir le formulaire de devis" : "Open the quote form"}
              </Cta>
            </div>
          </div>
        </Section>
      ) : isEmpty ? (
        // -----------------------------------------------------------------
        // Variante VIDE — palier déclaré mais pas encore de formats. CTA
        // contact + signal commercial.
        // -----------------------------------------------------------------
        <Section
          tone="paper"
          eyebrow={isFr ? "Formats en préparation" : "Formats coming soon"}
          title={isFr ? "Pas encore de formation" : "No training yet"}
          titleEm={isFr ? "publiée à cette durée" : "published for this duration"}
          description={
            isFr
              ? "Le format est en cours de finalisation. Si vous voulez être prévenu·e dès qu'il est disponible — ou si vous voulez une formation 4 heures sur mesure dès maintenant — contactez-nous."
              : "The format is being finalised. If you want to be notified when it's available — or if you want a bespoke 4-hour training now — get in touch."
          }
          contentClassName={TIGHT_X}
        >
          <div className="bg-paper border-border shadow-subtle mx-auto max-w-2xl rounded-3xl border p-8 text-center sm:p-10">
            <div className="bg-terracotta-soft text-terracotta-deep mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl">
              <Clock aria-hidden="true" className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <p className="text-fg-soft text-base leading-relaxed">
              {isFr
                ? `${duration.durationDetailFr}. Nous publions de nouvelles formations régulièrement — cette page se remplira au fil des sprints.`
                : `${duration.durationDetailEn}. We publish new trainings regularly — this page will fill up over time.`}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Cta
                href={contactHref}
                size="lg"
                track={`collectives-${duration.slug}-empty-contact`}
              >
                <Mail aria-hidden="true" className="h-4 w-4" />
                {isFr ? "Demander une formation" : "Request a training"}
              </Cta>
              <Cta
                href="/interventions/collectives"
                variant="outline"
                size="lg"
                track={`collectives-${duration.slug}-empty-back`}
              >
                {isFr ? "Voir les autres durées" : "See other durations"}
              </Cta>
            </div>
          </div>
        </Section>
      ) : (
        // -----------------------------------------------------------------
        // Variante NORMALE — liste des formats matching la cellule.
        // -----------------------------------------------------------------
        <Section
          eyebrow={isFr ? "Formations disponibles" : "Available trainings"}
          title={isFr ? `Toutes les formations` : "All trainings"}
          titleEm={isFr ? `en ${duration.shortFr}` : `in ${duration.shortEn}`}
          description={
            isFr
              ? "Cliquez sur une formation pour voir le programme détaillé, l'effectif visé et les paliers tarifaires. Le calendrier de réservation reste accessible depuis chaque page format."
              : "Click a training to see the detailed programme, target headcount and pricing tiers. The booking calendar stays accessible from each format page."
          }
          contentClassName={TIGHT_X}
        >
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-7">
            {formats.map((entry) => (
              <InterventionFormatCard key={entry.slug} entry={entry} locale={locale} />
            ))}
          </div>
        </Section>
      )}

      {/* COUVERTURE NATIONALE (pSEO villes/régions) — Sprint perfection 2026-05-28 */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr={`Les formations IA équipe ${duration.shortFr}`}
        serviceLabelEn={`AI team trainings ${duration.shortEn}`}
        serviceSlug="interventions"
        tone="paper"
      />

      {/* FAQ GÉOLOCALISÉE — émet FAQPage Speakable JSON-LD */}
      <LocalGeoFaqSection isFr={isFr} service="interventions" tone="sand" />

      {/* FAQ spécifique au palier durée (4-5 Q/R) — FAQPage Speakable
          JSON-LD injecté automatiquement par FaqAccordion. Q/R différentes
          entre les 4 paliers pour éviter le duplicate content SEO. */}
      <Section
        eyebrow={isFr ? "Questions fréquentes" : "Frequent questions"}
        title={isFr ? `Formation ${duration.shortFr}` : `${duration.shortEn} training`}
        titleEm={isFr ? "ce qu'on vous demande souvent" : "what we often get asked"}
      >
        <Container>
          <FaqAccordion className="mx-auto max-w-3xl" items={faqItems} />
        </Container>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Une question ?" : "A question?"}
        title={isFr ? "Parler à quelqu'un avant de réserver" : "Talk to someone before booking"}
        description={
          isFr
            ? "Un appel où l'on prend le temps de tout cadrer à la perfection — pour valider que ce format colle à votre contexte. Sans engagement."
            : "A call where we take the time to scope your project perfectly — to make sure this format fits your context. No commitment."
        }
        cta={
          // Sprint cohérence CTA 2026-05-28 (Will) — aligné Header primary :
          // label « Réserver un appel », destination /appel, couleur primary
          // bleu + glow. Tracking conservé pour distinguer cet appel pré-vente
          // par palier en analytics.
          <Cta
            href="/appel"
            size="lg"
            className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
            track={`collectives-${duration.slug}-ctablock-consultation`}
          >
            {isFr ? "Réserver un appel" : "Book a call"} →
          </Cta>
        }
        tone="dark"
      />

      {/* CTA mobile sticky — parité avec page hub /collectives */}
      <StickyMobileCta
        href="/reserver"
        label={isFr ? "Pré-réserver une formation" : "Pre-book a training"}
        track={`collectives-${duration.slug}-sticky-mobile`}
      />

      {itemListJsonLd ? <JsonLd data={itemListJsonLd} /> : null}
      {courseJsonLd ? <JsonLd data={courseJsonLd} /> : null}
    </>
  );
}
