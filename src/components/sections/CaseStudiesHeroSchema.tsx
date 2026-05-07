// Server Component — schéma visuel du hero /cas-concrets.
// Stack de 3 mini-cards de cas clients avec métriques chiffrées,
// effet "pile" en perspective légère pour suggérer "il y en a plein".
//
// Doctrine : zéro fond (transparent). Accent sage (couleur module Cas
// concrets selon CLAUDE.md v6 + ADR 0002). Pas d'animation ; SSR-friendly.
//
// Les métriques affichées sont des EXEMPLES anonymisés (secteur + taille
// + métrique). À remplacer par de vraies données quand 5-10 cas seront
// livrés.

import type { ReactNode } from "react";
import {
  Factory,
  Briefcase,
  Store,
  TrendingUp,
  Clock,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface CaseStudiesHeroSchemaProps {
  isFr: boolean;
  ariaLabel: string;
  className?: string;
}

interface CaseTileData {
  icon: LucideIcon;
  industry: string;
  size: string;
  metricIcon: LucideIcon;
  metricValue: string;
  metricLabel: string;
}

export function CaseStudiesHeroSchema({
  isFr,
  ariaLabel,
  className,
}: CaseStudiesHeroSchemaProps): ReactNode {
  const cases: ReadonlyArray<CaseTileData> = isFr
    ? [
        {
          icon: Factory,
          industry: "Industrie",
          size: "50-249 collab.",
          metricIcon: Clock,
          metricValue: "+12 h",
          metricLabel: "gagnées par sem. sur les saisies",
        },
        {
          icon: Briefcase,
          industry: "Conseil & juridique",
          size: "10-49 collab.",
          metricIcon: Wallet,
          metricValue: "−28 %",
          metricLabel: "de dépenses prestations externes",
        },
        {
          icon: Store,
          industry: "Retail multi-sites",
          size: "250+ collab.",
          metricIcon: TrendingUp,
          metricValue: "+18 %",
          metricLabel: "de conversion sur les requêtes SAV",
        },
      ]
    : [
        {
          icon: Factory,
          industry: "Manufacturing",
          size: "50-249 staff",
          metricIcon: Clock,
          metricValue: "+12 h",
          metricLabel: "saved per week on data entry",
        },
        {
          icon: Briefcase,
          industry: "Consulting & legal",
          size: "10-49 staff",
          metricIcon: Wallet,
          metricValue: "−28 %",
          metricLabel: "external services spending",
        },
        {
          icon: Store,
          industry: "Multi-site retail",
          size: "250+ staff",
          metricIcon: TrendingUp,
          metricValue: "+18 %",
          metricLabel: "conversion on support inquiries",
        },
      ];

  return (
    <div role="img" aria-label={ariaLabel} className={className ?? "hero-schema"}>
      {/* Légende au-dessus de la pile */}
      <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.18em] uppercase">
        <span
          aria-hidden="true"
          className="bg-sage mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
        />
        {isFr ? "Cas réels · 3 exemples" : "Real cases · 3 examples"}
      </p>

      {/* Stack de 3 cards — la première en avant (z-3), les autres en arrière
          avec un léger translate-y et opacity pour effet "pile". */}
      <div className="space-y-3.5">
        {cases.map((c, i) => {
          const Icon = c.icon;
          const MetricIcon = c.metricIcon;
          // Card #0 (top) = pleine prominence ; #1 et #2 légèrement réduites.
          const isLead = i === 0;

          return (
            <article
              key={c.industry}
              className={
                isLead
                  ? "border-sage/40 bg-paper shadow-card relative rounded-2xl border-2 p-5 sm:p-6"
                  : "border-border-strong bg-paper shadow-subtle relative rounded-2xl border p-4 sm:p-5"
              }
            >
              <div className="flex items-start gap-4">
                {/* Icône secteur */}
                <span
                  className={
                    isLead
                      ? "bg-sage-soft text-sage flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14"
                      : "bg-sage-soft text-sage flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11"
                  }
                >
                  <Icon
                    aria-hidden="true"
                    className={isLead ? "h-6 w-6 sm:h-7 sm:w-7" : "h-5 w-5"}
                    strokeWidth={2.25}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={
                      isLead
                        ? "text-fg text-base leading-tight font-bold sm:text-lg"
                        : "text-fg text-[14.5px] leading-tight font-bold sm:text-base"
                    }
                  >
                    {c.industry}
                  </p>
                  <p className="text-fg-muted mt-0.5 text-[12.5px]">{c.size}</p>
                </div>

                {/* Métrique en gros — serif italique sage (couleur module) */}
                <div className="text-right">
                  <p
                    className={
                      isLead
                        ? "text-sage text-2xl leading-none font-medium tracking-tight italic tabular-nums sm:text-3xl"
                        : "text-sage text-xl leading-none font-medium tracking-tight italic tabular-nums sm:text-2xl"
                    }
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {c.metricValue}
                  </p>
                  <p className="text-fg-soft mt-1 flex items-center justify-end gap-1 text-[11px] leading-snug">
                    <MetricIcon
                      aria-hidden="true"
                      className="text-sage h-3 w-3"
                      strokeWidth={2.5}
                    />
                    <span className="max-w-[140px] text-right sm:max-w-[180px]">
                      {c.metricLabel}
                    </span>
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Footer signal — "et beaucoup d'autres" */}
      <p className="text-fg-muted mt-4 text-center text-[12px]">
        {isFr ? "+ d'autres cas dans le listing ↓" : "+ more cases in the listing ↓"}
      </p>
    </div>
  );
}
