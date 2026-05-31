/**
 * AuditProcessFlow — accroche « méthodologie » compacte + CTA vers la popup.
 *
 * Refonte 2026-05-31 (Will) — pour ne pas surcharger la page, le détail des
 * 8 étapes vit dans une popup (AuditMethodologyDialog). Cette section ne garde
 * qu'une intro rassurante, des chips de réassurance et un CTA « Voir la
 * méthodologie détaillée ». Écriture propre à Axion-IA (anti-plagiat).
 *
 * Server Component (le seul morceau client = le bouton/dialog importé). FR
 * canonique — EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { AuditMethodologyDialog } from "@/components/services/audit/AuditMethodologyDialog";

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

  // Aperçu visuel léger : la suite 01 → 08, sans détail (le détail = popup).
  const stepNumbers = ["01", "02", "03", "04", "05", "06", "07", "08"] as const;

  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "Notre méthodologie" : "Our methodology"}
      title={isFr ? "Un audit IA" : "An AI audit"}
      titleEm={isFr ? "rigoureux et complet" : "rigorous and complete"}
      titleTail="."
      description={
        isFr
          ? "Avant de parler d'outils, de Claude ou de ChatGPT, on comprend comment votre entreprise fonctionne vraiment. Un travail de terrain mené avec vos dirigeants et vos équipes — méthodique, du premier cadrage jusqu'à l'adoption dans la durée."
          : "Before talking tools, Claude or ChatGPT, we understand how your company really works. Field work conducted with your leadership and your teams — methodical, from the first scoping through to lasting adoption."
      }
    >
      {/* Chips de réassurance — sans durée chiffrée */}
      <ul className="flex list-none flex-wrap justify-center gap-3 p-0">
        {chips.map((c) => (
          <li
            key={c}
            className="border-terracotta/30 bg-paper text-terracotta-deep inline-flex items-center rounded-full border px-4 py-1.5 text-[13px] font-semibold"
          >
            {c}
          </li>
        ))}
      </ul>

      {/* Aperçu 01 → 08 + CTA d'ouverture de la popup */}
      <div className="mt-10 flex flex-col items-center gap-7">
        <ol className="flex list-none flex-wrap items-center justify-center gap-2 p-0">
          {stepNumbers.map((n, i) => (
            <li key={n} className="flex items-center gap-2">
              {i > 0 ? <span aria-hidden="true" className="bg-terracotta/30 h-px w-4" /> : null}
              <span className="border-terracotta/40 text-terracotta-deep bg-paper flex h-9 w-9 items-center justify-center rounded-full border text-[12.5px] font-bold tabular-nums">
                {n}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex flex-col items-center gap-3 text-center">
          <AuditMethodologyDialog isFr={isFr} />
          <p className="text-fg-muted text-[13px]">
            {isFr
              ? "8 étapes, du cadrage terrain à l'adoption — chacune avec son livrable."
              : "8 steps, from field scoping to adoption — each with its deliverable."}
          </p>
        </div>
      </div>

      {/* Adaptabilité — chaque audit est calibré */}
      <p className="text-fg-muted mx-auto mt-12 max-w-2xl text-center text-sm leading-relaxed">
        {isFr
          ? "Chaque audit est unique : le déroulé s'adapte à votre taille, votre secteur et vos enjeux — du diagnostic ciblé à la transformation globale de l'entreprise."
          : "Every audit is unique: the process adapts to your size, sector and stakes — from a focused diagnosis to a company-wide transformation."}
      </p>
    </Section>
  );
}
