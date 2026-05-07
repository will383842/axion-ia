// Server Component — schéma visuel paramétré pour les pages détail
// produit (`/interventions/{slug}`, `/audit/{slug}`).
//
// Pattern : flow vertical 3-4 blocs (timeline d'une journée d'intervention,
// ou 3 livrables d'un niveau d'audit). Chaque bloc = card avec icône
// Lucide + label + détail. Accent paramétrable selon le module.
//
// Doctrine identique à AuditHeroSchema/MethodologyHeroSchema : zéro fond,
// pas de halos massifs, pas de grille. Chaque bloc est autonome.

import type { ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

type DetailAccent = "primary" | "purple" | "orange" | "green" | "terracotta";

export interface DetailHeroBlock {
  icon: LucideIcon;
  label: string;
  detail: string;
  /** Optionnel — préfixe (ex "01" / "Matin" / "Livrable A"). */
  prefix?: string;
}

export interface DetailHeroSchemaProps {
  /** Eyebrow uppercase au-dessus du titre du schéma. */
  eyebrow: string;
  /** Titre court du schéma (ex "Une journée type" / "Vos livrables"). */
  title: string;
  /** Accent éditorial — détermine la couleur du dot et de la bordure. */
  accent: DetailAccent;
  /** 2 à 5 blocs empilés verticalement. */
  blocks: ReadonlyArray<DetailHeroBlock>;
  /** Texte alternatif pour les lecteurs d'écran. */
  ariaLabel: string;
  className?: string;
}

const ACCENT_DOT: Record<DetailAccent, string> = {
  primary: "bg-primary",
  purple: "bg-accent-purple",
  orange: "bg-accent-orange",
  green: "bg-accent-green",
  terracotta: "bg-terracotta",
};

const ACCENT_BORDER: Record<DetailAccent, string> = {
  primary: "border-primary/40",
  purple: "border-accent-purple/40",
  orange: "border-accent-orange/40",
  green: "border-accent-green/40",
  terracotta: "border-terracotta/40",
};

const ACCENT_BG: Record<DetailAccent, string> = {
  primary: "bg-primary-soft",
  purple: "bg-accent-purple/10",
  orange: "bg-accent-orange/10",
  green: "bg-accent-green/10",
  terracotta: "bg-terracotta-soft",
};

const ACCENT_FG: Record<DetailAccent, string> = {
  primary: "text-primary",
  purple: "text-accent-purple",
  orange: "text-accent-orange",
  green: "text-accent-green",
  terracotta: "text-terracotta-deep",
};

export function DetailHeroSchema({
  eyebrow,
  title,
  accent,
  blocks,
  ariaLabel,
  className,
}: DetailHeroSchemaProps): ReactNode {
  return (
    <div role="img" aria-label={ariaLabel} className={className ?? "hero-schema"}>
      {/* En-tête éditorial du schéma */}
      <div className={`bg-halo-warm rounded-2xl border-2 p-4 sm:p-5 ${ACCENT_BORDER[accent]}`}>
        <p
          className={`mb-2 text-[10px] font-semibold tracking-[0.18em] uppercase sm:text-[11px] ${ACCENT_FG[accent]}`}
        >
          <span
            aria-hidden="true"
            className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${ACCENT_DOT[accent]}`}
          />
          {eyebrow}
        </p>
        <p
          className="text-fg text-xl leading-tight font-medium tracking-tight italic sm:text-2xl"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {title}
        </p>
      </div>

      {/* Connecteur vertical fin */}
      <div aria-hidden="true" className="bg-border-strong mx-auto h-4 w-0.5" />

      {/* Blocs empilés — 1 card par bloc */}
      <ol className="space-y-2.5">
        {blocks.map((b, i) => {
          const Icon = b.icon;
          const num = b.prefix ?? String(i + 1).padStart(2, "0");
          return (
            <li
              key={i}
              className={`bg-paper shadow-subtle relative flex items-start gap-3 rounded-xl border-2 p-3.5 sm:p-4 ${ACCENT_BORDER[accent]}`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 text-[10px] font-bold tracking-[0.12em] uppercase tabular-nums ${ACCENT_FG[accent]}`}
              >
                {num}
              </span>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${ACCENT_BG[accent]} ${ACCENT_FG[accent]}`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <p className="text-fg text-[14px] leading-tight font-bold sm:text-[15px]">
                  {b.label}
                </p>
                <p className="text-fg-soft mt-0.5 text-[12px] leading-snug sm:text-[12.5px]">
                  {b.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
