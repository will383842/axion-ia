// Sprint 14.10.7 — hub famille « Formations équipe » avec 4 paliers durée.
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Users, Sparkles } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  COLLECTIVE_DURATIONS,
  countFormatsByCell,
  durationPath,
  quoteContactPath,
  getFamily,
} from "@/content/interventions-taxonomy";
import { INTERVENTION_TIERS, formatAmount, getEntryPriceEur, getTierById } from "@/content/pricing";
import { buildProductMetadata, buildServiceJsonLd, buildItemListJsonLd, SITE_URL } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";
// Sprint uniformisation 2026-05-24 (Will) — alignement template /implementation.
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";

interface Props {
  params: Promise<{ locale: string }>;
}

const TIGHT_X = "lg:px-6 xl:px-10";

// ============================================================================
// Sprint 14.10.7 (2026-05-11) — page famille « Formations équipe ».
//
// 4 paliers durée : 4 h / 1 jour / 2 jours / 3 jours et plus (devis).
// Compteur dynamique par palier dérivé de `INTERVENTION_FORMATS`. Quand Will
// ajoute une formation dans la taxonomie, le palier correspondant incrémente.
// ============================================================================

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const essentielle = getTierById(INTERVENTION_TIERS, "intervention-essentielle");
  const essentiellePrice = formatAmount(essentielle.priceFlat!, loc);
  return buildProductMetadata({
    locale,
    path: "/interventions/collectives",
    title:
      loc === "fr"
        ? "Formation IA pour équipes PME · 4 formats · sur site · Axion-IA"
        : "AI team training for SMEs · 4 formats · on site · Axion-IA",
    description:
      loc === "fr"
        ? `Formations IA opérationnelles pour vos équipes sur site, organisées en 4 paliers durée : 4 heures, 1 jour (dès ${essentiellePrice}), 2 jours, 3 jours et plus (sur devis). 2 à 30+ personnes.`
        : `Operational AI trainings for your teams on site, organised in 4 duration tiers: 4 hours, 1 day (from ${essentiellePrice}), 2 days, 3 days+ (on request). 2 to 30+ people.`,
  });
}

