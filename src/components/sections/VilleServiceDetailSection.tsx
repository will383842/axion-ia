// Server Component — section détaillée d'un service à la ville (Sprint 14.10.1).
//
// Réutilisé sur :
//   - /implantations/[region]/[ville]   (3 sections empilées audit/interv/impl)
//   - /audit/[ville]                    (1 section pleine page) ← Commit B
//   - /interventions/[ville]            (1 section pleine page) ← Commit B
//   - /implementation/[ville]           (1 section pleine page) ← Commit B
//
// Cap : perfection extrême — chaque service développé sur ~500-700 mots avec
// hero + raisons + méthodologie + tarifs par taille INSEE + témoignages + FAQ
// + garanties. Anti-doorway HCU 2024 (data localisée vraiment unique).

import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { Link } from "@/i18n/navigation";
import type { VilleServiceCopyLocale } from "@/content/villes/copy/types";
import {
  AUDIT_TIERS,
  INTERVENTION_FEES_NOTE,
  INTERVENTION_TIERS,
  UN_A_UN_TIERS,
  formatAmount,
  getEntryTier,
  getTierById,
} from "@/content/pricing";

export interface VilleServiceDetailSectionProps {
  /** Locale courante. */
  isFr: boolean;
  /** Type de service — pilote l'accent visuel + libellés. */
  service: "audit" | "interventions" | "implementation" | "un-a-un";
  /** Nom de la ville (h2 + JSON-LD). */
  villeNameFr: string;
  /** Slug ville pour data-attributes tracking. */
  villeSlug: string;
  /** Slug région pour tracking + breadcrumbs. */
  regionSlug: string;
  /** Copy long-form du service à la ville. */
  copy: VilleServiceCopyLocale;
  /** Tone éditorial — `paper` (clair) ou `sand` (ivoire chaud). */
  tone?: "paper" | "sand" | "canvas";
}

// Sprint 14.10.5 — CTAs prix dérivés du SSOT pricing.ts (zéro hardcode).
const auditFlashAmount = getTierById(AUDIT_TIERS, "audit-flash").priceFlat!;
const interventionEssentielleAmount = getTierById(
  INTERVENTION_TIERS,
  "intervention-essentielle",
).priceFlat!;
const unAUnAmount = getEntryTier(UN_A_UN_TIERS).priceFlat!;

const SERVICE_META = {
  audit: {
    accent: "primary" as const,
    href: "/audit" as const,
    labelFr: "Audit IA",
    labelEn: "AI audit",
    eyebrowFr: "Audit IA opérationnel",
    eyebrowEn: "Operational AI audit",
    ctaFr: `Demander un audit Flash · ${formatAmount(auditFlashAmount, "fr", { compact: true })}`,
    ctaEn: `Request a Flash audit · ${formatAmount(auditFlashAmount, "en", { compact: true })}`,
  },
  interventions: {
    accent: "terracotta" as const,
    href: "/interventions" as const,
    labelFr: "Interventions IA",
    labelEn: "AI sessions",
    eyebrowFr: "Interventions IA en entreprise",
    eyebrowEn: "Corporate AI sessions",
    ctaFr: `Voir le calendrier · ${formatAmount(interventionEssentielleAmount, "fr", { compact: true })}`,
    ctaEn: `View the calendar · ${formatAmount(interventionEssentielleAmount, "en", { compact: true })}`,
  },
  implementation: {
    accent: "sage" as const,
    href: "/implementation" as const,
    labelFr: "Implémentation IA",
    labelEn: "AI implementation",
    eyebrowFr: "Implémentation IA opérationnelle",
    eyebrowEn: "Operational AI implementation",
    ctaFr: "Discuter d'un projet",
    ctaEn: "Discuss a project",
  },
  "un-a-un": {
    accent: "terracotta" as const,
    href: "/un-a-un" as const,
    labelFr: "Coaching IA 1-to-1",
    labelEn: "1-to-1 AI coaching",
    eyebrowFr: "Coaching IA individuel",
    eyebrowEn: "Individual AI coaching",
    ctaFr: `Démarrer mon accompagnement · ${formatAmount(unAUnAmount, "fr", { compact: true })}`,
    ctaEn: `Start my coaching · ${formatAmount(unAUnAmount, "en", { compact: true })}`,
  },
} as const;

const ACCENT_BG: Record<"primary" | "terracotta" | "sage", string> = {
  primary: "bg-primary-soft text-primary",
  terracotta: "bg-terracotta-soft text-terracotta-deep",
  sage: "bg-sand-deep text-sage",
};

const ACCENT_BORDER: Record<"primary" | "terracotta" | "sage", string> = {
  primary: "border-primary/40",
  terracotta: "border-terracotta/40",
  sage: "border-sage/40",
};

