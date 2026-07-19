// Server Component — card unitaire pour une formation du catalogue.
// Jumelle visuelle de `InterventionFormatCard` (même design exact : filet
// couleur, bandeau prix + effectif, badges, titre, accroche, CTA), alimentée
// par `FormationV2` (catalog-v2), NON couplée au calendrier de réservation.
// Refonte 2026-07-19 : prix FIXE public par groupe (plus de « À partir de »),
// badge = axe métier/secteur (ou catégorie), badge durée (scindable inclus).

import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowRight, Check, Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";
import {
  type FormationV2,
  getFormationV2Brackets,
  getFormationV2EntryPrice,
} from "@/content/formations/catalog-v2";
import { getCategorieMeta, getGammeMeta } from "@/content/formations/catalog-v2-meta";
import {
  FORMATION_DUREE_FACTS,
  getFormationImage,
  getFormationImageCredit,
} from "@/content/formations/catalog-v2-facts";
import { formatAmount, type FormationBracket } from "@/content/pricing";

// Accent visuel par gamme (sous-ensemble de FormatAccent — terracotta / sage /
// claude). Classes copiées à l'identique d'InterventionFormatCard pour un rendu
// pixel-identique entre les deux familles de cartes.
type CardAccent = "terracotta" | "sage" | "claude";

const accentClasses: Record<
  CardAccent,
  {
    border: string;
    title: string;
    line: string;
    cta: string;
    haloRing: string;
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
    badge: "bg-terracotta-soft text-terracotta-deep border border-terracotta/20",
    surface: "bg-paper",
  },
  sage: {
    border: "border-sage/40 hover:border-sage",
    title: "text-sage",
    line: "bg-sage",
    cta: "bg-sage text-mocha-fg hover:opacity-90",
    haloRing: "ring-sage/20",
    badge: "bg-sage-soft text-sage border border-sage/30",
    surface: "bg-sand",
  },
  // hex-ok: brand-anthropic-claude — couleurs Anthropic imposées pour la gamme Claude.
  claude: {
    border: "border-[#D97757]/40 hover:border-[#D97757]", // hex-ok: brand-anthropic-claude
    title: "text-[#9C3E1E]", // hex-ok: brand-anthropic-claude
    line: "bg-[#D97757]", // hex-ok: brand-anthropic-claude
    cta: "bg-[#D97757] text-white hover:bg-[#B85F3E]", // hex-ok: brand-anthropic-claude
    haloRing: "ring-[#D97757]/15", // hex-ok: brand-anthropic-claude
    badge: "bg-[#FFF5EC] text-[#9C3E1E] border border-[#D97757]/30", // hex-ok: brand-anthropic-claude
    surface: "bg-[#FFF5EC]", // hex-ok: brand-anthropic-claude
  },
};

/** Libellé d'effectif dérivé des tranches de la matrice prix (ex « 2 à 30 personnes »). */
function groupSizeLabel(brackets: ReadonlyArray<FormationBracket>): string {
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const b of brackets) {
    const parts = b.split("-");
    const lo = Number.parseInt(parts[0] ?? "", 10);
    const hi = Number.parseInt(parts[1] ?? "", 10);
    if (Number.isFinite(lo)) min = Math.min(min, lo);
    if (Number.isFinite(hi)) max = Math.max(max, hi);
  }
  if (!Number.isFinite(min) || max === 0) return "Effectif sur mesure";
  return `${min} à ${max} personnes`;
}

interface Props {
  formation: FormationV2;
  locale: Locale;
}

