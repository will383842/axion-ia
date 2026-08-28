import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Mail, Compass, Sparkles } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { JsonLd } from "@/components/marketing/JsonLd";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { InterventionFormatCard } from "@/components/sections/InterventionFormatCard";
import { getFamily, getFormatsByFamily } from "@/content/interventions-taxonomy";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildItemListJsonLd,
  buildWebPageJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  SITE_URL,
} from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";

// ============================================================================
// Sprint 14.10.7 (Will 2026-05-12) — refactor en HUB FAMILLE Dirigeants.
// Pattern strictement miroir de /interventions/individuel — harmonie parfaite
// (Will). Chaque format Dirigeants (productivité / vision stratégique / Claude)
// pointe vers sa page détail dédiée.
// ============================================================================

interface Props {
  params: Promise<{ locale: string }>;
}

const TIGHT_X = "lg:px-6 xl:px-10";
const CONTACT_OBJECT = "dirigeants";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  return buildProductMetadata({
    locale,
    path: loc === "fr" ? "/interventions/dirigeants" : "/interventions/executives",
    title:
      loc === "fr"
        ? "Interventions dirigeants · 1-to-1 stratégique · Axion-IA"
        : "Executive sessions · strategic 1-on-1 · Axion-IA",
    description:
      loc === "fr"
        ? "Une journée 1-to-1 dédiée au dirigeant : Vision IA stratégique — panorama de votre secteur, leviers hiérarchisés, note de cadrage sous 7 jours. Pour un seul dirigeant, pas un comité."
        : "A 1-on-1 day dedicated to the executive: strategic AI vision — sector landscape, prioritised levers, framing note within 7 days. For one executive, not a committee.",
    alternates: { fr: "/interventions/dirigeants", en: "/interventions/executives" },
  });
}

