/**
 * AuditProcessFlow — accroche « méthodologie » compacte + visuel 8 étapes + CTA
 * vers la popup détaillée.
 *
 * Refonte 2026-05-31 (Will) — pour ne pas surcharger la page, le détail des
 * 8 étapes vit dans une popup (AuditMethodologyDialog). Cette section garde une
 * intro rassurante, des chips, un aperçu 01 → 08, le visuel illustré de la
 * méthodologie, puis le CTA d'ouverture. Écriture propre à Axion-IA.
 *
 * Server Component (le seul morceau client = le bouton/dialog importé). FR
 * canonique — EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import Image from "next/image";
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
      tone="paper"
      eyebrow={isFr ? "Notre méthodologie" : "Our methodology"}
      title={isFr ? "Un audit IA" : "An AI audit"}
      titleEm={isFr ? "rigoureux et complet" : "rigorous and complete"}
      titleTail="."
      description={
        isFr
          ? "Avant de parler d'outils, de Claude, de ChatGPT ou de tout autre LLM, on comprend comment votre entreprise fonctionne vraiment. Un travail de terrain mené avec vos dirigeants et vos équipes — méthodique, du premier cadrage jusqu'à l'adoption dans la durée."
          : "Before talking tools, Claude, ChatGPT or any other LLM, we understand how your company really works. Field work conducted with your leadership and your teams — methodical, from the first scoping through to lasting adoption."
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

      {/* Aperçu 01 → 08 */}
      <ol className="mt-10 flex list-none flex-wrap items-center justify-center gap-2 p-0">
        {stepNumbers.map((n, i) => (
          <li key={n} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden="true" className="bg-terracotta/30 h-px w-4" /> : null}
            <span className="border-terracotta/40 text-terracotta-deep bg-paper flex h-9 w-9 items-center justify-center rounded-full border text-[12.5px] font-bold tabular-nums">
              {n}
            </span>
          </li>
        ))}
      </ol>

      {/* Visuel illustré de la méthodologie — quasi pleine largeur, sans cadre
          (le fond blanc de l'image se fond dans la section paper). `unoptimized`
          = pas de recompression next/image → texte net (graphique riche en texte). */}
      <figure className="m-0 mt-2 w-full">
        <Image
          src="/illustrations/methodologie-audit-ia-8-etapes-v4.webp"
          alt={
            isFr
              ? "Méthodologie d'audit IA Axion-IA en 8 étapes illustrées : 01 cadrage de la mission et des objectifs, 02 entretiens métier et qualification, 03 consolidation et analyse approfondie, 04 pré-évaluation et filtrage des options, 05 évaluation et recommandations chiffrées (ROI), 06 restitution et feuille de route IA, 07 mise en œuvre des recommandations, 08 adoption, formation et pilotage dans la durée — chaque étape avec son livrable."
              : "Axion-IA AI audit methodology in 8 illustrated steps: 01 mission and objectives scoping, 02 business interviews and qualification, 03 consolidation and deep analysis, 04 pre-assessment and option filtering, 05 evaluation and costed recommendations (ROI), 06 read-out and AI roadmap, 07 implementing the recommendations, 08 adoption, training and long-term steering — each step with its deliverable."
          }
          width={1975}
          height={569}
          loading="lazy"
          decoding="async"
          unoptimized
          className="h-auto w-full"
        />
        <figcaption className="sr-only">
          {isFr
            ? "Les 8 étapes de la méthodologie d'audit IA Axion-IA, du cadrage à l'adoption dans la durée."
            : "The 8 steps of the Axion-IA AI audit methodology, from scoping to lasting adoption."}
        </figcaption>
      </figure>

      {/* CTA d'ouverture de la popup détaillée — sous l'image */}
      <div className="mt-8 flex justify-center">
        <AuditMethodologyDialog isFr={isFr} />
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
