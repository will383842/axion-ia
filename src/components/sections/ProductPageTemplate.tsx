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

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
}

interface MaturityLevel {
  /** Niveau 1 / 2 / 3 displayed in the eyebrow dot. */
  rank: 1 | 2 | 3;
  name: string;
  description: string;
}

interface MaturityLevels {
  /** Section h2 title. */
  title: string;
  /** Eyebrow uppercase (e.g. "Pour qui ça marche"). */
  eyebrow: string;
  /** Optional intro paragraph below the title. */
  intro?: string;
  levels: ReadonlyArray<MaturityLevel>;
}

interface ProductPageTemplateProps {
  isFr: boolean;
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
    /** Eyebrow de la section process. Défaut "Réservation" (Module 1
        Interventions). Sur audit, on passe "Déroulement" / "Method". */
    processEyebrow?: string;
    processSteps: ReadonlyArray<{ title: string; description: string }>;
    metricsTitle: string;
    /** Eyebrow de la section metrics. Défaut "Chiffres". Sur audit, on
        passe "Bénéfices" / "Benefits" (les metrics sont qualitatifs). */
    metricsEyebrow?: string;
    metrics: ReadonlyArray<{ number: string; suffix: string; label: string }>;
    faqTitle: string;
    faqs: ReadonlyArray<{ id: string; question: string; answer: string }>;
    ctaBlockTitle: string;
    ctaBlockDescription: string;
    /** Optionnel — timeline détaillée d'une journée. Module 1 uniquement. */
    daySchedule?: DaySchedule;
    /** Optionnel — 2-3 testimonials clients (D6 Proof). Si absent, section silencieuse. */
    testimonials?: ReadonlyArray<Testimonial>;
    /** Optionnel — eyebrow custom pour la section testimonials (défaut "Témoignages" / "Customer voices"). */
    testimonialsEyebrow?: string;
    /** Optionnel — titre h2 de la section testimonials (défaut "Ils l'ont fait" / "They did it"). */
    testimonialsTitle?: string;
    /** Optionnel — section anti-fear "Pour qui ça marche" 3 niveaux maturité (D7 Anti-fear). */
    maturity?: MaturityLevels;
    /** Optionnel — section "Pourquoi ce cas d'usage" (sous-pages implémentation),
     *  rendue juste après le hero. Spécifique au sous-service. */
    why?: {
      title: string;
      intro?: string;
      points: ReadonlyArray<{ title: string; description: string }>;
    };
  };
  ctaPrimaryHref: string;
  ctaSecondaryHref: string;
  /** Optionnel — schéma visuel rendu à droite du hero en lg+ (Sprint
   * Visual Rhythm 2026). Permet d'injecter `<InterventionDetailHeroSchema>`
   * ou `<AuditDetailHeroSchema>` selon le module sans dupliquer le template. */
  heroSchema?: React.ReactNode;
  jsonLd?: ReadonlyArray<Record<string, unknown>>;
  /** Optionnel — supprime le CtaBlock mocha final (les sous-pages
   *  implémentation rendent à la place le bandeau terracotta
   *  ImplementationContactBand « Réserver un appel / Nous écrire »). */
  hideFinalCta?: boolean;
  /** Optionnel — bandeau (contact) inséré juste avant la section process
   *  « Comment ça se déroule » (sous-pages implémentation). */
  midBand?: React.ReactNode;
}

