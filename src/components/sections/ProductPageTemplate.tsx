import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { ProductHero } from "./ProductHero";
import { FeatureGrid } from "./FeatureGrid";
import { ProcessSteps } from "./ProcessSteps";
import { MetricsRow } from "./MetricsRow";
import { FaqBlock } from "./FaqBlock";
import { CtaBlock } from "./CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";

interface DayScheduleItem {
  time: string;
  title: string;
  description?: string;
}

interface DaySchedule {
  title: string;
  intro?: string;
  days: ReadonlyArray<{
    label?: string;
    items: ReadonlyArray<DayScheduleItem>;
  }>;
  logisticsNote?: string;
}

interface ProductPageTemplateProps {
  accent: "primary" | "purple" | "orange" | "green";
  copy: {
    eyebrow: string;
    title: string;
    /** Portion italique terracotta du titre (signature v3). */
    titleEm?: string;
    /** Suite du titre après titleEm. */
    titleTail?: string;
    answer: string;
    priceEur?: number;
    ctaPrimary: string;
    ctaSecondary: string;
    benefitsTitle: string;
    benefits: ReadonlyArray<{ title: string; description: string }>;
    processTitle: string;
    processSteps: ReadonlyArray<{ title: string; description: string }>;
    metricsTitle: string;
    metrics: ReadonlyArray<{ number: string; suffix: string; label: string }>;
    faqTitle: string;
    faqs: ReadonlyArray<{ id: string; question: string; answer: string }>;
    ctaBlockTitle: string;
    ctaBlockDescription: string;
    /** Optionnel — timeline détaillée d'une journée. Module 1 uniquement. */
    daySchedule?: DaySchedule;
  };
  ctaPrimaryHref: string;
  ctaSecondaryHref: string;
  jsonLd?: ReadonlyArray<Record<string, unknown>>;
}

// Editorial v3 — alternance auto des sections paper/sand/halo-cool/canvas/mocha
// pour rythme visuel. Toutes les pages produits (Module 1/2/3, ~21 pages)
// héritent automatiquement de cette doctrine.
export function ProductPageTemplate({
  accent,
  copy,
  ctaPrimaryHref,
  ctaSecondaryHref,
  jsonLd = [],
}: ProductPageTemplateProps) {
  const metricsVariant: "primary" | "purple" | "orange" | "green" = accent;
  return (
    <>
      <ProductHero
        eyebrow={copy.eyebrow}
        accent={accent}
        title={copy.title}
        {...(copy.titleEm ? { titleEm: copy.titleEm } : {})}
        {...(copy.titleTail ? { titleTail: copy.titleTail } : {})}
        answer={copy.answer}
        {...(typeof copy.priceEur === "number"
          ? { priceEur: copy.priceEur, priceSuffix: "HT" }
          : {})}
        cta={
          <>
            <Cta href={ctaPrimaryHref} size="lg">
              {copy.ctaPrimary}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href={ctaSecondaryHref} variant="outline" size="lg">
              {copy.ctaSecondary}
            </Cta>
          </>
        }
      />

      {/* Déroulement de la journée — JUSTE APRÈS LE HERO (Module 1).
          Section principale de la page : grand format, moderne. */}
      {copy.daySchedule ? <DayScheduleSection schedule={copy.daySchedule} /> : null}

      {/* Gros CTA conversion — « Je réserve cette intervention ».
          Placé immédiatement après le déroulement (intent maximal) +
          rappelé en CTA final mocha. Module 1 uniquement (a daySchedule). */}
      {copy.daySchedule ? (
        <ReserveBigCta
          ctaPrimaryHref={ctaPrimaryHref}
          ctaPrimary={copy.ctaPrimary}
          {...(typeof copy.priceEur === "number" ? { priceEur: copy.priceEur } : {})}
        />
      ) : null}

      {/* « Ce que vos équipes apprendront » — paper white pour respiration.
          4 colonnes sur lg+ si 4 bénéfices, sinon auto. */}
      <Section tone="paper" eyebrow={copy.benefitsTitle.toUpperCase()} title={copy.benefitsTitle}>
        <FeatureGrid
          items={copy.benefits.map((b, i) => ({ id: `b-${i}`, ...b }))}
          columns={copy.benefits.length >= 4 ? 4 : 3}
        />
      </Section>

      {/* « Comment fonctionne une réservation » — sand intermission, 5 étapes */}
      <Section tone="sand" eyebrow="Réservation" title={copy.processTitle}>
        <ProcessSteps steps={copy.processSteps.map((s, i) => ({ id: `s-${i}`, ...s }))} />
      </Section>

      {/* Metrics — mocha riche pour gros contraste */}
      <Section tone="mocha" eyebrow="Chiffres" title={copy.metricsTitle}>
        <MetricsRow
          stats={copy.metrics.map((m, i) => ({
            id: `m-${i}`,
            number: m.number,
            suffix: m.suffix,
            label: m.label,
            variant: metricsVariant,
          }))}
        />
      </Section>

      {/* FAQ — canvas pour repos */}
      <FaqBlock title={copy.faqTitle} items={copy.faqs} emitJsonLd={false} tone="canvas" />

      {/* CTA final — mocha riche signature */}
      <CtaBlock
        title={copy.ctaBlockTitle}
        description={copy.ctaBlockDescription}
        cta={
          <Cta href={ctaPrimaryHref} size="lg">
            {copy.ctaPrimary}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Cta>
        }
        tone="mocha"
      />

      <Container>
        {jsonLd.map((schema, idx) => (
          <JsonLd key={idx} data={schema} />
        ))}
      </Container>
    </>
  );
}

