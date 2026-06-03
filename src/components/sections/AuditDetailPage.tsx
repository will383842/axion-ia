// Composant template — pages détail Audit (Flash, Ciblé, Stratégique PME,
// Stratégique ETI). Sprint 14.10.8 (Will 2026-05-12).
//
// Pattern miroir d'`InterventionDetailPage` pour cohérence visuelle parfaite
// entre /audit/* et /interventions/*. Réutilise les sous-composants partagés
// `intervention-parts/` (Schedule, BenefitsGrid, FaqList) pour zéro duplication.
//
// Spécificité Audit : un bloc « Choisissez votre format » liste les sous-tiers
// du tier (cartes cliquables), chacune avec son CTA :
//   - ctaType="calendar" → réservation directe sur /reserver (Flash sur site 890 €)
//   - ctaType="contact"  → /audit/demande?objet=<subTierId>
//   - ctaType="quote"    → /audit/demande?objet=<subTierId> (sur devis)

import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowRight, Calendar, FileText, Mail, Check, Clock, Package } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { ContactBand } from "@/components/sections/ContactBand";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { InterventionSchedule } from "@/components/sections/intervention-parts/InterventionSchedule";
import { InterventionBenefitsGrid } from "@/components/sections/intervention-parts/InterventionBenefitsGrid";
import { InterventionFaqList } from "@/components/sections/intervention-parts/InterventionFaqList";
import { AUDIT_DETAIL_CONFIGS } from "@/content/audit-detail-configs";
import { type AuditTier, getAuditTierMeta } from "@/content/audit-taxonomy";
import { buildServiceJsonLd, buildFaqJsonLd } from "@/lib/seo";

interface Props {
  tier: AuditTier;
  locale: Locale;
}

const TIGHT_X = "lg:px-6 xl:px-10";

