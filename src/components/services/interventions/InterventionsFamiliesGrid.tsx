/**
 * InterventionsFamiliesGrid — 4 cards famille (Collectives / Individuel /
 * Dirigeants / Conférence), avec sub-rows paliers durée + stretched link.
 *
 * Sprint A Phase 2 (2026-05-25). Server Component. Réutilise SSOT taxonomy
 * (FAMILIES, COLLECTIVE_DURATIONS, countFormatsByFamily, countFormatsByCell,
 * familyPath) + pricing (INTERVENTION_TIERS, formatAmount, getTierById).
 *
 * Hub : 4 cards alignées 1×4 ou 2×2 selon viewport. Ville : data-source-ville
 * propagé sur les CTAs pour tracking analytics campagnes locales.
 */

import { ArrowRight, Users, User, Briefcase, Megaphone } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Section } from "@/components/layout/Section";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";
import {
  FAMILIES,
  COLLECTIVE_DURATIONS,
  countFormatsByFamily,
  countFormatsByCell,
  familyPath,
  type FamilyDef,
  type FormatAccent,
} from "@/content/interventions-taxonomy";
import type { VilleContext } from "@/components/services/types";

interface InterventionsFamiliesGridProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

const TIGHT_X = "lg:px-6 xl:px-10";

// ----------------------------------------------------------------------------
// Accents Tailwind par famille — palette Editorial v3 + exception Claude.
// ----------------------------------------------------------------------------
const familyAccentClasses: Record<
  FormatAccent,
  {
    border: string;
    title: string;
    line: string;
    cta: string;
    haloRing: string;
    chipBg: string;
    chipText: string;
    badge: string;
    iconBg: string;
    iconText: string;
  }
> = {
  terracotta: {
    border: "border-terracotta/35 hover:border-terracotta",
    title: "text-terracotta-deep",
    line: "bg-terracotta",
    cta: "bg-terracotta text-mocha-fg hover:bg-terracotta-deep",
    haloRing: "ring-terracotta/15",
    chipBg: "bg-terracotta-soft",
    chipText: "text-terracotta-deep",
    badge: "bg-terracotta-soft text-terracotta-deep border border-terracotta/20",
    iconBg: "bg-terracotta-soft",
    iconText: "text-terracotta-deep",
  },
  primary: {
    border: "border-primary/35 hover:border-primary",
    title: "text-primary",
    line: "bg-primary",
    cta: "bg-primary text-primary-fg hover:bg-primary-hover",
    haloRing: "ring-primary/15",
    chipBg: "bg-primary-soft",
    chipText: "text-primary",
    badge: "bg-primary-soft text-primary border border-primary/25",
    iconBg: "bg-primary-soft",
    iconText: "text-primary",
  },
  sage: {
    border: "border-sage/40 hover:border-sage",
    title: "text-sage",
    line: "bg-sage",
    cta: "bg-sage text-mocha-fg hover:opacity-90",
    haloRing: "ring-sage/20",
    chipBg: "bg-sage-soft",
    chipText: "text-sage",
    badge: "bg-sage-soft text-sage border border-sage/30",
    iconBg: "bg-sage-soft",
    iconText: "text-sage",
  },
  mocha: {
    border: "border-mocha-fg/15 hover:border-terracotta",
    title: "text-terracotta-soft",
    line: "bg-terracotta",
    cta: "bg-terracotta text-mocha-fg hover:bg-terracotta-deep",
    haloRing: "ring-terracotta/30",
    chipBg: "bg-terracotta-soft",
    chipText: "text-terracotta-deep",
    badge: "bg-terracotta-soft text-terracotta-deep border border-terracotta/30",
    iconBg: "bg-terracotta-soft",
    iconText: "text-terracotta-deep",
  },
  // hex-ok: brand-anthropic-claude — non utilisé pour les cards famille mais
  // conservé pour parité avec les cards format où Claude est présent.
  claude: {
    border: "border-[#D97757]/40 hover:border-[#D97757]", // hex-ok: brand-anthropic-claude
    title: "text-[#9C3E1E]", // hex-ok: brand-anthropic-claude
    line: "bg-[#D97757]", // hex-ok: brand-anthropic-claude
    cta: "bg-[#D97757] text-white hover:bg-[#B85F3E]", // hex-ok: brand-anthropic-claude
    haloRing: "ring-[#D97757]/15", // hex-ok: brand-anthropic-claude
    chipBg: "bg-[#FFF5EC]", // hex-ok: brand-anthropic-claude
    chipText: "text-[#9C3E1E]", // hex-ok: brand-anthropic-claude
    badge: "bg-[#FFF5EC] text-[#9C3E1E] border border-[#D97757]/30", // hex-ok: brand-anthropic-claude
    iconBg: "bg-[#FFF5EC]", // hex-ok: brand-anthropic-claude
    iconText: "text-[#9C3E1E]", // hex-ok: brand-anthropic-claude
  },
};

