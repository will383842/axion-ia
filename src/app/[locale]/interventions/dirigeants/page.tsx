import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Mail, Crown, Compass, Sparkles } from "lucide-react";
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
import { buildProductMetadata, buildServiceJsonLd } from "@/lib/seo";
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
        ? "3 formats 1-to-1 dédiés aux dirigeants : productivité personnelle, vision IA stratégique, intervention Claude. Pour un seul dirigeant, pas un comité. Sur devis."
        : "3 1-on-1 formats dedicated to executives: personal productivity, strategic AI vision, Claude intervention. For one executive, not a committee. On request.",
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
    { href: "/interventions", label: isFr ? "Interventions" : "Sessions" },
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

  // 3 mini-blocs « pour qui » — alignés sur les 3 formats Dirigeants.
  const audiences = [
    {
      icon: Crown,
      titleFr: "Dirigeant qui veut gagner du temps",
      titleEn: "Executive who wants to save time",
      bodyFr:
        "Boîte mail, prépa réunions, reporting, comptes-rendus, suivi commercial — votre quotidien est saturé. La journée Productivité installe les bons usages IA pour libérer plusieurs heures par semaine.",
      bodyEn:
        "Inbox, meeting prep, reporting, meeting notes, sales follow-up — your daily work is saturated. The Productivity day installs the right AI methods to free up several hours per week.",
    },
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
      titleFr: "Dirigeant qui veut maîtriser Claude",
      titleEn: "Executive who wants to master Claude",
      bodyFr:
        "Vous voulez utiliser l'IA la plus avancée pour vos dossiers stratégiques confidentiels. La journée Claude vous donne la maîtrise complète : Chat, Projects, Code CLI.",
      bodyEn:
        "You want to use the most advanced AI for your confidential strategic files. The Claude day gives you full mastery: Chat, Projects, Code CLI.",
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
              {isFr ? "Famille · Dirigeants" : "Family · Executives"}
            </p>

            <h1 className="display-editorial text-fg mt-5">
              {isFr ? "Journée 1-to-1 dirigeant " : "1-on-1 executive day "}
              <span
                className="text-terracotta-deep mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "rentable dès la semaine" : "profitable from day one"}
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
                className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-[0_8px_24px_-8px_rgba(205,107,72,0.6)]"
              >
                <Mail aria-hidden="true" className="h-4 w-4" />
                {isFr ? "Pré-réservez une journée" : "Pre-book a day"}
              </Cta>
              <Cta href="/interventions" variant="outline" size="lg">
                {isFr ? "← Retour aux familles" : "← Back to families"}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* SECTION CŒUR : liste des 3 formats Dirigeants */}
      <Section
        eyebrow={isFr ? "3 formats disponibles" : "3 available formats"}
        title={isFr ? "Journées" : "Days"}
        titleEm={isFr ? "1-to-1 dirigeant" : "1-on-1 executive"}
        description={
          isFr
            ? "Cliquez sur un format pour voir le détail, le programme heure par heure et démarrer la conversation."
            : "Click a format to see the detail, the hour-by-hour programme, and start the conversation."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 lg:grid-cols-3 lg:gap-7">
          {formats.map((entry) => (
            <InterventionFormatCard key={entry.slug} entry={entry} locale={loc} />
          ))}
        </div>
      </Section>

      {/* POUR QUI — 3 profils visibles en permanence (1 par format) */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Pour qui" : "Who for"}
        title={isFr ? "3 profils" : "3 profiles"}
        titleEm={isFr ? "dirigeant ciblés" : "of executives targeted"}
        description={
          isFr
            ? "Chaque format répond à un objectif dirigeant distinct. Un appel de cadrage 15 min permet de choisir le bon."
            : "Each format addresses a distinct executive goal. A 15-min framing call helps choose the right one."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-3">
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
        title={isFr ? "Cadrage par appel 15 minutes" : "15-minute framing call"}
        description={
          isFr
            ? "On vous appelle, on comprend votre contexte dirigeant, on choisit le bon format ensemble, on chiffre. Devis sous 48 h. Aucun engagement avant signature."
            : "We call you, understand your executive context, choose the right format together, and quote. Quote within 48 h. No commitment before signing."
        }
        cta={
          <Cta
            href={contactHref}
            size="lg"
            className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-[0_8px_24px_-8px_rgba(205,107,72,0.6)]"
          >
            <Mail aria-hidden="true" className="h-4 w-4" />
            {isFr ? "Demander un cadrage" : "Request framing"}
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
    </>
  );
}