// Editorial v3 — alternance auto des sections paper/sand/halo-cool/canvas/mocha
// pour rythme visuel. Toutes les pages produits (Module 1/2/3, ~21 pages)
// héritent automatiquement de cette doctrine.
export function ProductPageTemplate({
  isFr,
  accent,
  copy,
  ctaPrimaryHref,
  ctaSecondaryHref,
  heroSchema,
  jsonLd = [],
  hideFinalCta = false,
  midBand,
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
        {...(heroSchema ? { heroSchema } : {})}
      />

      {/* « Pourquoi ce cas d'usage » — juste après le hero. Optionnelle
          (sous-pages implémentation). Silencieuse si absente. */}
      {copy.why ? <WhySection isFr={isFr} why={copy.why} /> : null}

      {/* Déroulement de la journée — JUSTE APRÈS LE HERO (Module 1).
          Section principale de la page : grand format, moderne. */}
      {copy.daySchedule ? <DayScheduleSection schedule={copy.daySchedule} /> : null}

      {/* Gros CTA conversion — « Je réserve cette intervention ».
          Placé immédiatement après le déroulement (intent maximal) +
          rappelé en CTA final mocha. Module 1 uniquement (a daySchedule). */}
      {copy.daySchedule ? (
        <ReserveBigCta
          isFr={isFr}
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

      {/* Bandeau (contact) optionnel — juste avant le process (Will 2026-06-02). */}
      {midBand ?? null}

      {/* « Comment fonctionne une réservation » — sand intermission, 5 étapes.
          Eyebrow paramétrable (défaut "Réservation" pour Module 1, "Déroulement"
          ou "Method" sur audit). */}
      <Section
        tone="sand"
        eyebrow={copy.processEyebrow ?? (isFr ? "Réservation" : "Booking")}
        title={copy.processTitle}
      >
        <ProcessSteps steps={copy.processSteps.map((s, i) => ({ id: `s-${i}`, ...s }))} />
      </Section>

      {/* Metrics — mocha riche pour gros contraste. Eyebrow paramétrable. */}
      <Section
        tone="mocha"
        eyebrow={copy.metricsEyebrow ?? (isFr ? "Chiffres" : "By the numbers")}
        title={copy.metricsTitle}
      >
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

      {/* Section testimonials — D6 Proof. Optionnelle. paper white. */}
      {copy.testimonials && copy.testimonials.length > 0 ? (
        <TestimonialsSection
          isFr={isFr}
          items={copy.testimonials}
          {...(copy.testimonialsEyebrow ? { eyebrow: copy.testimonialsEyebrow } : {})}
          {...(copy.testimonialsTitle ? { title: copy.testimonialsTitle } : {})}
        />
      ) : null}

      {/* Section anti-fear "Pour qui ça marche" — D7 Anti-fear. Optionnelle. sand. */}
      {copy.maturity ? <MaturityLevelsSection maturity={copy.maturity} accent={accent} /> : null}

      {/* FAQ — canvas pour repos */}
      <FaqBlock title={copy.faqTitle} items={copy.faqs} emitJsonLd={false} tone="canvas" />

      {/* CTA final — mocha riche signature. Supprimable (hideFinalCta) quand la
          page rend son propre bandeau de contact (sous-pages implémentation). */}
      {hideFinalCta ? null : (
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
      )}

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
  isFr,
  ctaPrimaryHref,
  ctaPrimary,
  priceEur,
}: {
  isFr: boolean;
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
            {isFr ? "Réservation directe" : "Direct booking"}
          </p>
          <h2
            className="text-fg mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? "Je réserve " : "I book "}
            <span className="text-terracotta italic">
              {isFr ? "cette intervention" : "this session"}
            </span>
          </h2>
          <p className="text-fg-soft mx-auto mt-4 max-w-xl text-base leading-relaxed sm:text-lg">
            {isFr
              ? "Sélectionnez votre date dans le calendrier maison. "
              : "Pick your date in the on-site calendar. "}
            {typeof priceEur === "number"
              ? isFr
                ? `À partir de ${priceEur} € HT pour une journée sur site.`
                : `From €${priceEur} (excl. VAT) for an on-site day.`
              : isFr
                ? "Sur devis · réponse sous 48 h ouvrées."
                : "On quote · reply within 48 business hours."}{" "}
            {isFr
              ? "Confirmation immédiate, paiement 50 % à la réservation."
              : "Immediate confirmation, 50 % payment on booking."}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {/* Sprint 14.10.7 fix Will (2026-05-11) : un seul CTA — le bouton
                secondaire « Voir le calendrier complet » menait au même endroit
                que ctaPrimary, doublon retiré pour clarifier l'action principale. */}
            <Cta href={ctaPrimaryHref} size="xl">
              {ctaPrimary}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
          </div>
          <p className="text-fg-muted mt-6 text-xs">
            {isFr
              ? "★ Frais de déplacement et hébergement au forfait journalier · pas de justificatifs"
              : "★ Travel and lodging at a flat daily rate · no receipts"}
          </p>
        </div>
      </Container>
    </section>
  );
}

// 3 testimonials cards éditoriales — D6 Proof. Server Component pure.
// Renders only when copy.testimonials is non-empty (silent otherwise).
function TestimonialsSection({
  isFr,
  items,
  eyebrow,
  title,
}: {
  isFr: boolean;
  items: ReadonlyArray<Testimonial>;
  eyebrow?: string;
  title?: string;
}) {
  return (
    <Section
      tone="paper"
      eyebrow={eyebrow ?? (isFr ? "Témoignages" : "Customer voices")}
      title={title ?? (isFr ? "Ils l'ont fait" : "They did it")}
    >
      <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
        {items.slice(0, 3).map((t) => (
          <figure
            key={t.id}
            className="bg-bg border-border hover:border-terracotta/40 hover:shadow-card flex flex-col rounded-2xl border p-6 transition-all sm:p-7"
          >
            <span
              aria-hidden="true"
              className="text-terracotta-deep block text-5xl leading-none italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              &ldquo;
            </span>
            <blockquote className="text-fg mt-2 flex-1 text-base leading-relaxed sm:text-lg">
              {t.quote}
            </blockquote>
            <figcaption className="border-border mt-6 border-t pt-4">
              <p className="text-fg text-sm font-semibold">{t.author}</p>
              <p className="text-fg-muted text-xs">{t.role}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

// "Pourquoi ce cas d'usage" — section éditoriale rendue juste après le hero.
// Server Component pure. Rendue seulement si copy.why est fourni.
function WhySection({
  isFr,
  why,
}: {
  isFr: boolean;
  why: NonNullable<ProductPageTemplateProps["copy"]["why"]>;
}) {
  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "L'enjeu" : "Why it matters"}
      title={why.title}
      description={why.intro}
    >
      <div className="grid gap-6 md:grid-cols-3 lg:gap-8">
        {why.points.map((p, i) => (
          <article
            key={i}
            className="bg-bg border-border hover:border-terracotta/40 hover:shadow-card flex flex-col rounded-2xl border p-6 transition-all sm:p-7"
          >
            <h3
              className="text-fg text-lg leading-tight font-medium tracking-tight sm:text-xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {p.title}
            </h3>
            <p className="text-fg-soft mt-3 text-[15px] leading-relaxed">{p.description}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

// Anti-fear "Pour qui ça marche" — 3 niveaux maturité. D7. Server Component pure.
// Renders only when copy.maturity is set (silent otherwise).
function MaturityLevelsSection({
  maturity,
  accent,
}: {
  maturity: MaturityLevels;
  accent: "primary" | "purple" | "orange" | "green";
}) {
  const accentDot: Record<typeof accent, string> = {
    primary: "bg-primary",
    purple: "bg-purple",
    orange: "bg-terracotta",
    green: "bg-sage",
  };
  return (
    <Section
      tone="sand"
      eyebrow={maturity.eyebrow}
      title={maturity.title}
      description={maturity.intro}
    >
      <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
        {maturity.levels.map((level) => (
          <article
            key={level.rank}
            className="bg-paper border-border hover:border-terracotta/40 hover:shadow-card flex flex-col rounded-2xl border p-6 transition-all sm:p-7"
          >
            <p className="text-fg-muted mb-3 flex items-center gap-2 text-[12px] font-semibold tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className={`${accentDot[accent]} inline-block h-1.5 w-1.5 rounded-full`}
              />
              {`Niveau ${level.rank}`}
            </p>
            <h3
              className="text-fg text-xl leading-tight font-medium tracking-tight sm:text-2xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {level.name}
            </h3>
            <p className="text-fg-soft mt-3 text-[15px] leading-relaxed">{level.description}</p>
          </article>
        ))}
      </div>
    </Section>
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
