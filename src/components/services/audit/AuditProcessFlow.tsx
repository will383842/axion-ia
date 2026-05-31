/**
 * AuditProcessFlow — « Comment se déroule votre audit », en 4 cartes-étapes
 * détaillées sur une ligne (Server Component).
 *
 * Refonte 2026-05-31 (Will) — déroulé concret de l'audit, assez détaillé pour
 * qu'un prospect comprenne exactement ce qu'il se passe à chaque étape (titre +
 * 2-3 points concrets), tout en restant visuel et scannable. On insiste sur
 * l'échange avec les dirigeants ET les collaborateurs (cœur de l'entreprise).
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
  readonly points: ReadonlyArray<string>;
}

export interface AuditProcessFlowProps {
  readonly isFr: boolean;
}

export function AuditProcessFlow({ isFr }: AuditProcessFlowProps): ReactNode {
  const chips: ReadonlyArray<string> = isFr
    ? [
        "Durée calibrée sur votre besoin",
        "Dirigeants + collaborateurs",
        "Impact minimal sur vos équipes",
      ]
    : ["Duration tailored to your need", "Leadership + teams", "Minimal impact on your teams"];

  const steps: ReadonlyArray<Step> = [
    {
      n: "01",
      icon: Compass,
      title: isFr ? "Cadrage de la mission" : "Mission scoping",
      points: isFr
        ? [
            "On échange avec les dirigeants et les équipes pour entrer au cœur de l'entreprise.",
            "Objectifs, contraintes métier, clients et fournisseurs.",
            "Périmètre prioritaire défini ensemble + NDA.",
          ]
        : [
            "We talk with leadership and teams to reach the heart of the company.",
            "Goals, business constraints, clients and suppliers.",
            "Priority scope defined together + NDA.",
          ],
    },
    {
      n: "02",
      icon: Users,
      title: isFr ? "Entretiens terrain" : "Field interviews",
      points: isFr
        ? [
            "Directions et collaborateurs concernés, sur site ou à distance.",
            "Pratiques réelles, points de friction, tâches clés.",
            "Analyse des process et des outils déjà en place.",
          ]
        : [
            "Management and the teams involved, on site or remotely.",
            "Real practices, friction points, key tasks.",
            "Review of existing processes and tools.",
          ],
    },
    {
      n: "03",
      icon: Search,
      title: isFr ? "Analyse & recherche" : "Analysis & research",
      points: isFr
        ? [
            "Veille structurée sur les technologies IA pertinentes.",
            "Cas d'usage comparables dans votre secteur.",
            "Des pistes crédibles, réalistes, adaptées à vos contraintes.",
          ]
        : [
            "Structured scan of the relevant AI technologies.",
            "Comparable use cases in your sector.",
            "Credible, realistic leads fit to your constraints.",
          ],
    },
    {
      n: "04",
      icon: ListFilter,
      title: isFr ? "Filtrage & priorisation" : "Filtering & prioritisation",
      points: isFr
        ? [
            "Limites, contraintes et risques passés au crible du terrain.",
            "Priorisation par impact réel et faisabilité.",
            "Une short-list d'options à fort potentiel à approfondir.",
          ]
        : [
            "Limits, constraints and risks tested against the field.",
            "Prioritised by real impact and feasibility.",
            "A shortlist of high-potential options to deepen.",
          ],
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
          ? "Un travail de terrain mené avec vos dirigeants et vos équipes — pas une analyse théorique. Quatre étapes claires, du cadrage à une feuille de route prête à exécuter."
          : "Field work conducted with your leadership and your teams — not a theoretical analysis. Four clear steps, from scoping to a roadmap ready to execute."
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

      {/* 4 cartes-étapes sur une ligne (desktop), détaillées */}
      <ol className="grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <li
              key={s.n}
              className="bg-paper border-border shadow-subtle hover:border-terracotta/50 flex h-full flex-col rounded-2xl border p-6 transition-colors"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span
                  className="text-terracotta-deep text-3xl leading-none font-bold tabular-nums"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {s.n}
                </span>
                <span className="bg-terracotta-soft text-terracotta-deep flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                </span>
              </div>
              <h3 className="text-fg text-base leading-tight font-semibold tracking-tight">
                {s.title}
              </h3>
              <ul className="text-fg-soft mt-3 list-none space-y-2 p-0 text-[13px] leading-snug">
                {s.points.map((pt) => (
                  <li key={pt} className="flex gap-2">
                    <span aria-hidden="true" className="text-terracotta mt-[3px] leading-none">
                      ·
                    </span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
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