// Bandeau CTA conversion — gros bouton « Je réserve cette intervention ».
// Visible, halo-warm, prix et message d'urgence pour conversion maximale.
function ReserveBigCta({
  ctaPrimaryHref,
  ctaPrimary,
  priceEur,
}: {
  ctaPrimaryHref: string;
  ctaPrimary: string;
  priceEur?: number;
}) {
  return (
    <section className="bg-halo-warm relative overflow-hidden py-16 sm:py-20">
      {/* Halos décoratifs */}
      <div
        aria-hidden="true"
        className="bg-terracotta/15 pointer-events-none absolute -top-32 -right-20 h-80 w-80 rounded-full blur-3xl"
      />
      <div
        aria-hidden="true"
        className="bg-primary/10 pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full blur-3xl"
      />
      <Container className="relative">
        <div className="bg-paper border-terracotta/25 shadow-card mx-auto max-w-3xl overflow-hidden rounded-3xl border-2 p-8 text-center sm:p-10 lg:p-12">
          <p className="text-fg-muted text-[12px] font-semibold tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            Réservation directe
          </p>
          <h2
            className="text-fg mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Je réserve <span className="text-terracotta italic">cette intervention</span>
          </h2>
          <p className="text-fg-soft mx-auto mt-4 max-w-xl text-base leading-relaxed sm:text-lg">
            Sélectionnez votre date dans le calendrier maison.{" "}
            {typeof priceEur === "number"
              ? `À partir de ${priceEur} € HT pour une journée sur site.`
              : "Sur devis · réponse sous 48 h ouvrées."}{" "}
            Confirmation immédiate, paiement 50 % à la réservation.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Cta href={ctaPrimaryHref} size="xl">
              {ctaPrimary}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/reserver" variant="outline" size="lg">
              Voir le calendrier complet
            </Cta>
          </div>
          <p className="text-fg-muted mt-6 text-xs">
            ★ Frais de déplacement et hébergement au forfait journalier · pas de justificatifs
          </p>
        </div>
      </Container>
    </section>
  );
}

// Timeline éditoriale heure-par-heure — version moderne, grand format.
// Premier bloc juste après le hero, c'est la pièce maîtresse de la page.
// Server Component pure. 1 journée → 1 colonne large ; 2 jours → 2 cols.
function DayScheduleSection({ schedule }: { schedule: DaySchedule }) {
  const isMultiDay = schedule.days.length > 1;
  return (
    <Section
      tone="canvas"
      eyebrow={schedule.title.toUpperCase()}
      title={schedule.title}
      description={schedule.intro}
    >
      <div className={isMultiDay ? "grid gap-12 lg:grid-cols-2 lg:gap-16" : "mx-auto max-w-4xl"}>
        {schedule.days.map((day, dayIdx) => (
          <div key={dayIdx}>
            {isMultiDay && day.label ? (
              <p className="text-terracotta-deep mb-6 text-[13px] font-semibold tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {day.label}
              </p>
            ) : null}
            <ol className="space-y-4 sm:space-y-5">
              {day.items.map((item, i) => (
                <li
                  key={i}
                  className="bg-paper border-border hover:border-terracotta/50 hover:shadow-card group relative grid grid-cols-[auto_1fr] gap-5 rounded-2xl border p-5 transition-all sm:gap-7 sm:p-6 lg:gap-8 lg:p-7"
                >
                  {/* Time block — gros, italique terracotta serif (signature v3) */}
                  <div className="flex w-[80px] shrink-0 flex-col items-start sm:w-[110px] lg:w-[130px]">
                    <span
                      className="text-terracotta-deep block text-2xl leading-none tracking-tight italic tabular-nums sm:text-3xl lg:text-4xl"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {item.time}
                    </span>
                    {/* Trait accent sous l'heure pour signature visuelle */}
                    <span
                      aria-hidden="true"
                      className="bg-terracotta mt-2 block h-0.5 w-8 transition-all group-hover:w-12"
                    />
                  </div>

                  {/* Contenu */}
                  <div className="min-w-0">
                    <h3 className="text-fg text-lg leading-snug font-semibold sm:text-xl lg:text-2xl">
                      {item.title}
                    </h3>
                    {item.description ? (
                      <p className="text-fg-soft mt-2 text-[15px] leading-relaxed sm:text-base">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {/* Note logistique : frais déplacement / logement à charge client */}
      {schedule.logisticsNote ? (
        <div className="mx-auto mt-12 max-w-4xl">
          <p className="bg-halo-warm border-terracotta/25 text-fg-soft rounded-2xl border-2 px-6 py-5 text-[15px] leading-relaxed">
            <span className="text-terracotta-deep mr-2 font-semibold">★</span>
            {schedule.logisticsNote}
          </p>
        </div>
      ) : null}
    </Section>
  );
}
