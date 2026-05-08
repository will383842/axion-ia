// Server Component — schéma visuel du hero /faq.
// Stack 3 mini-cards des 3 thématiques principales de questions :
// interventions / audit / souveraineté. Pattern hérité de
// BlogHeroSchema/ContactHeroSchema/AboutHeroSchema.
//
// Doctrine : zéro fond, accent terracotta cohérent halo-warm.

import type { ReactNode } from "react";
import { Briefcase, ClipboardCheck, ShieldCheck } from "lucide-react";

export interface FaqHeroSchemaProps {
  isFr: boolean;
  ariaLabel: string;
  className?: string;
  /** Compte total de FAQ pour la card lead. */
  totalCount: number;
}

export function FaqHeroSchema({
  isFr,
  ariaLabel,
  className,
  totalCount,
}: FaqHeroSchemaProps): ReactNode {
  const topics = isFr
    ? [
        {
          icon: Briefcase,
          eyebrow: "Thème 1",
          title: "Interventions & implémentation",
          detail: `Préparation, périmètre, livrables, support post-livraison.`,
          lead: true,
        },
        {
          icon: ClipboardCheck,
          eyebrow: "Thème 2",
          title: "Audit IA",
          detail: "4 tailles × 2 modalités, méthodologie, livrables.",
          lead: false,
        },
        {
          icon: ShieldCheck,
          eyebrow: "Thème 3",
          title: "Souveraineté & facturation",
          detail: "Données UE, RGPD, facturation B2B intracommunautaire.",
          lead: false,
        },
      ]
    : [
        {
          icon: Briefcase,
          eyebrow: "Topic 1",
          title: "Sessions & implementation",
          detail: "Preparation, scope, deliverables, post-delivery support.",
          lead: true,
        },
        {
          icon: ClipboardCheck,
          eyebrow: "Topic 2",
          title: "AI audit",
          detail: "4 sizes × 2 modalities, methodology, deliverables.",
          lead: false,
        },
        {
          icon: ShieldCheck,
          eyebrow: "Topic 3",
          title: "Sovereignty & billing",
          detail: "EU data, GDPR, EU B2B intracommunity billing.",
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
        {isFr ? `${totalCount} questions · 3 thématiques` : `${totalCount} questions · 3 topics`}
      </p>

      <div className="space-y-3.5">
        {topics.map((t) => {
          const Icon = t.icon;
          return (
            <article
              key={t.eyebrow}
              className={
                t.lead
                  ? "border-terracotta/40 bg-paper shadow-card relative rounded-2xl border-2 p-5 sm:p-6"
                  : "border-border-strong bg-paper shadow-subtle relative rounded-2xl border p-4 sm:p-5"
              }
            >
              <div className="flex items-start gap-4">
                <span
                  className={
                    t.lead
                      ? "bg-terracotta-soft text-terracotta flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14"
                      : "bg-terracotta-soft text-terracotta flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11"
                  }
                >
                  <Icon
                    aria-hidden="true"
                    className={t.lead ? "h-6 w-6 sm:h-7 sm:w-7" : "h-5 w-5"}
                    strokeWidth={2.25}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-fg-muted mb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
                    {t.eyebrow}
                  </p>
                  <p
                    className={
                      t.lead
                        ? "text-fg text-base leading-snug font-bold sm:text-lg"
                        : "text-fg text-[14.5px] leading-snug font-bold sm:text-base"
                    }
                  >
                    {t.title}
                  </p>
                  <p className="text-fg-soft mt-1 text-[12.5px] leading-snug">{t.detail}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