interface FamilyCardData {
  family: FamilyDef;
  icon: typeof Users;
  subRows: ReadonlyArray<{ label: string; meta: string }>;
  countLabel: string;
  ctaLabel: string;
  surface: string;
  isDark?: boolean;
}

function buildFamilyCards(isFr: boolean): ReadonlyArray<FamilyCardData> {
  return FAMILIES.map((family): FamilyCardData => {
    if (family.id === "collectives") {
      const subRows = COLLECTIVE_DURATIONS.map((d) => {
        const count = countFormatsByCell("collectives", d.id);
        const label = isFr ? d.labelFr : d.labelEn;
        let meta: string;
        if (d.isQuoteOnly) {
          meta = isFr ? "sur devis" : "on request";
        } else if (count === 0) {
          meta = isFr ? "Bientôt" : "Coming soon";
        } else if (count === 1) {
          meta = isFr ? "1 formation" : "1 training";
        } else {
          meta = isFr ? `${count} formations` : `${count} trainings`;
        }
        return { label, meta };
      });
      const total = countFormatsByFamily("collectives");
      const fourHPrice = getTierById(INTERVENTION_TIERS, "intervention-4h").priceFlat!;
      const entryFr = formatAmount(fourHPrice, "fr", { compact: true });
      const entryEn = formatAmount(fourHPrice, "en", { compact: true });
      return {
        family,
        icon: Users,
        subRows,
        countLabel: isFr
          ? `${total} formations · à partir de ${entryFr}`
          : `${total} trainings · starting at ${entryEn}`,
        ctaLabel: isFr ? "Voir les interventions équipes" : "See team sessions",
        surface: "bg-paper",
      };
    }
    if (family.id === "individuel") {
      const count = countFormatsByFamily("individuel");
      const subRows = [
        {
          label: isFr ? "Amorti en quelques jours" : "Pays for itself in days",
          meta: isFr ? "ROI concret" : "Concrete ROI",
        },
        {
          label: isFr ? "Gain de temps direct" : "Direct time savings",
          meta: isFr ? "Heures récupérées par semaine" : "Hours reclaimed per week",
        },
        {
          label: isFr ? "Format 1-to-1 sur mesure" : "Bespoke 1-on-1",
          meta: isFr ? "Visio ou présentiel" : "Remote or on site",
        },
      ];
      return {
        family,
        icon: User,
        subRows,
        countLabel:
          count > 0
            ? isFr
              ? `${count} coaching${count > 1 ? "s" : ""} · amorti rapide`
              : `${count} coaching${count > 1 ? "s" : ""} · quick payback`
            : isFr
              ? "Amorti en quelques jours · ROI rapide"
              : "Pays back in days · quick ROI",
        ctaLabel: isFr ? "Voir les coachings individuels" : "See individual coachings",
        surface: "bg-halo-cool",
      };
    }
    if (family.id === "dirigeants") {
      const count = countFormatsByFamily("dirigeants");
      const dirigeantsTier = getTierById(INTERVENTION_TIERS, "intervention-dirigeants");
      return {
        family,
        icon: Briefcase,
        subRows: [
          {
            label: isFr ? "Structurer votre entreprise" : "Structure your company",
            meta: isFr ? "1 ou plusieurs jours" : "1 or several days",
          },
          {
            label: isFr ? "Implémenter l'IA · gains chiffrés" : "Implement AI · quantified gains",
            meta: isFr ? "ROI précis poste/poste" : "Precise ROI role by role",
          },
          {
            label: isFr ? "1 dirigeant (pas de comité)" : "1 executive (no committee)",
            meta: isFr
              ? `À partir de ${formatAmount(dirigeantsTier.priceFlat!, "fr", { compact: true })} · 1 jour`
              : `Starting at ${formatAmount(dirigeantsTier.priceFlat!, "en", { compact: true })} · 1 day`,
          },
        ],
        countLabel: isFr
          ? `${count} format${count > 1 ? "s" : ""} · à partir de ${formatAmount(dirigeantsTier.priceFlat!, "fr", { compact: true })}`
          : `${count} format${count > 1 ? "s" : ""} · starting at ${formatAmount(dirigeantsTier.priceFlat!, "en", { compact: true })}`,
        ctaLabel: isFr ? "Voir les offres dirigeants" : "See executives offers",
        surface: "bg-mocha-rich text-mocha-fg",
        isDark: true,
      };
    }
    // Conférence — liste plate, sur devis.
    const count = countFormatsByFamily("conference");
    return {
      family,
      icon: Megaphone,
      subRows: [
        {
          label: isFr ? "Plénière 1 journée" : "1-day plenary",
          meta: isFr ? "Sur devis" : "On request",
        },
        {
          label: isFr ? "Effectif" : "Group size",
          meta: isFr ? "30+ personnes" : "30+ people",
        },
        {
          label: isFr ? "Format" : "Format",
          meta: isFr ? "Séminaires · kick-off annuels" : "Seminars · annual kick-offs",
        },
      ],
      countLabel: isFr
        ? `${count} format${count > 1 ? "s" : ""} · sur devis`
        : `${count} format${count > 1 ? "s" : ""} · on request`,
      ctaLabel: isFr ? "Voir les conférences" : "See talks",
      surface: "bg-halo-warm",
    };
  });
}

