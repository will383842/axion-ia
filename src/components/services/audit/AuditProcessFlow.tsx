/**
 * AuditProcessFlow — « Comment se déroule votre audit », en 4 blocs numérotés
 * sur une seule ligne (Server Component).
 *
 * Refonte 2026-05-31 (Will) — déroulé concret de l'audit en flow horizontal
 * visuel (01 → 04) relié par un connecteur, chips de durée, micro-ligne de
 * livrable. Volontairement peu de texte : chaque étape = un titre + une ligne.
 * Écriture propre à Axion-IA (pas de paraphrase du marché).
 *
 * Server Component pur, zéro JS (budget Web Vitals). FR canonique — EN =
 * miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { Compass, Users, Search, ListFilter, type LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";

interface Step {
  readonly n: string;
  readonly icon: LucideIcon;
  readonly title: string;
  readonly sub: string;
}

export interface AuditProcessFlowProps {
  readonly isFr: boolean;
}

export function AuditProcessFlow({ isFr }: AuditProcessFlowProps): ReactNode {
  const chips: ReadonlyArray<string> = isFr
    ? ["≈ 6 semaines", "≈ 2 jours / semaine", "Impact minimal sur vos équipes"]
    : ["≈ 6 weeks", "≈ 2 days / week", "Minimal impact on your teams"];

  const steps: ReadonlyArray<Step> = [
    {
      n: "01",
      icon: Compass,
      title: isFr ? "Cadrage" : "Scoping",
      sub: isFr
        ? "Objectifs, périmètre et NDA avec les dirigeants."
        : "Goals, scope and NDA with leadership.",
    },
    {
      n: "02",
      icon: Users,
      title: isFr ? "Entretiens terrain" : "Field interviews",
      sub: isFr
        ? "Vos pratiques et points de friction réels."
        : "Your real practices and friction points.",
    },
    {
      n: "03",
      icon: Search,
      title: isFr ? "Analyse & veille" : "Analysis & research",
      sub: isFr
        ? "Cas d'usage comparables, pistes crédibles."
        : "Comparable use cases, credible leads.",
    },
    {
      n: "04",
      icon: ListFilter,
      title: isFr ? "Filtrage des options" : "Option filtering",
      sub: isFr
        ? "Faisabilité, risques : une short-list priorisée."
        : "Feasibility, risks: a prioritised shortlist.",
    },
  ];

  return (
    <Section
      className="py-16 sm:py-20 lg:py-24"
      eyebrow={isFr ? "Le déroulé" : "How it unfolds"}
      title={isFr ? "Comment se déroule" : "How"}
      titleEm={isFr ? "votre audit" : "your audit unfolds"}
      titleTail="."
      description={
        isFr
          ? "Un travail de terrain, pas une analyse théorique. Quatre étapes pour passer du flou à une feuille de route prête à exécuter."
          : "Field work, not a theoretical analysis. Four steps to move from fog to a roadmap ready to execute."
      }
    >
      {/* Chips de durée — pratique, sans verbiage */}
      <ul className="mb-12 flex list-none flex-wrap justify-center gap-3 p-0">
        {chips.map((c) => (
          <li
            key={c}
            className="border-border-strong/40 text-fg-soft bg-paper inline-flex items-center rounded-full border px-4 py-1.5 text-[13px] font-semibold"
          >
            {c}
          </li>
        ))}
      </ul>

      {/* Flow horizontal 01 → 04 relié par un connecteur (desktop) */}
      <ol className="relative grid list-none gap-8 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {/* Connecteur horizontal derrière les nœuds (lg) */}
        <div
          aria-hidden="true"
          className="bg-border-strong/40 absolute top-7 right-[12%] left-[12%] hidden h-px lg:block"
        />
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <li
              key={s.n}
              className="relative flex flex-col items-center text-center lg:items-start lg:text-left"
            >
              {/* Nœud numéroté sur le connecteur */}
              <div className="bg-paper border-terracotta shadow-subtle relative z-[1] mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2">
                <span
                  className="text-terracotta-deep text-lg font-bold tabular-nums"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {s.n}
                </span>
              </div>
              <span className="bg-terracotta-soft text-terracotta-deep mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-xl">
                <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </span>
              <h3 className="text-fg text-[15.5px] leading-tight font-semibold tracking-tight">
                {s.title}
              </h3>
              <p className="text-fg-soft mt-1.5 text-[13px] leading-snug">{s.sub}</p>
            </li>
          );
        })}
      </ol>

      {/* Livrable — micro-ligne de sortie */}
      <p className="text-fg-muted mx-auto mt-12 max-w-2xl text-center text-sm leading-relaxed">
        <span className="text-terracotta-deep font-semibold">{"→ "}</span>
        {isFr
          ? "Vision claire, leviers chiffrés, feuille de route actionnable — et la même équipe pour l'exécuter."
          : "Clear vision, costed levers, an actionable roadmap — and the same team to execute it."}
      </p>
    </Section>
  );
}