export function AuditDetailPage({ tier, locale }: Props): ReactNode {
  const isFr = locale === "fr";
  const config = AUDIT_DETAIL_CONFIGS[tier];
  const meta = getAuditTierMeta(tier);

  const breadcrumbItems = [
    { href: "/audit", label: isFr ? "Audit" : "Audit" },
    {
      href: locale === "fr" ? meta.pathFr : meta.pathEn,
      label: isFr ? meta.labelFr : meta.labelEn,
    },
  ];

  // CTA hero : si tier a un slot calendrier (Flash), CTA "Pré-réserver"
  // pointe vers le sous-tier featured (Flash terrain 890 €). Sinon, CTA
  // "Demander un cadrage" pointe vers /audit/demande pré-rempli.
  const featuredSubTier = config.subTiers.find((s) => s.isFeatured) ?? config.subTiers[0]!;
  const heroCtaHref =
    featuredSubTier.ctaType === "calendar"
      ? `/reserver?intervention=${featuredSubTier.calendarSlug}`
      : `/audit/demande?objet=${encodeURIComponent(featuredSubTier.contactObject ?? tier)}`;

  // JSON-LD — Service (factory centralisée auto-injecte areasServed +
  // dateModified) + FAQPage (factory auto-injecte Speakable).
  const serviceJsonLd = buildServiceJsonLd({
    locale,
    path: locale === "fr" ? meta.pathFr : meta.pathEn,
    name: `${isFr ? config.titleFr : config.titleEn} · Axion-IA`,
    description: isFr ? config.promiseFr : config.promiseEn,
    serviceType: "AI audit",
  });

  const faqJsonLd = buildFaqJsonLd({
    items: config.faq.map((f) => ({
      question: isFr ? f.qFr : f.qEn,
      answer: isFr ? f.aFr : f.aEn,
    })),
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO — 2 colonnes (texte + visuel) quand une image est fournie, sinon
          colonne unique. Refonte 2026-05-31 (Will) : ratio texte/image soigné. */}
      <section className="bg-halo-warm relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <Container className={cn("relative", TIGHT_X)}>
          <div
            className={cn(
              config.heroImage
                ? "grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14"
                : "max-w-3xl",
            )}
          >
            <div className={config.heroImage ? "max-w-2xl" : "max-w-3xl"}>
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Audit IA" : "AI audit"}
              </p>

              <h1 className="display-editorial text-fg mt-5">
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

              {(isFr ? config.heroMetaFr : config.heroMetaEn) ? (
                <p className="text-terracotta-deep mt-5 flex items-center gap-2 text-[14px] font-semibold">
                  <Clock aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                  {isFr ? config.heroMetaFr : config.heroMetaEn}
                </p>
              ) : null}

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
                  href={heroCtaHref}
                  size="lg"
                  className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
                >
                  {featuredSubTier.ctaType === "calendar" ? (
                    <Calendar aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <Mail aria-hidden="true" className="h-4 w-4" />
                  )}
                  {isFr ? config.ctaPrimaryLabelFr : config.ctaPrimaryLabelEn}
                </Cta>
                <Cta href="/audit" variant="outline" size="lg">
                  {isFr ? "← Voir les 4 niveaux d'audit" : "← See the 4 audit levels"}
                </Cta>
              </div>
            </div>

            {config.heroImage ? (
              <div className="border-border shadow-card relative aspect-[4/3] overflow-hidden rounded-3xl border lg:aspect-[5/4]">
                <Image
                  src={config.heroImage.src}
                  alt={isFr ? config.heroImage.altFr : config.heroImage.altEn}
                  fill
                  priority
                  sizes="(max-width: 1024px) 92vw, 520px"
                  className="object-cover"
                />
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      {/* POUR QUI — 3 profils servis (optionnel). */}
      {(isFr ? config.forWhomFr : config.forWhomEn) ? (
        <section className="bg-paper border-border border-b py-8">
          <Container className={TIGHT_X}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
              <p className="text-fg-muted shrink-0 text-[12px] font-bold tracking-[0.16em] uppercase">
                {isFr ? "Pour qui ?" : "Who for?"}
              </p>
              <ul className="flex flex-wrap gap-x-6 gap-y-2">
                {(isFr ? config.forWhomFr! : config.forWhomEn!).map((who) => (
                  <li key={who} className="text-fg flex items-center gap-2 text-[14px] font-medium">
                    <Check
                      aria-hidden="true"
                      className="text-terracotta-deep h-4 w-4 shrink-0"
                      strokeWidth={2.5}
                    />
                    {who}
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>
      ) : null}

      {/* SOUS-TIERS — Choisissez votre format (cartes cliquables).
          tone sand pour casser avec hero halo-warm sans dupliquer le paper
          du Programme qui suit. Rythme final : warm → sand → paper → default
          → sand → dark (parité avec InterventionDetailPage). */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Choisissez votre format" : "Choose your format"}
        title={isFr ? "Formats" : "Available"}
        titleEm={isFr ? "disponibles" : "formats"}
        description={
          isFr
            ? "Chaque format correspond à un contexte précis. Cliquez sur le format qui colle à votre situation pour démarrer."
            : "Each format addresses a specific context. Click the format that matches your situation to start."
        }
        contentClassName={TIGHT_X}
      >
        <div
          className={cn(
            "grid gap-6 lg:gap-7",
            config.subTiers.length === 2 && "lg:grid-cols-2",
            config.subTiers.length === 3 && "lg:grid-cols-3",
            config.subTiers.length === 1 && "mx-auto max-w-2xl",
          )}
        >
          {config.subTiers.map((sub) => {
            const href =
              sub.ctaType === "calendar"
                ? `/reserver?intervention=${sub.calendarSlug}`
                : `/audit/demande?objet=${encodeURIComponent(sub.contactObject ?? sub.subTierId)}`;
            const Icon =
              sub.ctaType === "calendar" ? Calendar : sub.ctaType === "quote" ? FileText : Mail;
            const ctaLabel = isFr
              ? sub.ctaType === "calendar"
                ? "Réserver sur le calendrier"
                : sub.ctaType === "quote"
                  ? "Demander un cadrage"
                  : "Pré-réserver cette mission"
              : sub.ctaType === "calendar"
                ? "Book on the calendar"
                : sub.ctaType === "quote"
                  ? "Request framing"
                  : "Pre-book this mission";
            return (
              <article
                key={sub.subTierId}
                className={cn(
                  "bg-paper border-border shadow-subtle relative flex flex-col rounded-3xl border p-6 sm:p-7",
                  sub.isFeatured && "ring-terracotta ring-2 ring-offset-2",
                )}
              >
                {sub.isFeatured ? (
                  <span className="bg-terracotta text-mocha-fg absolute -top-3 right-6 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase shadow-sm">
                    {isFr ? "Recommandé" : "Featured"}
                  </span>
                ) : null}
                <h3 className="text-fg text-xl leading-tight font-semibold">
                  {isFr ? sub.labelFr : sub.labelEn}
                </h3>
                <p className="text-fg-muted mt-1 text-[13px]">{isFr ? sub.rangeFr : sub.rangeEn}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-terracotta-deep text-3xl font-bold tracking-tight tabular-nums">
                    {isFr ? sub.priceLabelFr : sub.priceLabelEn}
                  </span>
                </div>
                <p className="text-fg-soft mt-4 flex-1 text-[14.5px] leading-relaxed">
                  {isFr ? sub.bodyFr : sub.bodyEn}
                </p>
                <div className="mt-6">
                  <Cta
                    href={href}
                    size="lg"
                    className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta w-full justify-center"
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {ctaLabel}
                  </Cta>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* DÉROULÉ HORAIRE DÉTAILLÉ (TPE = la journée) — rendu en 2 colonnes
          (timeline à gauche, visuel sticky à droite) quand `dayTimeline` est
          fourni. Sinon, on retombe sur le programme synthétique historique. */}
      {config.dayTimeline ? (
        <Section
          tone="paper"
          eyebrow={(isFr ? config.dayTimelineEyebrowFr : config.dayTimelineEyebrowEn) ?? ""}
          title={(isFr ? config.dayTimelineTitleFr : config.dayTimelineTitleEn) ?? ""}
          titleEm={(isFr ? config.dayTimelineTitleEmFr : config.dayTimelineTitleEmEn) ?? ""}
          description={(isFr ? config.dayTimelineDescFr : config.dayTimelineDescEn) ?? ""}
          contentClassName={TIGHT_X}
        >
          <ol className="border-border relative space-y-0 border-l-2 pl-0">
            {config.dayTimeline.map((step, idx) => (
              <li key={idx} className="relative pb-9 pl-8 last:pb-0">
                <span
                  aria-hidden="true"
                  className="bg-terracotta text-mocha-fg border-paper absolute top-0 -left-[15px] flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold tabular-nums"
                >
                  {idx + 1}
                </span>
                <span className="text-terracotta-deep text-[12.5px] font-bold tracking-wide uppercase">
                  {step.time}
                </span>
                <h3 className="text-fg mt-1 text-lg leading-snug font-semibold">
                  {isFr ? step.titleFr : step.titleEn}
                </h3>
                <p className="text-fg-soft mt-1.5 max-w-2xl text-[14.5px] leading-relaxed">
                  {isFr ? step.descFr : step.descEn}
                </p>
              </li>
            ))}
          </ol>
        </Section>
      ) : (
        <Section
          tone="paper"
          eyebrow={isFr ? config.scheduleEyebrowFr : config.scheduleEyebrowEn}
          title={isFr ? "Comment" : "How"}
          titleEm={isFr ? "ça se passe" : "it works"}
          description={isFr ? config.scheduleDescriptionFr : config.scheduleDescriptionEn}
          contentClassName={TIGHT_X}
        >
          <InterventionSchedule items={config.schedule} isFr={isFr} hideTravelNote />
        </Section>
      )}

      {/* 4 BÉNÉFICES */}
      <Section
        eyebrow={isFr ? "Ce que vous obtenez" : "What you get"}
        title={isFr ? "4 bénéfices" : "4 benefits"}
        titleEm={isFr ? "concrets et chiffrés" : "concrete and quantified"}
        description={
          isFr
            ? "À l'issue de l'audit, voici ce que vous emportez — quel que soit le sous-tier choisi."
            : "By the end of the audit, here's what you take away — whichever sub-tier you chose."
        }
        contentClassName={TIGHT_X}
      >
        <InterventionBenefitsGrid items={config.benefits} isFr={isFr} />
      </Section>

      {/* BANDEAU CONTACT — orientation (parité pages-intention). */}
      <ContactBand
        isFr={isFr}
        eyebrow={isFr ? "Pas sûr du bon niveau d'audit ?" : "Not sure which audit level?"}
        title={isFr ? "On cadre votre audit IA," : "We scope your AI audit,"}
        titleEm={isFr ? "au bon niveau" : "at the right level"}
        description={
          isFr
            ? "Un échange pour comprendre votre contexte et vous orienter vers le format d'audit le plus adapté. Sans engagement."
            : "A chat to understand your context and point you to the most suitable audit format. No commitment."
        }
        track="-audit-detail"
      />

      {/* LIVRABLES — ce que le client repart avec (optionnel). tone sand. */}
      {config.deliverables ? (
        <Section
          tone="sand"
          eyebrow={isFr ? "Ce que vous repartez avec" : "What you walk away with"}
          title={isFr ? "Vos" : "Your"}
          titleEm={isFr ? "livrables concrets" : "concrete deliverables"}
          description={
            isFr
              ? "Pas de promesses en l'air : des documents et des outils directement actionnables, livrés à l'issue de l'audit."
              : "No empty promises: documents and tools you can act on immediately, delivered at the end of the audit."
          }
          contentClassName={TIGHT_X}
        >
          <ul className="grid list-none gap-6 p-0 md:grid-cols-3">
            {config.deliverables.map((d) => (
              <li
                key={d.titleFr}
                className="border-border bg-paper shadow-subtle flex flex-col rounded-2xl border p-6"
              >
                <span className="bg-terracotta-soft text-terracotta-deep mb-5 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Package aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h3 className="text-fg text-[16px] leading-snug font-bold tracking-tight">
                  {isFr ? d.titleFr : d.titleEn}
                </h3>
                <p className="text-fg-soft mt-2.5 text-[14px] leading-relaxed">
                  {isFr ? d.descFr : d.descEn}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* FAQ — tone sand (aligné sur InterventionDetailPage). */}
      <Section
        tone="sand"
        eyebrow="FAQ"
        title={isFr ? "Questions" : "Questions"}
        titleEm={isFr ? "fréquentes" : "we hear often"}
        contentClassName={TIGHT_X}
      >
        <InterventionFaqList items={config.faq} isFr={isFr} />
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Start"}
        title={isFr ? "Choisissez le format qui vous convient" : "Choose the format that suits you"}
        description={
          isFr
            ? "Pas sûr·e du sous-tier adapté ? Un appel où l'on prend le temps de cadrer votre projet à la perfection — pour choisir ensemble le format juste. Réponse sous 48 h ouvrées. Sans engagement."
            : "Not sure which sub-tier suits you? A call where we take the time to scope your project perfectly — to choose the right format together. Reply within 48 business hours. No commitment."
        }
        cta={
          <Cta
            href={heroCtaHref}
            size="lg"
            className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
          >
            {featuredSubTier.ctaType === "calendar" ? (
              <Calendar aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Mail aria-hidden="true" className="h-4 w-4" />
            )}
            {isFr ? config.ctaPrimaryLabelFr : config.ctaPrimaryLabelEn}
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={faqJsonLd} />
    </>
  );
}
