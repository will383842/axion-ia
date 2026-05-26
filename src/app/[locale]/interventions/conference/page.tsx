import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Mail, Users, Mic } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { InterventionFormatCard } from "@/components/sections/InterventionFormatCard";
import { getFamily, getFormatsByFamily } from "@/content/interventions-taxonomy";
import { buildProductMetadata, buildServiceJsonLd, buildItemListJsonLd, SITE_URL } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";

// ============================================================================
// Sprint 14.10.7 (Will 2026-05-12) — refactor en HUB FAMILLE Conférence.
// Pattern strictement miroir de /interventions/individuel — harmonie parfaite
// (Will). 2 formats : plénière journée + keynote événementielle 1-2 h.
// ============================================================================

interface Props {
  params: Promise<{ locale: string }>;
}

const TIGHT_X = "lg:px-6 xl:px-10";
const CONTACT_OBJECT = "conference";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  // Path locale-aware (cohérence avec les autres wrappers — slug identique
  // FR/EN ici, mais le pattern reste générique pour un futur split.)
  const PATH_FR = "/interventions/conference";
  const PATH_EN = "/interventions/conference";
  return buildProductMetadata({
    locale,
    path: loc === "fr" ? PATH_FR : PATH_EN,
    title:
      loc === "fr"
        ? "Conférences IA · plénière 1 jour ou keynote 1-2 h · Axion-IA"
        : "AI Talks · 1-day plenary or 1-2 h keynote · Axion-IA",
    description:
      loc === "fr"
        ? "2 formats Conférence : plénière 1 journée immersive (séminaires, kick-off, 30-500+ personnes) ou keynote événementielle 1-2 h (soirées, afterworks, conventions). Sur devis."
        : "2 Talk formats: 1-day immersive plenary (seminars, kick-offs, 30-500+ people) or 1-2 h event keynote (evenings, afterworks, conventions). On request.",
    alternates: { fr: PATH_FR, en: PATH_EN },
  });
}

export default async function ConferenceFamilyPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const family = getFamily("conference");
  const formats = getFormatsByFamily("conference");

  const breadcrumbItems = [
    { href: "/interventions", label: isFr ? "Interventions entreprise" : "Corporate AI sessions" },
    {
      href: "/interventions/conference",
      label: isFr ? family.labelFr : family.labelEn,
    },
  ];

  const contactHref = `/interventions/demande?objet=${encodeURIComponent(CONTACT_OBJECT)}`;

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/interventions/conference",
    name: isFr ? "Conférences IA · Axion-IA" : "AI Talks · Axion-IA",
    description: isFr ? family.taglineFr : family.taglineEn,
    serviceType: "AI talk · plenary or keynote",
    priceEur: 0,
    areasServed: buildServiceAreasServed(loc),
  });

  // ItemList JSON-LD — AEO/GEO 2026 (audit 2026-05-12 P2).
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/interventions/conference",
    name: isFr ? "Formats conférence IA" : "AI talk formats",
    items: formats.map((f, i) => ({
      position: i + 1,
      name: isFr ? f.labelFr : f.labelEn,
      url: `${SITE_URL}/${loc}${loc === "fr" ? f.pathFr : f.pathEn}`,
      description: isFr ? f.taglineFr : f.taglineEn,
    })),
  });

  // 2 mini-blocs « pour qui » — 1 par format.
  const audiences = [
    {
      icon: Users,
      titleFr: "Toute l'entreprise au même niveau",
      titleEn: "Whole company at the same level",
      bodyFr:
        "Séminaire interne, kick-off annuel, formation grande échelle. La plénière 1 journée met 30 à 500+ collaborateurs au même socle IA — démos live, ateliers groupes, Q&A complète.",
      bodyEn:
        "Internal seminar, annual kick-off, large-scale onboarding. The 1-day plenary brings 30 to 500+ employees to the same AI foundation — live demos, group workshops, full Q&A.",
    },
    {
      icon: Mic,
      titleFr: "Marquer un événement",
      titleEn: "Mark an event",
      bodyFr:
        "Soirée client, afterwork d'entreprise, séminaire externe, convention, salon. La keynote 1-2 h marque l'audience avec démos live et Q&A — format dense, accessible, événementiel.",
      bodyEn:
        "Client evening, corporate afterwork, external seminar, convention, trade show. The 1-2 h keynote marks the audience with live demos and Q&A — dense, accessible, event-ready format.",
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
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Famille · Conférence" : "Family · Talk"}
            </p>

            <h1 className="display-editorial text-fg mt-5">
              {isFr ? "Conférences IA " : "AI talks "}
              <span
                className="text-terracotta-deep mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "qui marquent l'audience" : "that mark the audience"}
              </span>
            </h1>

            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {isFr ? family.taglineFr : family.taglineEn}
            </p>

            <ul className="mt-6 flex flex-wrap gap-2">
              {(isFr
                ? ["Démos live, pas slides", "30 à 500+ personnes", "Q&A complète"]
                : ["Live demos, not slides", "30 to 500+ people", "Full Q&A"]
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
                {isFr ? "Pré-réservez une conférence" : "Pre-book a talk"}
              </Cta>
              <Cta href="/interventions" variant="outline" size="lg">
                {isFr ? "← Retour aux familles" : "← Back to families"}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* SECTION CŒUR : liste des 2 formats Conférence */}
      <Section
        eyebrow={isFr ? "2 formats disponibles" : "2 available formats"}
        title={isFr ? "Conférence" : "Talk"}
        titleEm={isFr ? "ou keynote" : "or keynote"}
        description={
          isFr
            ? "Cliquez sur un format pour voir le détail, le programme et démarrer la conversation."
            : "Click a format to see the detail, the programme, and start the conversation."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-7">
          {formats.map((entry) => (
            <InterventionFormatCard key={entry.slug} entry={entry} locale={loc} />
          ))}
        </div>
      </Section>

      {/* POUR QUI — 2 profils alignés sur les 2 formats */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Pour qui" : "Who for"}
        title={isFr ? "2 contextes" : "2 contexts"}
        titleEm={isFr ? "distincts" : "distinct"}
        description={
          isFr
            ? "Chaque format répond à un contexte précis. La plénière met une entreprise au même niveau ; la keynote marque un événement."
            : "Each format addresses a specific context. The plenary brings a company to the same level; the keynote marks an event."
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
            href="/interventions"
            className="text-fg hover:text-terracotta-deep text-sm font-medium underline underline-offset-4"
          >
            {isFr
              ? "Pas sûr·e que c'est le bon format ? Voir les 4 familles →"
              : "Not sure it's the right format? See the 4 families →"}
          </Link>
        </div>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Start"}
        title={isFr ? "Un appel où l'on prend le temps" : "A call where we take the time"}
        titleEm={isFr ? "de tout cadrer à la perfection" : "to scope your project perfectly"}
        description={
          isFr
            ? "On vous appelle, on comprend votre contexte (effectif, date, lieu, événement), on choisit plénière ou keynote, on chiffre. Devis sous 48 h. Aucun engagement avant signature."
            : "We call you, understand your context (headcount, date, venue, event), choose plenary or keynote, and quote. Quote within 48 h. No commitment before signing."
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
      <JsonLd data={itemListJsonLd} />
    </>
  );
}
