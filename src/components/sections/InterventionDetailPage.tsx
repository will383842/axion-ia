// Composant template — pages détail format pour Dirigeants / Conférence /
// Individuel (Claude variant). Sprint 14.10.7 (Will 2026-05-12) — assure
// l'harmonie parfaite entre toutes les pages format : même structure
// (Hero → Programme → Bénéfices → FAQ → CtaBlock), même grammar visuelle,
// même CTA shape.
//
// Pattern miroir d'IndividualCoachingPage + CollectiveTrainingPage, mais
// avec la config passée en props (au lieu d'un map interne par slug). Plus
// flexible — on peut créer une nouvelle page format en ajoutant 1 entrée
// dans `INTERVENTION_DETAIL_CONFIGS` puis 1 wrapper de ~25 lignes.

import type { ReactNode } from "react";
import { ArrowRight, Mail } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { ContactBand } from "@/components/sections/ContactBand";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { UnAUnSubPageExtras } from "@/components/services/un-a-un/UnAUnSubPageExtras";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { InterventionSchedule } from "@/components/sections/intervention-parts/InterventionSchedule";
import { InterventionBenefitsGrid } from "@/components/sections/intervention-parts/InterventionBenefitsGrid";
import { InterventionCasUsageGrid } from "@/components/sections/intervention-parts/InterventionCasUsageGrid";
import { getUnAUnCasUsage } from "@/content/interventions/un-a-un-cas-usage";
import { InterventionFaqList } from "@/components/sections/intervention-parts/InterventionFaqList";
import {
  INTERVENTION_DETAIL_CONFIGS,
  type InterventionDetailSlug,
} from "@/content/intervention-detail-configs";
import { getFamily } from "@/content/interventions-taxonomy";
import { formatAmount } from "@/content/pricing";
import { buildServiceJsonLd, buildFaqJsonLd, buildHowToJsonLd } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";

interface Props {
  slug: InterventionDetailSlug;
  locale: Locale;
}

const TIGHT_X = "lg:px-6 xl:px-10";

// Will (audit /interventions 2026-05-12) — un format à prix fixe doit
// rediriger sur /appel (réservation d'un appel) plutôt que sur le formulaire
// de demande. On garde le formulaire pour les formats Sur devis (config sans
// priceFlatEur) où un cadrage commercial est indispensable.
const CALENDAR_SUPPORTED_FORMAT_SLUGS: ReadonlySet<string> = new Set([
  "essentielle",
  "approfondie",
  "conference",
  "audit-flash-onsite",
  "gagner-du-temps",
  "demarrage-ia-express",
  "intervention-claude",
]);

