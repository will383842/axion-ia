import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Mail, User, Compass, Target, Sparkles } from "lucide-react";
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

interface Props {
  params: Promise<{ locale: string }>;
}

const TIGHT_X = "lg:px-6 xl:px-10";

// ============================================================================
// Sprint 14.10.7 (2026-05-11) — page famille « Coaching individuel ».
//
// Liste plate (pas de paliers durée). Vide en V1 — Will rajoutera les formats
// progressivement (coaching IA managers, indépendants, freelances...). Tant
// que la liste est vide, la page affiche une carte « Sur devis · cadrage par
// visio » + CTA contact.
// ============================================================================

const CONTACT_OBJECT = "coaching-individuel-ia";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  return buildProductMetadata({
    locale,
    path: "/interventions/individuel",
    title:
      loc === "fr"
        ? "Coaching IA individuel · 1-to-1 · managers, indépendants · Axion-IA"
        : "Individual AI coaching · 1-on-1 · managers, independents · Axion-IA",
    description:
      loc === "fr"
        ? "Coaching IA personnel 1-to-1 pour managers, indépendants, freelances. Format adapté à votre besoin, sur devis. Cadrage par visio, devis sous 48 h."
        : "Personal 1-on-1 AI coaching for managers, independents, freelancers. Format tailored to your need, on request. Framing by video, quote within 48 h.",
  });
}

