// Server Component — schéma visuel du hero /comparaisons.
// Variante triangle : votre cabinet (terracotta) au centre-haut, 2
// alternatives (sage et primary) en bas — comparaison neutre et
// honnête, pas de FUD anti-concurrent.
//
// Doctrine identique aux autres HeroSchema : zéro fond, palette v3.1
// strict, pas de chiffres engagés.

import type { ReactNode } from "react";
import { Building2, Cpu, Users2 } from "lucide-react";

export interface ComparisonsHeroSchemaProps {
  isFr: boolean;
  ariaLabel: string;
  className?: string;
}

export function ComparisonsHeroSchema({
  isFr,
  ariaLabel,
  className,
}: ComparisonsHeroSchemaProps): ReactNode {
  const center = isFr
    ? {
        eyebrow: "Cabinet IA opérationnel",
        title: "Axion-IA",
        detail: "Diagnostic, plan chiffré, implémentation pilotée. Hébergement UE.",
      }
    : {
        eyebrow: "Operational AI consultancy",
        title: "Axion-IA",
        detail: "Diagnostic, costed plan, piloted implementation. EU hosting.",
      };

  const alternatives = isFr
    ? [
        {
          icon: Cpu,
          label: "SaaS générique",
          detail: "Outil prêt à l'emploi, intégration limitée à votre métier.",
        },
        {
          icon: Users2,
          label: "Internalisation",
          detail: "Recrutement IA in-house, courbe d'apprentissage longue.",
        },
      ]
    : [
        {
          icon: Cpu,
          label: "Generic SaaS",
          detail: "Off-the-shelf tool, limited fit with your business.",
        },
        {
          icon: Users2,
          label: "In-house team",
          detail: "Hiring AI talent in-house, long learning curve.",
        },
      ];

  return (
    <div role="img" aria-label={ariaLabel} className={className ?? "hero-schema"}>
      {/* CENTRE — votre cabinet (signal premium terracotta) */}
      <div className="border-terracotta/40 bg-paper shadow-card relative rounded-2xl border-2 p-4 sm:p-5">
        <p className="text-terracotta-deep mb-2 text-[10px] font-semibold tracking-[0.18em] uppercase sm:text-[11px]">
          <span
            aria-hidden="true"
            className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
          />
          {center.eyebrow}
        </p>
        <div className="flex items-center gap-3">
          <span className="bg-terracotta-soft text-terracotta-deep flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <Building2 aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p
              className="text-fg text-2xl leading-tight font-medium tracking-tight italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {center.title}
            </p>
            <p className="text-fg-soft mt-0.5 text-[12.5px] leading-snug">{center.detail}</p>
          </div>
        </div>
      </div>

      {/* Connecteurs en V vers les 2 alternatives */}
      <div aria-hidden="true" className="relative h-6">
        <div className="bg-border-strong absolute top-0 left-1/4 h-full w-0.5 origin-top -rotate-12" />
        <div className="bg-border-strong absolute top-0 right-1/4 h-full w-0.5 origin-top rotate-12" />
      </div>

      {/* 2 ALTERNATIVES — sage à gauche, primary à droite */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {alternatives.map((alt, i) => {
          const Icon = alt.icon;
          const accent = i === 0 ? "sage" : "primary";
          return (
            <div
              key={alt.label}
              className={`bg-paper shadow-subtle relative rounded-xl border-2 p-3.5 ${
                accent === "sage" ? "border-sage/40" : "border-primary/40"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                    accent === "sage" ? "bg-sage-soft text-sage" : "bg-primary-soft text-primary"
                  }`}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <p className="text-fg text-[14px] leading-tight font-bold sm:text-[15px]">
                    {alt.label}
                  </p>
                  <p className="text-fg-soft mt-0.5 text-[12px] leading-snug">{alt.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Note bas de schéma — comparaison neutre */}
      <p className="text-fg-muted mt-4 text-center text-[11px] leading-relaxed tracking-[0.06em] uppercase">
        {isFr
          ? "Comparaison factuelle · pas de FUD · pas de complaisance"
          : "Factual comparison · no FUD · no complacency"}
      </p>
    </div>
  );
}