export function InterventionDetailPage({ slug, locale }: Props): ReactNode {
  const isFr = locale === "fr";
  const config = INTERVENTION_DETAIL_CONFIGS[slug];
  const casUsage = getUnAUnCasUsage(slug);
  const family = getFamily(config.familySlug);
  const priceFr = config.priceFlatEur ? formatAmount(config.priceFlatEur, "fr") : "Sur devis";
  const priceEn = config.priceFlatEur ? formatAmount(config.priceFlatEur, "en") : "On request";
  const isBookable =
    config.priceFlatEur != null && CALENDAR_SUPPORTED_FORMAT_SLUGS.has(config.formatSlug);
  const primaryCtaHref = isBookable
    ? "/appel"
    : `/interventions/demande?objet=${encodeURIComponent(config.contactObject)}`;
  const primaryCtaLabelFr = isBookable ? "Réserver un appel" : "Demander cette intervention";
  const primaryCtaLabelEn = isBookable ? "Book a call" : "Request this session";
  // Pour les formats sans schedule fixe (keynote événementielle), on reste
  // toujours sur le formulaire — c'est un cadrage personnalisé.
  const flexibleCtaHref = `/interventions/demande?objet=${encodeURIComponent(config.contactObject)}`;

  const breadcrumbItems = [
    { href: "/interventions", label: isFr ? "Interventions" : "Sessions" },
    {
      href: locale === "fr" ? family.pathFr : family.pathEn,
      label: isFr ? family.labelFr : family.labelEn,
    },
    {
      href: `/interventions/${slug}`,
      label: isFr ? config.titleFr : config.titleEn,
    },
  ];

  const serviceJsonLd = buildServiceJsonLd({
    locale,
    path: `/interventions/${slug}`,
    name: `${isFr ? config.titleFr : config.titleEn} · Axion-IA`,
    description: isFr ? config.promiseFr : config.promiseEn,
    serviceType: "AI training & strategy",
    priceEur: config.priceFlatEur ?? 0,
    areasServed: buildServiceAreasServed(locale),
  });

  const faqJsonLd =
    config.faq.length > 0
      ? buildFaqJsonLd({
          items: config.faq.map((f) => ({
            question: isFr ? f.qFr : f.qEn,
            answer: isFr ? f.aFr : f.aEn,
          })),
        })
      : null;

  // HowTo JSON-LD — signal AEO « comment se déroule cette journée » dérivé du
  // programme heure par heure (distinct par format → pas de duplicate). Aligne
  // les pages détail un-à-un sur le standard /implementation. Omis pour les
  // formats sans programme fixe (keynote événementielle, cadrage sur mesure).
  const howToJsonLd =
    config.schedule && config.schedule.length > 0
      ? buildHowToJsonLd({
          locale,
          path: `/interventions/${slug}`,
          name: isFr
            ? `Comment se déroule ${config.titleFr.toLowerCase()}`
            : `How ${config.titleEn.toLowerCase()} unfolds`,
          description: isFr ? config.promiseFr : config.promiseEn,
          steps: config.schedule.map((s) => ({
            name: isFr ? s.titleFr : s.titleEn,
            text: (isFr ? s.descriptionFr : s.descriptionEn) ?? (isFr ? s.titleFr : s.titleEn),
          })),
        })
      : null;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO */}
      <section className="bg-halo-warm relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <Container className={cn("relative", TIGHT_X)}>
          {/* Eyebrow → pastille centrée sur la page, au-dessus du contenu. */}
          <HeroBadge className="mb-8 sm:mb-10">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            {isFr ? family.labelFr : family.labelEn}
          </HeroBadge>
          <div className="max-w-3xl">
            <h1 className="display-editorial text-fg">
              {isFr ? config.titleFr : config.titleEn}{" "}
              <span
                className="text-terracotta-deep mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? config.titleEmFr : config.titleEmEn}
              </span>
            </h1>

            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {isFr ? config.promiseFr : config.promiseEn}
            </p>

            {/* Bandeau prix + effectif */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="bg-terracotta text-mocha-fg rounded-full px-4 py-1.5 text-base font-bold tracking-tight tabular-nums shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]">
                {isFr ? priceFr : priceEn}
              </span>
              <span className="text-fg-soft text-[13px]">
                {isFr ? config.groupSizeFr : config.groupSizeEn}
              </span>
            </div>

            {/* 3 chips bénéfice ROI */}
            <ul className="mt-5 flex flex-wrap gap-2">
              {(isFr ? config.chipsFr : config.chipsEn).map((chip) => (
                <li
                  key={chip}
                  className="bg-terracotta-soft text-terracotta-deep border-terracotta/25 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold tracking-tight"
                >
                  <ArrowRight aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                  {chip}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Cta
                href={primaryCtaHref}
                size="lg"
                className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
              >
                <Mail aria-hidden="true" className="h-4 w-4" />
                {isFr ? primaryCtaLabelFr : primaryCtaLabelEn}
              </Cta>
              <Cta
                href={(locale === "fr" ? family.pathFr : family.pathEn) as never}
                variant="outline"
                size="lg"
              >
                {isFr
                  ? `← Autres formats ${family.labelFr.toLowerCase()}`
                  : `← Other ${family.labelEn.toLowerCase()} formats`}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* PROGRAMME — JUSTE APRÈS LE HERO (Will 2026-05-12).
          Si `schedule === null` (ex. keynote événementielle), on affiche une
          section message qui explique que le programme est cadré avec le client. */}
      {config.schedule && config.schedule.length > 0 ? (
        <Section
          tone="paper"
          eyebrow={isFr ? "Programme type · 9 h – 17 h" : "Standard programme · 9 a.m. – 5 p.m."}
          title={isFr ? "Le détail" : "Detailed"}
          titleEm={isFr ? "de votre journée" : "day breakdown"}
          description={
            isFr
              ? "Programme cadré en amont par appel. La trame reste celle-ci, le contenu s'adapte à votre contexte précis."
              : "Programme framed upstream by call. The frame stays the same, content adapts to your specific context."
          }
          contentClassName={TIGHT_X}
        >
          <InterventionSchedule items={config.schedule} isFr={isFr} />
        </Section>
      ) : (
        // Cas particulier : format flexible (keynote événementielle, devis
        // sur mesure). On explique que le programme est cadré avec le client.
        <Section
          tone="paper"
          eyebrow={isFr ? "Programme flexible" : "Flexible programme"}
          title={isFr ? "Format" : "Format"}
          titleEm={isFr ? "adapté à votre événement" : "tailored to your event"}
          description={
            isFr
              ? "Pas de programme fixe : on cadre la durée, le déroulé et les démos avec vous selon votre contexte (soirée, afterwork, séminaire, salon). Réponse sous 48 h ouvrées avec proposition détaillée."
              : "No fixed programme: we frame duration, flow, and demos with you based on your context (evening, afterwork, seminar, trade show). Response within 48 business hours with detailed proposal."
          }
          contentClassName={TIGHT_X}
        >
          <Container className="max-w-2xl">
            <div className="bg-terracotta-soft/30 border-terracotta/20 rounded-2xl border p-6 text-center sm:p-8">
              <Cta
                href={flexibleCtaHref}
                size="lg"
                className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep"
              >
                <Mail aria-hidden="true" className="h-4 w-4" />
                {isFr ? "Construire le format ensemble" : "Build the format together"}
              </Cta>
            </div>
          </Container>
        </Section>
      )}

      {/* 4 BÉNÉFICES */}
      <Section
        eyebrow={isFr ? "Ce que vous obtenez" : "What you get"}
        title={isFr ? "4 bénéfices" : "4 benefits"}
        titleEm={isFr ? "concrets et chiffrés" : "concrete and quantified"}
        description={
          isFr
            ? "À l'issue de l'intervention, voici ce que vous maîtrisez."
            : "By the end of the session, here's what you master."
        }
        contentClassName={TIGHT_X}
      >
        <InterventionBenefitsGrid items={config.benefits} isFr={isFr} />
      </Section>

      {/* CAS D'USAGE ILLUSTRÉS — parité visuelle avec les fiches formation. */}
      {casUsage.length > 0 ? (
        <Section
          tone="sand"
          eyebrow={isFr ? "Objectifs & cas d'usage" : "Objectives & use cases"}
          title={isFr ? "Ce que vous saurez faire —" : "What you will be able to do —"}
          titleEm={isFr ? "cas d'usage concret" : "concrete use case"}
          description={
            isFr
              ? "Des compétences directement applicables sur vos vrais dossiers, travaillées ensemble."
              : "Skills directly applicable to your real files, worked on together."
          }
          contentClassName={TIGHT_X}
        >
          <InterventionCasUsageGrid items={casUsage} isFr={isFr} />
        </Section>
      ) : null}

      {/* BANDEAU CONTACT — orientation (parité pages-intention). */}
      <ContactBand
        isFr={isFr}
        eyebrow={isFr ? "Une question sur ce format ?" : "A question about this format?"}
        title={isFr ? "On vous oriente," : "We guide you,"}
        titleEm={isFr ? "à votre rythme" : "at your pace"}
        description={
          isFr
            ? "Un échange pour comprendre votre métier et vos objectifs, et vous dire l'accompagnement qui vous correspond. Sans engagement."
            : "A chat to understand your role and goals, and tell you which support fits you. No commitment."
        }
        track="-un-a-un-detail"
      />

      {/* FAQ */}
      <Section
        tone="sand"
        eyebrow="FAQ"
        title={isFr ? "Questions" : "Questions"}
        titleEm={isFr ? "fréquentes" : "we hear often"}
        contentClassName={TIGHT_X}
      >
        <InterventionFaqList items={config.faq} isFr={isFr} />
      </Section>

      {/* COUVERTURE FRANCE + KB — maillage national (parité pages-intention). */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'accompagnement IA individuel"
        serviceLabelEn="Individual AI coaching"
        serviceSlug="un-a-un"
        tone="sand"
      />
      <RelatedKnowledge service="un-a-un" />

      {/* Maillage interne — autres accompagnements 1-to-1 (parité /implementation). */}
      <UnAUnSubPageExtras isFr={isFr} slug={slug} />

      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Start"}
        title={isFr ? primaryCtaLabelFr : primaryCtaLabelEn}
        description={
          isFr
            ? isBookable
              ? `${priceFr} pour ${config.groupSizeFr.toLowerCase()}. Réservez directement votre date sur le calendrier. Acompte 50 % à la confirmation du créneau, solde après l'intervention.`
              : config.priceFlatEur
                ? `${priceFr} pour ${config.groupSizeFr.toLowerCase()}. Cadrage par appel où l'on prend le temps de tout cadrer à la perfection, devis et planning sous 48 h ouvrées. Aucun engagement avant signature.`
                : `Sur devis selon votre contexte. Cadrage par appel où l'on prend le temps de tout cadrer à la perfection, devis et planning sous 48 h ouvrées. Aucun engagement avant signature.`
            : isBookable
              ? `${priceEn} for ${config.groupSizeEn.toLowerCase()}. Book your date directly on the calendar. 50 % deposit on slot confirmation, balance after the session.`
              : config.priceFlatEur
                ? `${priceEn} for ${config.groupSizeEn.toLowerCase()}. Framing call where we take the time to scope your project perfectly, quote and schedule within 48 business hours. No commitment before signing.`
                : `On request based on your context. Framing call where we take the time to scope your project perfectly, quote and schedule within 48 business hours. No commitment before signing.`
        }
        cta={
          <Cta
            href={primaryCtaHref}
            size="lg"
            className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
          >
            <Mail aria-hidden="true" className="h-4 w-4" />
            {isFr ? primaryCtaLabelFr : primaryCtaLabelEn}
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
      {faqJsonLd ? <JsonLd data={faqJsonLd} /> : null}
      {howToJsonLd ? <JsonLd data={howToJsonLd} /> : null}
      {/* BreadcrumbList JSON-LD : déjà émis automatiquement par <Breadcrumbs>
          (cf. nav/Breadcrumbs.tsx:25). Ne pas redoubler ici sous peine d'erreur
          Google Rich Results « Duplicate Breadcrumb » (audit 2026-05-12). */}
    </>
  );
}
