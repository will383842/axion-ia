// Server Component — schéma visuel du hero /a-propos.
// Stack 3 mini-cards illustrant les 3 piliers Axion-IA : opérationnel
// d'abord, ROI mesurable, souveraineté UE. Pattern hérité de BlogHeroSchema /
// ContactHeroSchema — accent terracotta éditorial, .hero-schema cap 36rem v3.2.
//
// Doctrine : zéro fond (transparent), accent terracotta cohérent avec
// le hero halo-warm. Pas d'animation, SSR-friendly.

import type { ReactNode } from "react";
import { Wrench, BarChart3, ShieldCheck } from "lucide-react";

export interface AboutHeroSchemaProps {
  isFr: boolean;
  ariaLabel: string;
  className?: string;
}

export function AboutHeroSchema({ isFr, ariaLabel, className }: AboutHeroSchemaProps): ReactNode {
  const pillars = isFr
    ? [
        {
          icon: Wrench,
          eyebrow: "Pilier 1",
          title: "Opérationnel d'abord",
          detail: "Aucune intervention sans démonstration sur vos données réelles.",
          lead: true,
        },
        {
          icon: BarChart3,
          eyebrow: "Pilier 2",
          title: "ROI mesurable",
          detail: "Plan d'action chiffré priorisé, support post-livraison inclus.",
          lead: false,
        },
        {
          icon: ShieldCheck,
          eyebrow: "Pilier 3",
          title: "Souveraineté UE",
          detail: "Hébergement UE par défaut, modèles open-source quand pertinent.",
          lead: false,
        },
      ]
    : [
        {
          icon: Wrench,
          eyebrow: "Pillar 1",
          title: "Operational first",
          detail: "No engagement without a live demo on your real data.",
          lead: true,
        },
        {
          icon: BarChart3,
          eyebrow: "Pillar 2",
          title: "Measurable ROI",
          detail: "Costed prioritised action plan, post-delivery support included.",
          lead: false,
        },
        {
          icon: ShieldCheck,
          eyebrow: "Pillar 3",
          title: "EU sovereignty",
          detail: "EU hosting by default, open-source models when relevant.",
          lead: false,
        },
      ];

  return (
    <div role="img" aria-label={ariaLabel} className={className ?? "hero-schema"}>
      <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.18em] uppercase">
        <span
          aria-hidden="true"
          className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
        />
        {isFr ? "Doctrine Axion-IA · 3 piliers" : "Axion-IA doctrine · 3 pillars"}
      </p>

      <div className="space-y-3.5">
        {pillars.map((p) => {
          const Icon = p.icon;
          return (
            <article
              key={p.eyebrow}
              className={
                p.lead
                  ? "border-terracotta/40 bg-paper shadow-card relative rounded-2xl border-2 p-5 sm:p-6"
                  : "border-border-strong bg-paper shadow-subtle relative rounded-2xl border p-4 sm:p-5"
              }
            >
              <div className="flex items-start gap-4">
                <span
                  className={
                    p.lead
                      ? "bg-terracotta-soft text-terracotta flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14"
                      : "bg-terracotta-soft text-terracotta flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11"
                  }
                >
                  <Icon
                    aria-hidden="true"
                    className={p.lead ? "h-6 w-6 sm:h-7 sm:w-7" : "h-5 w-5"}
                    strokeWidth={2.25}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-fg-muted mb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
                    {p.eyebrow}
                  </p>
                  <p
                    className={
                      p.lead
                        ? "text-fg text-base leading-snug font-bold sm:text-lg"
                        : "text-fg text-[14.5px] leading-snug font-bold sm:text-base"
                    }
                  >
                    {p.title}
                  </p>
                  <p className="text-fg-soft mt-1 text-[12.5px] leading-snug">{p.detail}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
