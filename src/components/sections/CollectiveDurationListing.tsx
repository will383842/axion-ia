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
import {
  type CollectiveDuration,
  getDuration,
  getFamily,
  getFormatsByCell,
  quoteContactPath,
} from "@/content/interventions-taxonomy";
import { SITE_URL } from "@/lib/seo";

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

  const breadcrumbItems = [
    { href: "/interventions", label: isFr ? "Interventions" : "Sessions" },
    {
      href: "/interventions/collectives",
      label: isFr ? family.labelFr : family.labelEn,
    },
    {
      href: locale === "fr" ? duration.pathFr : duration.pathEn,
      label: isFr ? duration.labelFr : duration.labelEn,
    },
  ];

  // ItemList JSON-LD pour les formats (uniquement si liste non vide et non-devis).
  const itemListJsonLd =
    formats.length > 0
      ? ({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: isFr ? duration.labelFr : duration.labelEn,
          itemListElement: formats.map((f, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            item: {
              "@type": "Service",
              name: isFr ? f.labelFr : f.labelEn,
              url: `${SITE_URL}/${locale}${locale === "fr" ? f.pathFr : f.pathEn}`,
              description: isFr ? f.taglineFr : f.taglineEn,
            },
          })),
        } as const)
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
                >
                  {isFr ? "Pré-réservez sur le calendrier" : "Pre-book on the calendar"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
              ) : (
                <Cta href={contactHref} size="lg">
                  {isFr ? "Demander un devis sur mesure" : "Request a bespoke quote"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
              )}
              <Cta href="/interventions/collectives" variant="outline" size="lg">
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
              <Cta href={contactHref} size="lg">
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
              <Cta href={contactHref} size="lg">
                <Mail aria-hidden="true" className="h-4 w-4" />
                {isFr ? "Demander une formation" : "Request a training"}
              </Cta>
              <Cta href="/interventions/collectives" variant="outline" size="lg">
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

      <CtaBlock
        eyebrow={isFr ? "Une question ?" : "A question?"}
        title={isFr ? "Parler à quelqu'un avant de réserver" : "Talk to someone before booking"}
        description={
          isFr
            ? "Un appel de 15 min pour valider que ce format colle à votre contexte. Sans engagement."
            : "A 15-minute call to make sure this format fits your context. No commitment."
        }
        cta={
          <Cta href={`/interventions/demande?objet=cadrage-${duration.slug}` as never} size="lg">
            {isFr ? "Demander un appel" : "Request a call"} →
          </Cta>
        }
        tone="dark"
      />

      {itemListJsonLd ? <JsonLd data={itemListJsonLd} /> : null}
    </>
  );
}
