// Server Component — fiche détail d'UN niveau d'audit (Flash / Ciblé /
// Stratégique PME / Stratégique ETI). Refonte 2026-07-07 (Will) : alignement
// STRICT sur le template `FormationDetailPage` (pages /formations/[slug]).
//   - HÉRO 2 colonnes + CARTE INFOS-CLÉS sticky (prix « à partir de » + durée +
//     format + public + livrable + CTA).
//   - PAS d'horaires détaillés, PAS de timeline heure par heure (demande Will).
//   - Programme rendu en cartes par phase (sans horaires), résultats, modalités
//     à icônes, secteurs, tarif par sous-tier, FAQ accordéon, villes, maillage.
//
// Contenu 100 % dérivé du SSOT `audit-detail-configs.ts` + `pricing.ts`. Aucun
// prix en dur. Le rythme de sections et la grammaire visuelle reproduisent
// `FormationDetailPage` pour une harmonie parfaite entre /audit/* et
// /formations/*.

import type { ReactNode } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ContactBand } from "@/components/sections/ContactBand";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { ClientLogosMarqueeBand } from "@/components/services/audit/ClientLogosMarqueeBand";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { AUDIT_DETAIL_CONFIGS } from "@/content/audit-detail-configs";
import { type AuditTier, getAuditTierMeta } from "@/content/audit-taxonomy";
import { AUDIT_TIERS, formatAmount, getTierById } from "@/content/pricing";
import { CLIENT_SECTORS } from "@/content/sectors";
import { getVillesIndexableNow } from "@/content/villes";
import { buildServiceJsonLd, buildFaqJsonLd, buildHowToJsonLd } from "@/lib/seo";

interface Props {
  tier: AuditTier;
  locale: Locale;
}

/** Ordre canonique des 4 tiers audit — pour le maillage « autres niveaux ». */
const ALL_AUDIT_TIERS: ReadonlyArray<AuditTier> = [
  "audit-flash",
  "audit-cible",
  "audit-strategique-pme",
  "audit-strategique-eti",
];