export function FormationFormatCard({ formation: f, locale }: Props): ReactNode {
  const isFr = locale === "fr";
  const gamme = getGammeMeta(f.gamme);
  const acc = accentClasses[gamme.accent];
  const href = `/formations/${f.slugFr}`;
  const ctaLabel = isFr ? "Voir le programme" : "See the programme";

  // Prix FIXE public par groupe (refonte 2026-07-19) — `formatAmount`
  // non-compact porte déjà « € HT », ne pas resuffixer.
  const entryPrice = getFormationV2EntryPrice(f);
  const priceLabel = entryPrice ? formatAmount(entryPrice, "fr") : "Sur devis";
  const groupSize = groupSizeLabel(getFormationV2Brackets(f));
  // Badge principal : axe métier/secteur (« RH », « Santé »…), sinon catégorie.
  const axeBadge = f.axeLabelFr ?? (f.categorie ? getCategorieMeta(f.categorie).shortFr : null);
  const topBadge = f.featured ? "À la une" : (axeBadge ?? gamme.labelFr);
  const dureeFacts = FORMATION_DUREE_FACTS[f.duree];
  const dureeBadge =
    f.duree === "4h"
      ? dureeFacts.heuresLabelFr
      : `${dureeFacts.joursLabelFr}${f.scindable ? " · scindable 2×1j" : ""}`;

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
        aria-label={`${f.titreFr} — ${ctaLabel}`}
        data-cta={`formation-format-${f.slugFr}-overlay`}
        className="focus-visible:ring-terracotta absolute inset-0 z-[1] rounded-3xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <span className="sr-only">{ctaLabel}</span>
      </Link>

      <span aria-hidden="true" className={`block h-1.5 w-full ${acc.line}`} />

      {/* BANDEAU IMAGE — photo dédiée par formation (Unsplash locale, SSOT
          catalog-v2-photos). Aspect fixe 16/9 → CLS=0, lazy (sous fold),
          crédit photographe en overlay (CGU §9), cliquable au-dessus du
          Link-overlay de la carte (z-[2]). */}
      {(() => {
        const img = getFormationImage(f);
        const credit = getFormationImageCredit(f);
        return (
          <div className="relative">
            <Image
              src={img.src}
              alt={img.altFr}
              width={1280}
              height={800}
              loading="lazy"
              decoding="async"
              sizes="(max-width: 768px) 100vw, 560px"
              className="aspect-[16/9] w-full object-cover"
              quality={78}
            />
            {credit ? (
              <UnsplashCredit
                photographerName={credit.name}
                photographerUrl={credit.url}
                className="bg-paper/85 absolute right-2 bottom-2 z-[2] !mt-0 rounded-full px-2 py-0.5 !text-[9.5px]"
              />
            ) : null}
          </div>
        );
      })()}

      {/* Bandeau prix + effectif */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-7 pt-6 sm:px-8">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span
            className={cn(
              "rounded-full px-4 py-1.5 text-base font-bold tracking-tight tabular-nums shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)] sm:text-lg",
              acc.cta,
            )}
          >
            {priceLabel}
          </span>
          <span className="bg-paper border-border/60 text-fg inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-semibold tracking-tight">
            <span aria-hidden="true" className="mr-1.5 opacity-60">
              👥
            </span>
            {groupSize}
          </span>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase",
            acc.badge,
          )}
        >
          {topBadge}
        </span>
      </div>

      <div className="p-7 sm:p-8">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-wide uppercase",
            acc.badge,
          )}
        >
          {dureeBadge}
        </span>

        <h3 className="text-fg mt-4 text-[clamp(1.4rem,2.2vw,1.875rem)] leading-tight font-semibold tracking-tight">
          {f.titreFr}
        </h3>

        <p className="text-fg-soft mt-4 text-[15.5px] leading-relaxed">{f.accrocheFr}</p>

        {/* CTA principale + secondaire (Nous écrire — pas de calendrier tant que
            le booking des 17 n'est pas câblé). */}
        <div className="relative z-[2] mt-7 flex flex-wrap items-center gap-3">
          <Link
            href={href as never}
            data-cta={`formation-format-${f.slugFr}-detail`}
            className={cn(
              "cta-lift inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors",
              acc.cta,
            )}
          >
            <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
            {ctaLabel}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link
            href="/contact"
            data-cta={`formation-format-${f.slugFr}-contact`}
            className="cta-lift border-terracotta-deep text-terracotta-deep hover:bg-terracotta-soft inline-flex items-center gap-2 rounded-full border-2 px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            <Mail aria-hidden="true" className="h-4 w-4" />
            {isFr ? "Nous écrire" : "Email us"}
          </Link>
        </div>
      </div>
    </article>
  );
}