export default async function DirigeantsFamilyPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const family = getFamily("dirigeants");
  const formats = getFormatsByFamily("dirigeants");

  const breadcrumbItems = [
    { href: "/un-a-un", label: isFr ? "Accompagnement 1-to-1" : "1-to-1 coaching" },
    {
      href: "/interventions/dirigeants",
      label: isFr ? family.labelFr : family.labelEn,
    },
  ];

  const contactHref = `/interventions/demande?objet=${encodeURIComponent(CONTACT_OBJECT)}`;

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: loc === "fr" ? "/interventions/dirigeants" : "/interventions/executives",
    name: isFr
      ? "Interventions dirigeants 1-to-1 · Axion-IA"
      : "Executive 1-on-1 sessions · Axion-IA",
    description: isFr ? family.taglineFr : family.taglineEn,
    serviceType: "AI strategy · executives",
    priceEur: 0,
    areasServed: buildServiceAreasServed(loc),
  });

  // ItemList JSON-LD — AEO/GEO 2026 : permet aux LLMs d'énumérer la liste
  // du format Dirigeants quand quelqu'un demande « formations IA pour
  // dirigeant Axion-IA ». Audit 2026-05-12 P2.
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: loc === "fr" ? "/interventions/dirigeants" : "/interventions/executives",
    name: isFr ? "Formats interventions dirigeants" : "Executive session formats",
    items: formats.map((f, i) => ({
      position: i + 1,
      name: isFr ? f.labelFr : f.labelEn,
      url: `${SITE_URL}/${loc}${loc === "fr" ? f.pathFr : f.pathEn}`,
      description: isFr ? f.taglineFr : f.taglineEn,
    })),
  });

  // ImageObject @graph — Sprint AEO Phase 5 2026-05-28 (Will). Portrait
  // fondateur (asset principal de la page hub Dirigeants 1-to-1) + photo
  // équipe pour exposition Google Images + AI Overviews sur requêtes
  // « formation dirigeant IA », « 1-to-1 dirigeant Claude productivité ».
  const imagesJsonLd = buildPageImageGraphJsonLd({
    locale: loc,
    path: "/interventions/dirigeants",
  });
  // Nœud WebPage — porteur VALIDE du `speakable` (h1/h2 + réponses) + `primaryImageOfPage`.
  const webPageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: loc === "fr" ? "/interventions/dirigeants" : "/interventions/executives",
    name: isFr
      ? "Accompagnement 1-to-1 des dirigeants · Axion-IA"
      : "1-on-1 executive AI support · Axion-IA",
    description: isFr ? family.taglineFr : family.taglineEn,
    speakable: true,
    ...(buildPrimaryImageOfPage("/interventions/dirigeants")
      ? { extra: { primaryImageOfPage: buildPrimaryImageOfPage("/interventions/dirigeants") } }
      : {}),
  });

  // 2 mini-blocs « pour qui » — deux angles du MÊME format (Vision IA stratégique).
  const audiences = [
    {
      icon: Compass,
      titleFr: "Dirigeant qui veut anticiper l'IA",
      titleEn: "Executive who wants to anticipate AI",
      bodyFr:
        "Votre secteur bouge, vos concurrents bougent. La journée Vision stratégique vous ouvre les yeux sur les opportunités IA dans VOTRE marché — pas un audit, un déclic.",
      bodyEn:
        "Your sector is moving, your competitors are moving. The Strategic Vision day opens your eyes to AI opportunities in YOUR market — not an audit, a shift.",
    },
    {
      icon: Sparkles,
      titleFr: "Dirigeant qui doit trancher",
      titleEn: "Executive who has to decide",
      bodyFr:
        "Trop de promesses, pas assez de repères. La journée hiérarchise 5 à 10 leviers concrets pour votre entreprise — impact, difficulté, urgence — et vous repartez avec des priorités claires, consignées dans la note de cadrage.",
      bodyEn:
        "Too many promises, not enough bearings. The day ranks 5 to 10 concrete levers for your company — impact, difficulty, urgency — and you leave with clear priorities, set out in the framing note.",
    },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO */}
      <section className="bg-halo-warm relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <Container className={cn("relative", TIGHT_X)}>
          {/* Eyebrow → pastille centrée sur la page, au-dessus du contenu. */}
          <HeroBadge className="mb-8 sm:mb-10">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            {isFr ? "Famille · Dirigeants" : "Family · Executives"}
          </HeroBadge>
          <div className="max-w-3xl">
            <h1 className="display-editorial text-fg">
              {isFr ? "Journée 1-to-1 dirigeant " : "1-on-1 executive day "}
              <span
                className="text-terracotta-deep mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "pour y voir clair sur l'IA" : "to see AI clearly"}
              </span>
            </h1>

            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {isFr ? family.taglineFr : family.taglineEn}
            </p>

            {/* Bandeau ROI 3 chips — value-prop immédiate au-dessus du fold. */}
            <ul className="mt-6 flex flex-wrap gap-2">
              {(isFr
                ? ["1-to-1 strict (vous seul·e)", "Confidentialité totale", "Rapport sous 7 jours"]
                : ["Strict 1-on-1 (just you)", "Total confidentiality", "Report within 7 days"]
              ).map((chip) => (
                <li
                  key={chip}
                  className="bg-terracotta-soft text-terracotta-deep border-terracotta/30 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold tracking-tight"
                >
                  <ArrowRight aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                  {chip}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Cta
                href={contactHref}
                size="lg"
                className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
              >
                <Mail aria-hidden="true" className="h-4 w-4" />
                {isFr ? "Demander une journée" : "Request a day"}
              </Cta>
              <Cta href="/un-a-un" variant="outline" size="lg">
                {isFr ? "← Retour au 1-to-1" : "← Back to 1-to-1"}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* SECTION CŒUR : le format Dirigeants (Vision IA stratégique) */}
      <Section
        eyebrow={isFr ? "Le format dirigeant" : "The executive format"}
        title={isFr ? "Journée" : "Day"}
        titleEm={isFr ? "1-to-1 dirigeant" : "1-on-1 executive"}
        description={
          isFr
            ? "Cliquez pour voir le détail, le déroulé de la journée et démarrer la conversation."
            : "Click to see the detail, the flow of the day, and start the conversation."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:gap-7">
          {formats.map((entry) => (
            <InterventionFormatCard key={entry.slug} entry={entry} locale={loc} />
          ))}
        </div>
      </Section>

      {/* POUR QUI — 2 profils visibles en permanence (1 par format) */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Pour qui" : "Who for"}
        title={isFr ? "2 profils" : "2 profiles"}
        titleEm={isFr ? "dirigeant ciblés" : "of executives targeted"}
        description={
          isFr
            ? "Chaque format répond à un objectif dirigeant distinct. Un appel où l'on prend le temps de tout cadrer à la perfection permet de choisir le bon."
            : "Each format addresses a distinct executive goal. A call where we take the time to scope your project perfectly helps choose the right one."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          {audiences.map((a, idx) => {
            const Icon = a.icon;
            return (
              <article
                key={idx}
                className="bg-paper border-border shadow-subtle rounded-2xl border p-6"
              >
                <div className="bg-terracotta-soft text-terracotta-deep mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl">
                  <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h3 className="text-fg text-lg leading-snug font-semibold">
                  {isFr ? a.titleFr : a.titleEn}
                </h3>
                <p className="text-fg-soft mt-3 text-[14.5px] leading-relaxed">
                  {isFr ? a.bodyFr : a.bodyEn}
                </p>
              </article>
            );
          })}
        </div>
        <div className="mt-8 flex justify-center">
          <Link
            href="/un-a-un"
            className="text-fg hover:text-terracotta-deep text-sm font-medium underline underline-offset-4"
          >
            {isFr
              ? "Pas sûr·e que c'est le bon format ? Voir le hub 1-to-1 →"
              : "Not sure it's the right format? See the 1-to-1 hub →"}
          </Link>
        </div>
      </Section>

      {/* FAQ — FaqAccordion émet le FAQPage JSON-LD (AEO). */}
      <Section
        eyebrow={isFr ? "Questions fréquentes" : "Frequent questions"}
        title={isFr ? "Avant de" : "Before"}
        titleEm={isFr ? "réserver" : "booking"}
      >
        <Container>
          <FaqAccordion
            className="mx-auto max-w-3xl"
            items={
              isFr
                ? [
                    {
                      id: "pourquoi-1to1",
                      question: "Pourquoi un format 1-to-1 plutôt qu'une formation collective ?",
                      answer:
                        "Parce que votre temps et vos décisions de dirigeant sont spécifiques. Le 1-to-1 se concentre sur VOUS : votre quotidien, vos dossiers, votre vision — pas sur un programme d'équipe standardisé.",
                    },
                    {
                      id: "confidentiel",
                      question: "C'est vraiment confidentiel ?",
                      answer:
                        "Oui, strictement. Vous êtes seul·e avec votre interlocuteur, sur vos vrais dossiers, y compris stratégiques. Aucune donnée n'est partagée ni réutilisée.",
                    },
                    {
                      id: "choisir",
                      question: "Dirigeant ou collaborateur : quelle formule choisir ?",
                      answer:
                        "La journée dirigeant est stratégique : elle porte sur votre marché, vos priorités et vos décisions. Le coaching collaborateur est pratique : une journée au poste de la personne, sur ses vrais dossiers. Un échange préalable de 45 minutes permet de trancher.",
                    },
                    {
                      id: "repars",
                      question: "Qu'est-ce que je repars avec ?",
                      answer:
                        "Une vision claire dès le soir même, puis, sous 7 jours, la note de cadrage stratégique : le panorama IA de votre secteur, sourcé, et vos 5 à 10 leviers hiérarchisés par impact et urgence.",
                    },
                  ]
                : [
                    {
                      id: "pourquoi-1to1",
                      question: "Why a 1-to-1 format rather than collective training?",
                      answer:
                        "Because your time and decisions as an executive are specific. 1-to-1 focuses on YOU: your daily work, your files, your vision — not a standardised team programme.",
                    },
                    {
                      id: "confidentiel",
                      question: "Is it really confidential?",
                      answer:
                        "Yes, strictly. You are alone with your contact, on your real files, including strategic ones. No data is shared or reused.",
                    },
                    {
                      id: "choisir",
                      question: "How to choose between the 2 executive formats?",
                      answer:
                        "Strategic Vision to spot AI opportunities in your market, Claude to master the most advanced AI on your files. A framing call helps decide.",
                    },
                    {
                      id: "repars",
                      question: "What do I walk away with?",
                      answer:
                        "Concrete methods activated on the day itself, then a report within a few days that prioritises the next steps and their expected gains.",
                    },
                  ]
            }
          />
        </Container>
      </Section>

      {/* COUVERTURE FRANCE + KB — maillage national (parité pages détail un-à-un). */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'accompagnement dirigeant 1-to-1"
        serviceLabelEn="1-to-1 executive support"
        serviceSlug="un-a-un"
        tone="sand"
      />
      <RelatedKnowledge service="un-a-un" />

      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Start"}
        title={isFr ? "Un appel où l'on prend le temps" : "A call where we take the time"}
        titleEm={isFr ? "de tout cadrer à la perfection" : "to scope your project perfectly"}
        description={
          isFr
            ? "On vous appelle, on comprend votre contexte dirigeant, on choisit le bon format ensemble, on chiffre. Devis sous 48 h. Aucun engagement avant signature."
            : "We call you, understand your executive context, choose the right format together, and quote. Quote within 48 h. No commitment before signing."
        }
        cta={
          <Cta
            href={contactHref}
            size="lg"
            className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
          >
            <Mail aria-hidden="true" className="h-4 w-4" />
            {isFr ? "Demander un cadrage" : "Request framing"}
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={webPageJsonLd} />
      <JsonLd data={itemListJsonLd} />
      {imagesJsonLd ? <JsonLd data={imagesJsonLd} /> : null}
    </>
  );
}