export function InterventionsFamiliesGrid({
  isFr,
  villeContext,
}: InterventionsFamiliesGridProps) {
  const loc: Locale = isFr ? "fr" : "en";
  const familyCards = buildFamilyCards(isFr);
  const villeAttr = villeContext ? { "data-source-ville": villeContext.villeSlug } : {};

  return (
    <Section
      id="familles"
      eyebrow={isFr ? "Choisir l'intervention que vous souhaitez" : "Pick the session you want"}
      title={isFr ? "4 familles" : "4 families"}
      titleEm={isFr ? "d'intervention IA" : "of AI sessions"}
      description={
        isFr
          ? "Cliquez sur une famille pour voir le détail puis pré-réservez directement sur le calendrier."
          : "Click a family to see the detail then pre-book directly on the calendar."
      }
      contentClassName={TIGHT_X}
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        {familyCards.map((card) => {
          const acc = familyAccentClasses[card.family.accent];
          const Icon = card.icon;
          const dark = card.isDark === true;
          const txt = dark ? "text-mocha-fg" : "text-fg";
          const txtSoft = dark ? "text-mocha-fg/85" : "text-fg-soft";
          const txtMuted = dark ? "text-mocha-fg/70" : "text-fg-muted";
          const href = familyPath(card.family, loc);

          return (
            <article
              key={card.family.id}
              className={cn(
                "shadow-subtle group/family relative flex h-full flex-col overflow-hidden rounded-3xl border-2 ring-1 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_22px_52px_-14px_rgba(0,0,0,0.22)]",
                card.surface,
                acc.border,
                acc.haloRing,
              )}
              {...(dark ? { "data-tone": "dark" as const } : {})}
            >
              <Link
                href={href as never}
                aria-label={`${isFr ? card.family.labelFr : card.family.labelEn} — ${card.ctaLabel}`}
                {...villeAttr}
                className="focus-visible:ring-terracotta absolute inset-0 z-[1] rounded-3xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="sr-only">{card.ctaLabel}</span>
              </Link>

              <span aria-hidden="true" className={`block h-2 w-full ${acc.line}`} />

              <div
                className={cn(
                  "relative flex flex-col items-center justify-center gap-3 py-8 sm:py-10",
                  dark ? "bg-mocha-deep/40" : `${acc.chipBg}/45`,
                )}
              >
                <span
                  className={cn(
                    "relative flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl transition-transform duration-200 group-hover/family:scale-110",
                    acc.iconBg,
                    acc.iconText,
                  )}
                >
                  <Icon aria-hidden="true" className="h-10 w-10" strokeWidth={1.75} />
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-3.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
                    acc.badge,
                  )}
                >
                  {card.countLabel}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <h2
                  className={cn(
                    "text-[clamp(1.5rem,2.4vw,2rem)] leading-tight font-semibold tracking-tight",
                    txt,
                  )}
                >
                  {isFr ? card.family.labelFr : card.family.labelEn}
                </h2>

                <p className={cn("mt-3 text-[14.5px] leading-relaxed", txtSoft)}>
                  {isFr ? card.family.taglineFr : card.family.taglineEn}
                </p>

                <ul
                  className={cn(
                    "mt-5 space-y-2 border-t pt-4",
                    dark ? "border-mocha-fg/15" : "border-border/60",
                  )}
                >
                  {card.subRows.map((row, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                    >
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 text-[13.5px] font-medium",
                          txt,
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn("inline-block h-1.5 w-1.5 rounded-full", acc.line)}
                        />
                        {row.label}
                      </span>
                      <span className={cn("text-[12px] tabular-nums", txtMuted)}>{row.meta}</span>
                    </li>
                  ))}
                </ul>

                <div className="relative z-[2] mt-auto pt-6">
                  <Link
                    href={href as never}
                    {...villeAttr}
                    className={cn(
                      "inline-flex w-full items-center justify-between gap-2 rounded-2xl px-5 py-3.5 text-[14px] font-semibold transition-colors",
                      acc.cta,
                    )}
                  >
                    <span>{card.ctaLabel}</span>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform duration-200 group-hover/family:translate-x-1"
                    />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
