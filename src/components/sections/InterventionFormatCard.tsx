// Server Component — card unitaire pour un format d'intervention.
// Utilisée par toutes les pages listing (collectives/[duree], individuel,
// éventuellement dirigeants quand un hub famille y sera créé).
//
// Sprint 14.10.7 (2026-05-11) — refonte taxonomique /interventions.

import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";
import type { FormatAccent, InterventionFormatEntry } from "@/content/interventions-taxonomy";
import { formatPath } from "@/content/interventions-taxonomy";

interface Props {
  entry: InterventionFormatEntry;
  locale: Locale;
}

const accentClasses: Record<
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
    surface: string;
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
    surface: "bg-paper",
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
    surface: "bg-halo-cool",
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
    surface: "bg-sand",
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
    surface: "bg-mocha-rich text-mocha-fg",
  },
  // hex-ok: brand-anthropic-claude — couleurs Anthropic imposées pour la card
  // Intervention Claude.
  claude: {
    border: "border-[#D97757]/40 hover:border-[#D97757]", // hex-ok: brand-anthropic-claude
    title: "text-[#9C3E1E]", // hex-ok: brand-anthropic-claude
    line: "bg-[#D97757]", // hex-ok: brand-anthropic-claude
    cta: "bg-[#D97757] text-white hover:bg-[#B85F3E]", // hex-ok: brand-anthropic-claude
    haloRing: "ring-[#D97757]/15", // hex-ok: brand-anthropic-claude
    chipBg: "bg-[#FFF5EC]", // hex-ok: brand-anthropic-claude
    chipText: "text-[#9C3E1E]", // hex-ok: brand-anthropic-claude
    badge: "bg-[#FFF5EC] text-[#9C3E1E] border border-[#D97757]/30", // hex-ok: brand-anthropic-claude
    surface: "bg-[#FFF5EC]", // hex-ok: brand-anthropic-claude
  },
};

export function InterventionFormatCard({ entry, locale }: Props): ReactNode {
  const isFr = locale === "fr";
  const acc = accentClasses[entry.accent];
  const dark = entry.accent === "mocha";
  const txt = dark ? "text-mocha-fg" : "text-fg";
  const txtSoft = dark ? "text-mocha-fg/85" : "text-fg-soft";
  const href = formatPath(entry, locale);
  const ctaLabel = isFr ? "Voir cette intervention en détail" : "See this session in detail";

  return (
    <article
      className={cn(
        "shadow-subtle group/card hover:shadow-card relative overflow-hidden rounded-3xl border-2 ring-1 transition-shadow",
        acc.surface,
        acc.border,
        acc.haloRing,
      )}
    >
      <Link
        href={href as never}
        aria-label={`${isFr ? entry.labelFr : entry.labelEn} — ${ctaLabel}`}
        className="focus-visible:ring-terracotta absolute inset-0 z-[1] rounded-3xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <span className="sr-only">{ctaLabel}</span>
      </Link>

      <span aria-hidden="true" className={`block h-1.5 w-full ${acc.line}`} />

      {/* Bandeau prix + effectif */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-7 pt-6 sm:px-8">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span
            className={cn(
              "rounded-full px-4 py-1.5 text-base font-bold tracking-tight tabular-nums shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)] sm:text-lg",
              acc.cta,
            )}
          >
            {isFr ? entry.priceFr : entry.priceEn}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-semibold tracking-tight",
              dark
                ? "bg-mocha-soft border-mocha-fg/20 text-mocha-fg"
                : "bg-paper border-border/60 text-fg",
            )}
          >
            <span aria-hidden="true" className="mr-1.5 opacity-60">
              👥
            </span>
            {isFr ? entry.groupSizeFr : entry.groupSizeEn}
          </span>
        </div>
        {entry.badgeFr || entry.badgeEn ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase",
              acc.badge,
            )}
          >
            {isFr ? entry.badgeFr : entry.badgeEn}
          </span>
        ) : null}
      </div>

      <div className="p-7 sm:p-8">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-wide uppercase",
            acc.badge,
          )}
        >
          {isFr ? entry.audienceFr : entry.audienceEn}
        </span>

        <h3
          className={cn(
            "mt-4 text-[clamp(1.4rem,2.2vw,1.875rem)] leading-tight font-semibold tracking-tight",
            txt,
          )}
        >
          {isFr ? entry.labelFr : entry.labelEn}
        </h3>

        <p className={cn("mt-4 text-[15.5px] leading-relaxed", txtSoft)}>
          {isFr ? entry.taglineFr : entry.taglineEn}
        </p>

        {/* CTA principale */}
        <div className="relative z-[2] mt-7 flex flex-wrap items-center gap-3">
          <Link
            href={href as never}
            className={cn(
              "cta-lift inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors",
              acc.cta,
            )}
          >
            <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
            {ctaLabel}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          {!href.includes("/contact") && !href.includes("/reserver") ? (
            <Link
              href="/reserver"
              className={cn(
                "cta-lift inline-flex items-center gap-2 rounded-full border-2 px-5 py-2.5 text-sm font-semibold transition-colors",
                dark
                  ? "border-mocha-fg/40 text-mocha-fg hover:bg-mocha-fg/10"
                  : "border-terracotta-deep text-terracotta-deep hover:bg-terracotta-soft",
              )}
            >
              {isFr ? "Pré-réservez sur le calendrier" : "Pre-book on the calendar"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