export function VilleServiceDetailSection({
  isFr,
  service,
  villeNameFr,
  villeSlug,
  regionSlug,
  copy,
  tone = "paper",
}: VilleServiceDetailSectionProps): ReactNode {
  const meta = SERVICE_META[service as keyof typeof SERVICE_META];
  const eyebrow = isFr ? meta.eyebrowFr : meta.eyebrowEn;
  const labelService = isFr ? meta.labelFr : meta.labelEn;

  return (
    <Section
      eyebrow={eyebrow}
      title={isFr ? `${labelService} à` : `${labelService} in`}
      titleEm={villeNameFr}
      description={copy.hero}
      tone={tone}
    >
      {/* WHY HERE — 4-6 raisons spécifiques ville × service */}
      {copy.whyHere.length > 0 ? (
        <div className="mb-14">
          <h3
            className="text-fg mb-6 text-2xl leading-tight font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? "Pourquoi" : "Why"}{" "}
            <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
              {isFr
                ? `${labelService.toLowerCase()} à ${villeNameFr}`
                : `${labelService.toLowerCase()} in ${villeNameFr}`}
            </span>
          </h3>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {copy.whyHere.map((reason, idx) => (
              <li
                key={idx}
                className={`bg-bg flex items-start gap-3 rounded-2xl border-2 p-5 ${ACCENT_BORDER[meta.accent]}`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ACCENT_BG[meta.accent]}`}
                >
                  <Check aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <p className="text-fg-soft text-sm leading-relaxed">{reason}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* METHODOLOGY — étapes pas à pas */}
      {copy.methodology.length > 0 ? (
        <div className="mb-14">
          <h3
            className="text-fg mb-6 text-2xl leading-tight font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? "Méthodologie" : "Methodology"}{" "}
            <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
              {isFr ? "pas à pas" : "step by step"}
            </span>
          </h3>
          <ol className="space-y-4">
            {copy.methodology.map((step, idx) => (
              <li
                key={idx}
                className={`bg-bg shadow-subtle relative flex gap-4 rounded-2xl border-2 p-5 ${ACCENT_BORDER[meta.accent]}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold tabular-nums ${ACCENT_BG[meta.accent]}`}
                  aria-hidden="true"
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-fg text-base leading-tight font-bold sm:text-lg">
                    {step.step}
                  </p>
                  <p className="text-fg-soft mt-2 text-sm leading-relaxed">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* PRICING — grille tarifaire par taille INSEE */}
      {copy.pricing.length > 0 ? (
        <div className="mb-14">
          <h3
            className="text-fg mb-6 text-2xl leading-tight font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? "Tarifs publics par" : "Public pricing by"}{" "}
            <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
              {isFr ? "taille d'entreprise" : "company size"}
            </span>
          </h3>
          <p className="text-fg-soft mb-6 text-sm leading-relaxed">
            {isFr
              ? "Classification INSEE officielle. Tarifs publics affichés, aucun devis opaque ni surfacturation."
              : "Official INSEE classification. Public pricing displayed, no opaque quote nor overbilling."}
          </p>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {copy.pricing.map((tier, idx) => (
              <li
                key={idx}
                className={`bg-bg shadow-subtle rounded-2xl border-2 p-6 ${ACCENT_BORDER[meta.accent]}`}
              >
                <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                  {tier.sizeLabel}
                </p>
                <p
                  className={`mt-2 text-2xl leading-tight font-semibold tracking-tight ${
                    meta.accent === "primary"
                      ? "text-primary"
                      : meta.accent === "terracotta"
                        ? "text-terracotta-deep"
                        : "text-sage"
                  }`}
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {tier.price}
                </p>
                <p className="text-fg-soft mt-3 text-sm leading-relaxed">{tier.detail}</p>
              </li>
            ))}
          </ul>
          {/* Note frais annexes interventions — Sprint 14.10.4 (Will 2026-05-08).
              Affichée seulement pour le service interventions ; les frais
              audit / implementation sont gérés dans leur SOW respectif. */}
          {service === "interventions" ? (
            <p className="text-fg-muted mt-6 text-xs leading-relaxed italic">
              {isFr ? INTERVENTION_FEES_NOTE.fr : INTERVENTION_FEES_NOTE.en}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* TESTIMONIALS — preuve sociale ville × service */}
      {copy.testimonials && copy.testimonials.length > 0 ? (
        <div className="mb-14">
          <h3
            className="text-fg mb-6 text-2xl leading-tight font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? "Ils nous ont confié" : "They trusted us with"}{" "}
            <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
              {isFr ? `leur ${labelService.toLowerCase()}` : `their ${labelService.toLowerCase()}`}
            </span>
          </h3>
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {copy.testimonials.map((t, idx) => (
              <li key={idx} className="bg-bg border-border-strong/40 rounded-2xl border-2 p-6">
                <p
                  className="text-fg text-base leading-relaxed italic sm:text-lg"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  «&nbsp;{t.quote}&nbsp;»
                </p>
                <p className="text-fg-muted mt-4 text-[11px] font-semibold tracking-[0.16em] uppercase">
                  {t.role} · {t.companyProfile}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* GUARANTEES — engagement contractuel */}
      {copy.guarantees ? (
        <div className={`bg-halo-warm border-terracotta/40 mb-12 rounded-2xl border-2 p-6 sm:p-8`}>
          <p className="text-terracotta-deep mb-3 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] uppercase">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            {isFr ? "Garanties contractuelles" : "Contractual guarantees"}
          </p>
          <p
            className="text-fg text-base leading-relaxed sm:text-lg"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {copy.guarantees}
          </p>
        </div>
      ) : null}

      {/* CTA + lien canonique service */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Cta
          href={meta.href}
          variant={meta.accent === "terracotta" ? "terracotta" : "primary"}
          size="lg"
          shape="pill"
          track={`ville_service_detail_${service}_canonical`}
          data-source-ville={villeSlug}
          data-source-region={regionSlug}
        >
          {isFr ? `Voir tout sur ${meta.labelFr}` : `See all on ${meta.labelEn}`}
          <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
        </Cta>
        <Link
          href={`/reserver?ville=${villeSlug}&service=${service}` as never}
          data-cta-tracking={`ville_service_detail_${service}_book`}
          data-source-ville={villeSlug}
          className="text-terracotta hover:text-terracotta-deep focus-visible:ring-terracotta inline-flex items-center gap-1.5 rounded-full px-5 py-3 text-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {isFr ? meta.ctaFr : meta.ctaEn}
        </Link>
      </div>
    </Section>
  );
}