export default async function IndividuelFamilyPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const family = getFamily("individuel");
  const formats = getFormatsByFamily("individuel");

  const breadcrumbItems = [
    { href: "/interventions", label: isFr ? "Interventions" : "Sessions" },
    {
      href: "/interventions/individuel",
      label: isFr ? family.labelFr : family.labelEn,
    },
  ];

  const contactHref = `/interventions/demande?objet=${encodeURIComponent(CONTACT_OBJECT)}`;

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/interventions/individuel",
    name: isFr
      ? "Coaching IA individuel 1-to-1 · Axion-IA"
      : "Individual 1-on-1 AI coaching · Axion-IA",
    description: isFr ? family.taglineFr : family.taglineEn,
    serviceType: "AI coaching",
    priceEur: 0,
    areasServed: buildServiceAreasServed(loc),
  });

  // 3 mini-blocs « pour qui » — toujours visibles, même quand la liste est vide.
  const audiences = [
    {
      icon: User,
      titleFr: "Managers · directeurs",
      titleEn: "Managers · directors",
      bodyFr:
        "Vous gérez une équipe et voulez gagner en maîtrise IA personnelle avant d'embarquer les autres — ou en parallèle.",
      bodyEn:
        "You manage a team and want to gain personal AI mastery before bringing others on board — or in parallel.",
    },
    {
      icon: Compass,
      titleFr: "Indépendants · freelances",
      titleEn: "Independents · freelancers",
      bodyFr:
        "Vous travaillez seul·e et l'IA pourrait doubler votre productivité — encore faut-il savoir par où commencer concrètement.",
      bodyEn:
        "You work solo and AI could double your productivity — but you need to know where to start, concretely.",
    },
    {
      icon: Target,
      titleFr: "Cadres dirigeants · N-1",
      titleEn: "Senior managers · C-1",
      bodyFr:
        "Vous êtes membre du COMEX, DSI, DRH, DAF — vous voulez monter en compétence IA personnelle avant de l'imposer à vos équipes. Coaching confidentiel sur vos vrais sujets.",
      bodyEn:
        "You sit on the executive committee — CIO, CHRO, CFO — and want personal AI upskilling before rolling it out to your teams. Confidential coaching on your real topics.",
    },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO */}
      <section className="bg-halo-cool text-fg relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <Container className={cn("relative", TIGHT_X)}>
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-primary mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Famille · Coaching individuel" : "Family · Individual coaching"}
            </p>

            <h1 className="display-editorial text-fg mt-5">
              {isFr ? "Coaching IA 1-to-1 " : "1-on-1 AI coaching "}
              <span
                className="text-primary mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "amorti en quelques jours" : "pays for itself in days"}
              </span>
            </h1>

            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {isFr ? family.taglineFr : family.taglineEn}
            </p>

            {/* Bandeau ROI 3 chips — value-prop immédiate au-dessus du fold. */}
            <ul className="mt-6 flex flex-wrap gap-2">
              {(isFr
                ? [
                    "Amorti en quelques jours",
                    "Heures gagnées chaque semaine",
                    "Format 1-to-1 sur mesure",
                  ]
                : ["Pays for itself in days", "Hours saved every week", "Bespoke 1-on-1 format"]
              ).map((chip) => (
                <li
                  key={chip}
                  className="bg-primary-soft text-primary border-primary/25 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold tracking-tight"
                >
                  <ArrowRight aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                  {chip}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Cta href={contactHref} size="lg">
                <Mail aria-hidden="true" className="h-4 w-4" />
                {isFr ? "Demander un coaching" : "Request a coaching"}
              </Cta>
              <Cta href="/interventions" variant="outline" size="lg">
                {isFr ? "← Retour aux familles" : "← Back to families"}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* SECTION CŒUR : liste si formats, sinon carte « Sur devis » */}
      {formats.length > 0 ? (
        <Section
          eyebrow={isFr ? "Formats disponibles" : "Available formats"}
          title={isFr ? "Coachings IA" : "AI coachings"}
          titleEm={isFr ? "individuels" : "1-on-1"}
          description={
            isFr
              ? "Cliquez sur un format pour voir le détail et démarrer la conversation."
              : "Click a format to see the detail and start the conversation."
          }
          contentClassName={TIGHT_X}
        >
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-7">
            {formats.map((entry) => (
              <InterventionFormatCard key={entry.slug} entry={entry} locale={loc} />
            ))}
          </div>
        </Section>
      ) : (
        <Section
          tone="paper"
          eyebrow={isFr ? "Sur mesure" : "Bespoke"}
          title={isFr ? "Un coaching" : "A coaching"}
          titleEm={isFr ? "construit avec vous" : "built with you"}
          description={
            isFr
              ? "Aucun format pré-emballé : on construit votre parcours selon votre niveau IA, votre métier et vos objectifs. Cadrage de 20 min par visio, devis sous 48 h ouvrées."
              : "No pre-packaged format: we build your journey based on your AI level, role and goals. 20-min framing by video, quote within 48 business hours."
          }
          contentClassName={TIGHT_X}
        >
          <div className="bg-paper border-border shadow-subtle mx-auto max-w-2xl rounded-3xl border p-8 sm:p-10">
            <div className="bg-primary-soft text-primary mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl">
              <Sparkles aria-hidden="true" className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <h2 className="text-fg text-2xl leading-tight font-semibold">
              {isFr
                ? "Décrivez votre besoin · on revient sous 48 h"
                : "Describe your need · we get back within 48 h"}
            </h2>
            <p className="text-fg-soft mt-3 text-base leading-relaxed">
              {isFr
                ? "Le formulaire est pré-rempli avec l'objet « coaching individuel IA ». Précisez votre métier, votre niveau IA actuel et ce que vous voulez atteindre."
                : "The form is pre-filled with the subject « individual AI coaching ». State your role, current AI level, and what you want to achieve."}
            </p>
            <ul className="mt-6 space-y-2.5 text-[14.5px]">
              {(isFr
                ? [
                    "Visio de cadrage 20 min pour comprendre votre contexte",
                    "Parcours personnalisé construit ensemble — séances, durée, format",
                    "Devis détaillé sous 48 h ouvrées · facturation après chaque séance",
                  ]
                : [
                    "20-min framing video call to understand your context",
                    "Personalised journey built together — sessions, duration, format",
                    "Detailed quote within 48 business hours · invoiced after each session",
                  ]
              ).map((line, i) => (
                <li key={i} className="text-fg flex items-start gap-3">
                  <span className="bg-primary-soft text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                    <ArrowRight aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <Cta href={contactHref} size="lg">
                <Mail aria-hidden="true" className="h-4 w-4" />
                {isFr ? "Ouvrir le formulaire de coaching" : "Open the coaching form"}
              </Cta>
            </div>
          </div>
        </Section>
      )}

      {/* POUR QUI — 3 profils visibles en permanence */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Pour qui" : "Who for"}
        title={isFr ? "3 profils" : "3 profiles"}
        titleEm={isFr ? "qui en bénéficient" : "that benefit from it"}
        description={
          isFr
            ? "Le coaching individuel 1-to-1 répond à des configurations où la formation collective ou la journée dirigeants ne sont pas le bon outil."
            : "1-on-1 coaching addresses configurations where collective training or executive day aren't the right tool."
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
                <div className="bg-primary-soft text-primary mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl">
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
        title={isFr ? "Réservez votre cadrage 20 minutes" : "Book your 20-minute framing call"}
        description={
          isFr
            ? "On vous appelle, on comprend votre besoin, on construit un parcours, on chiffre. Aucun engagement avant la signature du devis."
            : "We call you, understand your need, build a journey, and quote. No commitment before signing the quote."
        }
        cta={
          <Cta href={contactHref} size="lg">
            {isFr ? "Demander un coaching" : "Request a coaching"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
    </>
  );
}