export function AuditDetailPage({ tier, locale }: Props): ReactNode {
  const isFr = locale === "fr";
  const config = AUDIT_DETAIL_CONFIGS[tier];
  const meta = getAuditTierMeta(tier);
  const path = locale === "fr" ? meta.pathFr : meta.pathEn;
  const info = config.infoCard;

  // ── Prix d'entrée (SSOT pricing.ts) — priceFlat (fixe) ou priceMin (range) ──
  const tierPricing = getTierById(AUDIT_TIERS, tier);
  const entryValue = tierPricing.priceFlat ?? tierPricing.priceMin ?? null;
  const priceValue =
    entryValue != null
      ? formatAmount(entryValue, isFr ? "fr" : "en")
      : isFr
        ? "Sur devis"
        : "On request";

  // ── CTA héro : réservation calendrier (Flash) ou cadrage par formulaire ────
  const featuredSubTier = config.subTiers.find((s) => s.isFeatured) ?? config.subTiers[0]!;
  const heroCtaHref =
    featuredSubTier.ctaType === "calendar"
      ? "/appel"
      : `/audit/demande?objet=${encodeURIComponent(featuredSubTier.contactObject ?? tier)}`;
  const heroCtaIsCalendar = featuredSubTier.ctaType === "calendar";

  const breadcrumbItems = [
    { href: "/audit", label: isFr ? "Audit IA" : "AI audit" },
    { href: path, label: isFr ? config.titleFr : config.titleEn },
  ];

  // ── Carte infos-clés (héro) — tout depuis le SSOT ──────────────────────────
  const factRows: ReadonlyArray<{ icon: typeof Clock; label: string; value: string }> = [
    {
      icon: Clock,
      label: isFr ? "Durée" : "Duration",
      value: isFr ? info.durationFr : info.durationEn,
    },
    {
      icon: MapPin,
      label: "Format",
      value: isFr ? info.formatFr : info.formatEn,
    },
    {
      icon: Users,
      label: isFr ? "Pour qui" : "Who for",
      value: isFr ? info.audienceFr : info.audienceEn,
    },
    {
      icon: FileText,
      label: isFr ? "Livrable" : "Deliverable",
      value: isFr ? info.deliverableFr : info.deliverableEn,
    },
  ];

  // Section Modalités — mêmes faits + intervenant + confidentialité (parité formation).
  const modalitesRows: ReadonlyArray<{ icon: typeof Clock; label: string; value: string }> = [
    ...factRows,
    {
      icon: GraduationCap,
      label: isFr ? "Intervenant" : "Consultant",
      value: isFr ? "Un expert IA Axion-IA" : "An Axion-IA AI expert",
    },
    {
      icon: ShieldCheck,
      label: isFr ? "Confidentialité" : "Confidentiality",
      value: isFr
        ? "RGPD · données non utilisées pour entraîner les modèles"
        : "GDPR · data never used to train models",
    },
  ];

  // ── JSON-LD — Service + FAQPage + HowTo (dérivé des phases, pas d'horaires) ──
  const serviceJsonLd = buildServiceJsonLd({
    locale,
    path,
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
  const howToSteps = config.schedule.map((s) => ({
    name: isFr ? s.titleFr : s.titleEn,
    text: (isFr ? s.descriptionFr : s.descriptionEn) ?? (isFr ? s.titleFr : s.titleEn),
  }));
  const howToJsonLd =
    howToSteps.length > 0
      ? buildHowToJsonLd({
          locale,
          path,
          name: isFr
            ? `Comment se déroule ${config.titleFr.toLowerCase()}`
            : `How ${config.titleEn.toLowerCase()} unfolds`,
          description: isFr ? config.promiseFr : config.promiseEn,
          steps: howToSteps,
        })
      : null;

  // Autres niveaux d'audit (maillage) — 3 tiers restants.
  const siblings = ALL_AUDIT_TIERS.filter((t) => t !== tier).map((t) => {
    const m = getAuditTierMeta(t);
    const c = AUDIT_DETAIL_CONFIGS[t];
    return {
      href: locale === "fr" ? m.pathFr : m.pathEn,
      label: isFr ? c.titleFr : c.titleEn,
      em: isFr ? c.titleEmFr : c.titleEmEn,
      description: isFr ? c.promiseFr : c.promiseEn,
    };
  });

  const villes = getVillesIndexableNow().slice(0, 48);

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* ── HÉRO — contenu (gauche) + CARTE INFOS-CLÉS (droite) ──────────── */}
      <section className="bg-halo-warm relative overflow-hidden py-12 md:py-16 lg:py-20">
        <Container className="relative">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div className="max-w-2xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Audit IA" : "AI audit"}
                {` · ${isFr ? info.durationFr : info.durationEn}`}
              </p>
              <h1 className="display-editorial text-fg mt-4">
                {isFr ? config.titleFr : config.titleEn}{" "}
                <span
                  className="text-terracotta-deep mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? config.titleEmFr : config.titleEmEn}
                </span>
              </h1>
              <p className="text-fg-soft mt-6 text-lg leading-relaxed md:text-xl" data-speakable>
                {isFr ? config.promiseFr : config.promiseEn}
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
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
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Cta
                  href={heroCtaHref}
                  size="lg"
                  className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
                >
                  {heroCtaIsCalendar ? (
                    <Calendar aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <Mail aria-hidden="true" className="h-4 w-4" />
                  )}
                  {isFr ? config.ctaPrimaryLabelFr : config.ctaPrimaryLabelEn}
                </Cta>
                <Cta href="/contact" variant="outline" size="lg">
                  {isFr ? "Nous écrire" : "Write to us"}
                </Cta>
                <span className="text-fg-muted text-[12px]">
                  {isFr ? "Renseignements sans engagement" : "Enquiries, no commitment"}
                </span>
              </div>
            </div>

            {/* CARTE INFOS-CLÉS */}
            <aside className="border-terracotta/25 bg-canvas shadow-card rounded-3xl border-2 p-6 lg:sticky lg:top-24 lg:mt-8 lg:p-7">
              <div className="border-border border-b pb-5">
                <p className="text-fg-muted text-[12px] font-semibold tracking-wide uppercase">
                  {isFr ? "À partir de" : "From"}
                </p>
                <p
                  className="text-terracotta mt-1 text-[2.5rem] leading-none font-medium tabular-nums"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {priceValue}
                </p>
                <p className="text-fg-muted mt-2 text-[13px]">
                  {isFr ? info.scopeFr : info.scopeEn}
                </p>
              </div>
              <dl className="divide-border flex flex-col divide-y">
                {factRows.map((row) => (
                  <div key={row.label} className="flex items-start gap-3 py-3">
                    <span className="bg-terracotta/10 text-terracotta mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      <row.icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <dt className="text-fg-muted text-[11.5px] font-semibold tracking-wide uppercase">
                        {row.label}
                      </dt>
                      <dd className="text-fg text-[14px] leading-snug font-medium">{row.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              <div className="mt-5">
                <Cta
                  href={heroCtaHref}
                  size="lg"
                  className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta w-full justify-center"
                >
                  {heroCtaIsCalendar ? (
                    <Calendar aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <Mail aria-hidden="true" className="h-4 w-4" />
                  )}
                  {isFr ? config.ctaPrimaryLabelFr : config.ctaPrimaryLabelEn}
                </Cta>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      {/* ── PREUVE SOCIALE (logos) ───────────────────────────────────────── */}
      <ClientLogosMarqueeBand isFr={isFr} />

      {/* ── IMAGE IMMERSIVE (si fournie) ─────────────────────────────────── */}
      {config.heroImage ? (
        <Container className="py-10 md:py-12">
          <div className="border-border shadow-card relative aspect-[21/9] overflow-hidden rounded-3xl border">
            <Image
              src={config.heroImage.src}
              alt={isFr ? config.heroImage.altFr : config.heroImage.altEn}
              fill
              sizes="(max-width: 1024px) 92vw, 1100px"
              loading="lazy"
              className="object-cover"
            />
          </div>
        </Container>
      ) : null}

      {/* ── PROGRAMME (SANS horaires) — cartes par phase ─────────────────── */}
      <Section
        tone="sand"
        eyebrow={isFr ? config.scheduleEyebrowFr : config.scheduleEyebrowEn}
        title={isFr ? "Le déroulé" : "How"}
        titleEm={isFr ? "de la mission" : "it unfolds"}
        description={isFr ? config.scheduleDescriptionFr : config.scheduleDescriptionEn}
      >
        <div
          className={cn(
            "mx-auto grid max-w-5xl gap-5",
            config.schedule.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2",
          )}
        >
          {config.schedule.map((phase, idx) => (
            <div
              key={idx}
              className="border-border bg-bg shadow-card flex flex-col gap-3 rounded-2xl border p-6"
            >
              <p className="text-terracotta-deep text-[13px] font-bold tracking-[0.12em] uppercase">
                {phase.time}
              </p>
              <p className="text-fg text-[15px] leading-snug font-semibold">
                {isFr ? phase.titleFr : phase.titleEn}
              </p>
              {(isFr ? phase.descriptionFr : phase.descriptionEn) ? (
                <p className="text-fg-soft text-sm leading-relaxed">
                  {isFr ? phase.descriptionFr : phase.descriptionEn}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      {/* ── RÉSULTATS & BÉNÉFICES — cartes à icônes ──────────────────────── */}
      <Section
        eyebrow={isFr ? "Ce que vous obtenez" : "What you get"}
        title={isFr ? "Des résultats concrets" : "Concrete results"}
        titleEm={isFr ? "et chiffrés" : "and quantified"}
        description={
          isFr
            ? "À l'issue de l'audit, voici ce que vous emportez — quel que soit le format choisi."
            : "By the end of the audit, here's what you take away — whichever format you chose."
        }
      >
        <ul className="xs:grid-cols-2 mx-auto grid max-w-5xl list-none gap-4 p-0 lg:grid-cols-4">
          {config.benefits.map((b) => (
            <li
              key={b.titleFr}
              className="border-border bg-bg shadow-card flex flex-col gap-3 rounded-2xl border p-6"
            >
              <span className="bg-terracotta text-mocha-fg shadow-cta-terracotta inline-flex h-11 w-11 items-center justify-center rounded-xl">
                <b.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="text-fg text-[15px] leading-snug font-bold tracking-tight">
                {isFr ? b.titleFr : b.titleEn}
              </h3>
              <p className="text-fg-soft text-[13.5px] leading-relaxed">
                {isFr ? b.bodyFr : b.bodyEn}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── MODALITÉS — cartes à icônes ──────────────────────────────────── */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Modalités" : "Practical info"}
        title={isFr ? "Toutes les informations" : "All the"}
        titleEm={isFr ? "pratiques" : "practical details"}
      >
        <dl className="xs:grid-cols-2 grid grid-cols-1 gap-4 md:grid-cols-3">
          {modalitesRows.map((row) => (
            <div
              key={row.label}
              className="border-border bg-bg shadow-card hover:shadow-elevated group flex flex-col gap-3 rounded-2xl border p-5 transition hover:-translate-y-1"
            >
              <span className="bg-terracotta text-mocha-fg shadow-cta-terracotta inline-flex h-11 w-11 items-center justify-center rounded-xl transition group-hover:scale-110">
                <row.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <dt className="text-terracotta-deep text-[11.5px] font-bold tracking-[0.1em] uppercase">
                {row.label}
              </dt>
              <dd className="text-fg text-sm leading-snug font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ── SECTEURS D'ACTIVITÉ ──────────────────────────────────────────── */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Tous secteurs" : "All sectors"}
        title={isFr ? "Adapté à" : "Tailored to"}
        titleEm={isFr ? "votre secteur" : "your sector"}
        description={
          isFr
            ? "L'analyse et les recommandations sont ajustées à votre domaine d'activité et à vos métiers."
            : "The analysis and recommendations are adjusted to your field and your roles."
        }
      >
        <ul className="xs:grid-cols-2 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {CLIENT_SECTORS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/secteurs/${s.slug}` as never}
                className="shadow-subtle hover:shadow-elevated group bg-canvas flex h-full flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={`/illustrations/secteurs/${s.slug}.avif`}
                    alt={
                      isFr
                        ? `Audit IA « ${config.titleFr} » pour ${s.fullFr} — Axion-IA`
                        : `AI audit "${config.titleEn}" for ${s.fullFr} — Axion-IA`
                    }
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 768px) 33vw, (min-width: 479px) 50vw, 100vw"
                    loading="lazy"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span
                    aria-hidden="true"
                    className="bg-canvas/90 shadow-subtle absolute top-2.5 left-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-base"
                  >
                    {s.emoji}
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-between gap-2 p-4">
                  <span className="text-fg text-sm font-semibold tracking-tight">{s.labelFr}</span>
                  <ArrowRight aria-hidden="true" className="text-terracotta h-4 w-4 shrink-0" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── TARIF (sous-tiers) ───────────────────────────────────────────── */}
      <Section
        eyebrow={isFr ? "Tarif" : "Pricing"}
        title={
          config.subTiers.length > 1
            ? isFr
              ? "Un format selon"
              : "A format for"
            : isFr
              ? "Tarif de"
              : "Price of"
        }
        titleEm={
          config.subTiers.length > 1
            ? isFr
              ? "votre situation"
              : "your situation"
            : isFr
              ? "l'audit"
              : "the audit"
        }
        description={
          isFr
            ? "Chaque format correspond à un contexte précis. Choisissez celui qui colle à votre situation pour démarrer."
            : "Each format addresses a specific context. Pick the one that matches your situation to start."
        }
      >
        <Container className="max-w-5xl">
          <ul
            className={cn(
              "grid gap-5 md:gap-6",
              config.subTiers.length >= 3 && "lg:grid-cols-3",
              config.subTiers.length === 2 && "lg:grid-cols-2",
              config.subTiers.length === 1 && "mx-auto max-w-md",
            )}
          >
            {config.subTiers.map((sub) => {
              const href =
                sub.ctaType === "calendar"
                  ? "/appel"
                  : `/audit/demande?objet=${encodeURIComponent(sub.contactObject ?? sub.subTierId)}`;
              const Icon =
                sub.ctaType === "calendar" ? Calendar : sub.ctaType === "quote" ? FileText : Mail;
              const ctaLabel = isFr
                ? sub.ctaType === "calendar"
                  ? "Réserver un appel"
                  : sub.ctaType === "quote"
                    ? "Demander un cadrage"
                    : "Pré-réserver cette mission"
                : sub.ctaType === "calendar"
                  ? "Book a call"
                  : sub.ctaType === "quote"
                    ? "Request framing"
                    : "Pre-book this mission";
              return (
                <li key={sub.subTierId} className="relative">
                  {sub.isFeatured ? (
                    <span className="bg-terracotta text-mocha-fg shadow-subtle absolute -top-3 left-6 z-10 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase">
                      <Sparkles aria-hidden="true" className="h-3 w-3" />
                      {isFr ? "Recommandé" : "Featured"}
                    </span>
                  ) : null}
                  <article
                    className={cn(
                      "bg-paper relative flex h-full flex-col rounded-3xl border-2 p-7 transition-all lg:p-8",
                      sub.isFeatured
                        ? "border-terracotta shadow-card"
                        : "border-border-strong hover:border-terracotta hover:shadow-card",
                    )}
                  >
                    <p className="text-fg-muted text-[12px] font-bold tracking-[0.16em] uppercase">
                      {isFr ? sub.labelFr : sub.labelEn}
                    </p>
                    <p className="text-fg-muted mt-1 text-[13px]">
                      {isFr ? sub.rangeFr : sub.rangeEn}
                    </p>
                    <p className="mt-4 flex items-baseline gap-1.5">
                      <span
                        className="text-fg text-[clamp(2rem,4.5vw,3rem)] leading-none font-medium tracking-tight tabular-nums"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {isFr ? sub.priceLabelFr : sub.priceLabelEn}
                      </span>
                    </p>
                    <p className="text-fg-soft mt-4 flex-1 text-[14.5px] leading-relaxed">
                      {isFr ? sub.bodyFr : sub.bodyEn}
                    </p>
                    <div className="mt-6">
                      <Cta href={href} size="lg" className="w-full justify-center">
                        <Icon aria-hidden="true" className="h-4 w-4" />
                        {ctaLabel}
                      </Cta>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>

      {/* ── FAQ (FaqAccordion centralisé) ────────────────────────────────── */}
      {config.faq.length > 0 ? (
        <Section
          eyebrow="FAQ"
          title={isFr ? "Questions" : "Questions"}
          titleEm={isFr ? "fréquentes" : "we hear often"}
        >
          <div className="mx-auto max-w-3xl">
            <FaqAccordion
              items={config.faq.map((f, i) => ({
                id: `faq-${i + 1}`,
                question: isFr ? f.qFr : f.qEn,
                answer: isFr ? f.aFr : f.aEn,
              }))}
            />
          </div>
        </Section>
      ) : null}

      {/* ── BANDEAU CONTACT ──────────────────────────────────────────────── */}
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

      {/* ── VILLES (maillage compact) ────────────────────────────────────── */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Partout en France" : "Across France"}
        title={isFr ? "Cet audit," : "This audit,"}
        titleEm={isFr ? "près de chez vous" : "near you"}
        description={
          isFr
            ? "Nous intervenons en présentiel ou à distance, dans toute la France."
            : "We operate on site or remotely, throughout France."
        }
      >
        <ul role="list" className="flex flex-wrap gap-x-2 gap-y-2.5">
          {villes.map((v) => (
            <li key={v.slug}>
              <Link
                href={`/audit/par-ville/${v.slug}` as never}
                className="text-fg-soft bg-canvas border-border hover:border-terracotta hover:text-terracotta inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition"
              >
                {isFr ? `Audit IA ${v.nameFr}` : `AI audit ${v.nameFr}`}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── AUTRES NIVEAUX D'AUDIT (maillage) ────────────────────────────── */}
      {siblings.length > 0 ? (
        <Section
          tone="sand"
          eyebrow={isFr ? "Autres niveaux d'audit" : "Other audit levels"}
          title={isFr ? "Pour aller" : "Go"}
          titleEm={isFr ? "plus loin" : "further"}
        >
          <div className="xs:grid-cols-2 grid gap-5 lg:grid-cols-3">
            {siblings.map((s) => (
              <Link
                key={s.href}
                href={s.href as never}
                className="border-border bg-bg shadow-card hover:border-terracotta group flex h-full flex-col rounded-2xl border p-6 transition hover:-translate-y-1"
              >
                <p className="text-fg text-[15px] leading-snug font-semibold">
                  {s.label} <span className="text-terracotta-deep italic">{s.em}</span>
                </p>
                <p className="text-fg-soft mt-2 line-clamp-3 flex-1 text-sm leading-relaxed">
                  {s.description}
                </p>
                <span className="text-terracotta bg-terracotta/10 mt-4 inline-flex items-center gap-1 self-start rounded-full px-3 py-1 text-[13px] font-semibold transition group-hover:gap-2">
                  {isFr ? "Découvrir" : "Discover"}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      <RelatedKnowledge service="audit" />

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Start"}
        title={isFr ? "Cadrer votre audit IA" : "Scope your AI audit"}
        titleEm={isFr ? "sereinement" : "with confidence"}
        description={
          isFr
            ? "Un appel où l'on prend le temps de cadrer votre projet à la perfection — pour choisir ensemble le format juste. Réponse sous 48 h ouvrées. Sans engagement."
            : "A call where we take the time to scope your project perfectly — to choose the right format together. Reply within 48 business hours. No commitment."
        }
        cta={
          <>
            <Cta
              href={heroCtaHref}
              size="lg"
              className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
            >
              {heroCtaIsCalendar ? (
                <Calendar aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Mail aria-hidden="true" className="h-4 w-4" />
              )}
              {isFr ? config.ctaPrimaryLabelFr : config.ctaPrimaryLabelEn}
            </Cta>
            <Cta href="/contact" variant="outline" size="lg">
              {isFr ? "Nous écrire" : "Write to us"}
            </Cta>
          </>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={faqJsonLd} />
      {howToJsonLd ? <JsonLd data={howToJsonLd} /> : null}
    </>
  );
}