export default async function CollectivesFamilyHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const family = getFamily("collectives");

  // P1-13 audit E2E NAV+CTA 2026-05-15 — label parent aligné sur SSOT
  // `nav.interventions` (« Interventions entreprise » / « Corporate AI sessions »).
  const breadcrumbItems = [
    {
      href: "/interventions",
      label: isFr ? "Interventions entreprise" : "Corporate AI sessions",
    },
    {
      href: "/interventions/collectives",
      label: isFr ? family.labelFr : family.labelEn,
    },
  ];

  const essentielleEntry = formatAmount(
    getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!,
    loc,
  );

  // Features par palier durée — Sprint 14.10.7 (Will 2026-05-11) : enrichir
  // les cards pour qu'elles soient parlantes (3 points de positionnement par
  // palier). Évite le rendu trop simpliste « badge + compteur ».
  const FEATURES_BY_DURATION: Record<
    (typeof COLLECTIVE_DURATIONS)[number]["id"],
    { fr: ReadonlyArray<string>; en: ReadonlyArray<string> }
  > = {
    "4h": {
      fr: ["Demi-journée express", "Découverte ciblée", "Quick-wins immédiats"],
      en: ["Express half-day", "Targeted discovery", "Immediate quick-wins"],
    },
    "1-jour": {
      fr: ["Cadrage du matin", "Ateliers pratiques", "Plan d'action le soir"],
      en: ["Morning framing", "Hands-on workshops", "Action plan by evening"],
    },
    "2-jours": {
      fr: ["Approfondissement", "Cas réels de l'équipe", "Transfert IA-fluence"],
      en: ["Deep dive", "Real team cases", "AI-fluency transfer"],
    },
    "3-jours-plus": {
      fr: ["Séminaires dirigeants", "Off-sites équipe", "Programmes multi-sites"],
      en: ["Executive seminars", "Team off-sites", "Multi-site programmes"],
    },
  };

  // Détail de chaque palier durée pour affichage en grid.
  const durationRows = COLLECTIVE_DURATIONS.map((d) => {
    const count = countFormatsByCell("collectives", d.id);
    const href = d.isQuoteOnly ? quoteContactPath(d, loc) : durationPath(d, loc);
    let metaFr: string;
    let metaEn: string;
    if (d.isQuoteOnly) {
      metaFr = "Sur devis — cadrage personnalisé";
      metaEn = "On request — bespoke framing";
    } else if (count === 0) {
      metaFr = "Formations en préparation";
      metaEn = "Trainings coming soon";
    } else if (count === 1) {
      metaFr = "1 formation disponible";
      metaEn = "1 training available";
    } else {
      metaFr = `${count} formations disponibles`;
      metaEn = `${count} trainings available`;
    }
    return {
      duration: d,
      href,
      count,
      metaFr,
      metaEn,
      features: FEATURES_BY_DURATION[d.id],
    };
  });

  // Service JSON-LD
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/interventions/collectives",
    name: isFr
      ? "Formations IA équipe · 4 durées · Axion-IA"
      : "Team AI trainings · 4 durations · Axion-IA",
    description: isFr
      ? `Formations IA opérationnelles pour vos équipes sur site, 4 paliers durée de 4 h à 3 j+, dès ${essentielleEntry}.`
      : `Operational AI trainings for your teams on site, 4 duration tiers from 4 h to 3 d+, from ${essentielleEntry}.`,
    serviceType: "AI training",
    priceEur: getEntryPriceEur(INTERVENTION_TIERS) ?? 0,
    areasServed: buildServiceAreasServed(loc),
  });

  // ItemList JSON-LD — 4 paliers durée. Factory centralisée seo.ts
  // (audit perfection 2026-05-12).
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: loc === "fr" ? "/interventions/collectives" : "/interventions/team-trainings",
    name: isFr ? "Paliers durée — Formations équipe" : "Duration tiers — Team trainings",
    items: durationRows.map((row, idx) => ({
      position: idx + 1,
      name: isFr ? row.duration.labelFr : row.duration.labelEn,
      url: `${SITE_URL}/${locale}${row.href}`,
      description: isFr ? row.duration.durationDetailFr : row.duration.durationDetailEn,
    })),
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO */}
      <section className="bg-halo-warm text-fg relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <Container className={cn("relative", TIGHT_X)}>
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Famille · Formations équipe" : "Family · Team trainings"}
            </p>

            <h1 className="display-editorial text-fg mt-5">
              {isFr ? "Vos équipes plus performantes " : "Your teams more efficient "}
              <span
                className="text-terracotta mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "en une demi-journée à 3 jours" : "in a half-day to 3 days"}
              </span>
            </h1>

            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {isFr
                ? "Vos équipes apprennent l'IA sur leurs vrais outils, leurs vrais cas. Elles ressortent avec des automatisations qui tournent dès le lendemain, des heures gagnées chaque semaine, et une autonomie nouvelle. Choisissez la durée selon vos objectifs — 4 h pour démarrer, 1 ou 2 jours pour structurer, plusieurs jours pour transformer."
                : "Your teams learn AI on their real tools, their real cases. They leave with automations running from day one, hours saved every week, and new autonomy. Pick the duration that matches your goals — 4 h to kick off, 1 or 2 days to structure, several days to transform."}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Cta
                href="/reserver"
                size="lg"
                className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-[0_8px_24px_-8px_rgba(205,107,72,0.6)]"
              >
                {isFr ? "Pré-réservez sur le calendrier" : "Pre-book on the calendar"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
              <Cta href="/interventions" variant="outline" size="lg">
                {isFr ? "← Retour aux familles" : "← Back to families"}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* 4 CARDS PALIER DURÉE */}
      <Section
        eyebrow={isFr ? "Quel objectif pour votre équipe ?" : "What's the goal for your team?"}
        title={isFr ? "4 niveaux d'impact" : "4 levels of impact"}
        titleEm={isFr ? "selon vos ambitions" : "to match your ambition"}
        description={
          isFr
            ? "Du démarrage express à la transformation complète. Chaque format livre un bénéfice concret pour vos équipes — automatisations testées, méthodes installées, gains chiffrés."
            : "From express kickoff to complete transformation. Each format delivers a concrete benefit for your teams — tested automations, installed methods, quantified gains."
        }
        contentClassName={TIGHT_X}
      >
        {/* Sprint 14.10.7 (Will 2026-05-11) — cards portrait, plus hautes
            que larges sur desktop. Badge palier XXL agrandi, padding y
            étendu, min-h pour forcer une silhouette rectangle vertical
            cohérente entre les 4 cards même quand le contenu varie.
            Grid mobile-first : 1 col → 4 sur 1 ligne dès sm (640px).
            Will (2026-05-11) : forcer 4 cards sur 1 ligne même sur écrans
            moyens où la sidebar VSCode/DevTools réduit la zone utile. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:gap-3 md:gap-4 lg:gap-6">
          {durationRows.map(({ duration: d, href, count, metaFr, metaEn, features }) => {
            const isQuote = d.isQuoteOnly === true;
            const isEmpty = !isQuote && count === 0;
            const featureLabels = isFr ? features.fr : features.en;
            const ctaLabelFr = isQuote
              ? "Demander un devis"
              : isEmpty
                ? "Nous contacter"
                : "Voir les formations";
            const ctaLabelEn = isQuote
              ? "Request a quote"
              : isEmpty
                ? "Contact us"
                : "See trainings";
            return (
              <article
                key={d.id}
                className={cn(
                  "group/duration shadow-subtle relative flex h-full flex-col overflow-hidden rounded-3xl border-2 transition-all duration-200 sm:min-h-[460px] md:min-h-[520px] lg:min-h-[560px]",
                  isQuote
                    ? "bg-sand border-terracotta-deep/40 hover:border-terracotta-deep hover:-translate-y-1 hover:shadow-[0_16px_40px_-12px_rgba(180,80,40,0.30)]"
                    : "bg-paper border-terracotta/30 hover:border-terracotta hover:-translate-y-1 hover:shadow-[0_16px_40px_-12px_rgba(205,107,72,0.30)]",
                )}
              >
                <Link
                  href={href as never}
                  aria-label={`${isFr ? d.labelFr : d.labelEn} — ${isFr ? ctaLabelFr : ctaLabelEn}`}
                  className="focus-visible:ring-terracotta absolute inset-0 z-[1] rounded-3xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span className="sr-only">{isFr ? ctaLabelFr : ctaLabelEn}</span>
                </Link>

                {/* Filet couleur en haut */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-2 w-full",
                    isQuote ? "bg-terracotta-deep" : "bg-terracotta",
                  )}
                />

                {/* Badge palier XXL — accroche visuelle dominante.
                    Padding réduit sur sm (4 cards serrées) pour économiser
                    la verticale, étendu sur md+ pour silhouette portrait. */}
                <div
                  className={cn(
                    "relative flex items-center justify-center py-8 sm:py-9 md:py-14",
                    isQuote ? "bg-terracotta-soft/65" : "bg-terracotta-soft/45",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "font-display text-[clamp(3.75rem,8vw,6rem)] leading-none font-bold tracking-tight tabular-nums transition-transform duration-200 group-hover/duration:scale-110",
                      isQuote ? "text-terracotta-deep" : "text-terracotta-deep",
                    )}
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {d.shortFr}
                  </span>
                </div>

                {/* Contenu textuel — enrichi de 3 features pour donner de
                    la consistance au-delà du simple badge + compteur. */}
                <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <h2 className="text-fg text-lg leading-tight font-semibold sm:text-xl">
                    {isFr ? d.labelFr : d.labelEn}
                  </h2>
                  <p className="text-fg-soft mt-2 text-[13.5px] leading-relaxed">
                    {isFr ? d.durationDetailFr : d.durationDetailEn}
                  </p>

                  {/* 3 features visuelles — point coloré + texte court.
                      Donnent une idée concrète de « ce qu'on y fait ». */}
                  <ul className="mt-5 space-y-2">
                    {featureLabels.map((feat, i) => (
                      <li
                        key={i}
                        className="text-fg flex items-start gap-2.5 text-[13px] leading-snug"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                            isQuote ? "bg-terracotta-deep" : "bg-terracotta",
                          )}
                        />
                        <span className="font-medium">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Métadonnée compteur — pill séparée, ressort comme indicateur de stock */}
                  <div
                    className={cn(
                      "mt-5 inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[12px] font-semibold",
                      isQuote
                        ? "bg-terracotta-soft text-terracotta-deep"
                        : isEmpty
                          ? "bg-paper border-border text-fg-muted border"
                          : "bg-terracotta-soft text-terracotta-deep",
                    )}
                  >
                    {isQuote ? (
                      <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : (
                      <Users aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
                    <span>{isFr ? metaFr : metaEn}</span>
                  </div>

                  {/* Bouton CTA plein large — fait clairement "BLOC CLIQUABLE" */}
                  <div className="relative z-[2] mt-auto pt-6">
                    <Link
                      href={href as never}
                      className={cn(
                        "inline-flex w-full items-center justify-between gap-2 rounded-2xl px-5 py-3.5 text-[14px] font-semibold transition-colors",
                        isQuote
                          ? "bg-terracotta-deep text-mocha-fg hover:bg-terracotta-deep/85"
                          : "bg-terracotta text-mocha-fg hover:bg-terracotta-deep",
                      )}
                    >
                      <span>{isFr ? ctaLabelFr : ctaLabelEn}</span>
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 transition-transform duration-200 group-hover/duration:translate-x-1"
                      />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* MÉTHODOLOGIE — 4 étapes (Sprint uniformisation 2026-05-24) */}
      <Section
        eyebrow={isFr ? "Méthodologie" : "Methodology"}
        title={isFr ? "De la commande" : "From order"}
        titleEm={isFr ? "au transfert" : "to transfer"}
        titleTail={isFr ? " de compétence." : "."}
      >
        <Container>
          <ProcessSteps
            orientation="horizontal"
            steps={[
              {
                id: "step-1-cadrage",
                title: isFr ? "Cadrage 30 min" : "30-min scoping",
                description: isFr
                  ? "Appel découverte gratuit : effectif, niveau IA, métier, objectifs. On recommande le palier durée adapté (4 h, 1 j, 2 j ou 3 j+)."
                  : "Free discovery call: headcount, AI level, role, objectives. We recommend the right duration tier (4 h, 1 d, 2 d or 3 d+).",
              },
              {
                id: "step-2-preparation",
                title: isFr ? "Préparation sur mesure" : "Tailored preparation",
                description: isFr
                  ? "Le formateur prépare des démos sur VOS vrais documents et VOS vrais cas — pas de scénarios génériques. Programme calibré sur les profils présents."
                  : "The trainer prepares demos on YOUR real documents and YOUR real cases — no generic scenarios. Programme calibrated to the profiles present.",
              },
              {
                id: "step-3-intervention",
                title: isFr ? "Intervention sur site" : "On-site session",
                description: isFr
                  ? "Démos live sur vos données, outils installés sur les postes, exercices appliqués métier. Chaque participant repart avec 3-5 automatisations opérationnelles."
                  : "Live demos on your data, tools installed on workstations, role-applied exercises. Each participant leaves with 3-5 operational automations.",
              },
              {
                id: "step-4-suivi",
                title: isFr ? "Suivi 30 j inclus" : "30-day follow-up included",
                description: isFr
                  ? "Support 30 j pour répondre aux questions post-formation. Option : maintenance standard 290 €/mois ou journée 1-to-1 dirigeant pour approfondir."
                  : "30-day support for post-training questions. Option: standard maintenance €290/month or 1-to-1 executive day for deeper work.",
              },
            ]}
          />
        </Container>
      </Section>

      {/* COUVERTURE NATIONALE (pSEO villes/régions) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="Les formations IA équipe"
        serviceLabelEn="AI team trainings"
        serviceSlug="interventions"
        tone="paper"
      />

      {/* FAQ GÉOLOCALISÉE */}
      <LocalGeoFaqSection isFr={isFr} service="interventions" tone="sand" />

      {/* FAQ générique formations équipe (5 questions essentielles) */}
      <Section
        eyebrow={isFr ? "Questions fréquentes" : "Frequent questions"}
        title={isFr ? "Avant de réserver" : "Before booking"}
        titleEm={isFr ? "votre formation" : "your training"}
      >
        <Container>
          <FaqAccordion
            className="mx-auto max-w-3xl"
            items={
              isFr
                ? [
                    {
                      id: "effectif",
                      question: "Combien de participants par session ?",
                      answer:
                        "Selon le palier : Essentielle (1 jour) accueille 2-30 personnes en 3 tranches tarifaires (2-8, 9-15, 16-30). Approfondie (2 jours) idem. Format 4 h : 2-20 personnes prix fixe. Au-delà de 30 personnes, on bascule sur Conférence (sur devis).",
                    },
                    {
                      id: "duree",
                      question: "Quelle durée choisir ?",
                      answer:
                        "4 h pour découvrir l'IA ou cadrer 1 cas d'usage. 1 jour Essentielle pour le format de découverte opérationnelle. 1 jour Gagner du temps pour des automatisations métier ciblées. 2 jours Approfondie pour aller en profondeur. 3 jours+ pour multi-sites ou contenus ultra-spécifiques.",
                    },
                    {
                      id: "frais-deplacement",
                      question: "Frais de déplacement inclus ?",
                      answer:
                        "Non. Logement, repas et forfait trajet sont facturés en sus, calculés au cas par cas selon distance/durée. Devis transparent fourni avant signature.",
                    },
                    {
                      id: "outils",
                      question: "Quels outils IA utilisés ?",
                      answer:
                        "Ceux que votre équipe utilise déjà ou qui correspondent aux métiers : ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, NotebookLM + automatisations métier (Make, Zapier) si pertinent. Pas de techno imposée.",
                    },
                    {
                      id: "remboursement",
                      question: "Garantie de résultat ?",
                      answer:
                        "Si l'équipe n'a rien tiré de la formation (cas extrêmement rare), on rembourse intégralement. Concrètement, 100 % de nos clients ressortent avec 3-5 automatisations applicables dès le lendemain.",
                    },
                  ]
                : [
                    {
                      id: "headcount",
                      question: "How many participants per session?",
                      answer:
                        "Depending on the tier: Essential (1 day) hosts 2-30 people in 3 price brackets (2-8, 9-15, 16-30). Deep dive (2 days) same. 4 h format: 2-20 people flat price. Beyond 30, we switch to Conference (on quote).",
                    },
                    {
                      id: "duration",
                      question: "Which duration to choose?",
                      answer:
                        "4 h to discover AI or frame 1 use case. 1 day Essential for operational discovery. 1 day Save Time for targeted business automations. 2 days Deep dive for depth. 3+ days for multi-site or ultra-specific content.",
                    },
                    {
                      id: "travel-fees",
                      question: "Travel expenses included?",
                      answer:
                        "No. Lodging, meals and travel allowance billed separately, calculated case by case based on distance/duration. Transparent quote provided before signature.",
                    },
                    {
                      id: "tools",
                      question: "Which AI tools are used?",
                      answer:
                        "The ones your team already uses or that fit the roles: ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, NotebookLM + business automations (Make, Zapier) if relevant. No imposed tech.",
                    },
                    {
                      id: "guarantee",
                      question: "Guarantee?",
                      answer:
                        "If the team got nothing from the training (extremely rare), we refund in full. Concretely, 100 % of our customers come out with 3-5 automations applicable the next day.",
                    },
                  ]
            }
          />
        </Container>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Pas sûr·e du bon palier ?" : "Not sure which tier?"}
        title={
          isFr ? "On en parle 15 minutes au téléphone" : "Let's chat for 15 minutes on the phone"
        }
        description={
          isFr
            ? "Un appel court pour comprendre votre contexte, vous orienter sur la durée la plus adaptée, et vous expliquer comment ça se passe. Sans engagement."
            : "A short call to understand your context, point you to the right duration, and explain how it works. No commitment."
        }
        cta={
          <Cta href={"/interventions/demande?objet=cadrage-formation-equipe" as never} size="lg">
            {isFr ? "Demander un appel" : "Request a call"} →
          </Cta>
        }
        tone="dark"
      />

      {/* CTA mobile sticky (Sprint uniformisation 2026-05-24) */}
      <StickyMobileCta
        href="/contact"
        label={isFr ? "Réserver une formation" : "Book a training"}
        track="interventions-collectives-sticky-mobile"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={itemListJsonLd} />
    </>
  );
}
