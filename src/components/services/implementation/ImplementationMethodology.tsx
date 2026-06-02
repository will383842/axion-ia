/**
 * ImplementationMethodology — « Notre méthodologie » : intro rassurante (façon
 * AuditProcessFlow, « avant de coder, on comprend ») + 4 étapes via le composant
 * partagé ProcessSteps. Écriture propre à Axion-IA, SANS durée ni taille
 * d'équipe (anti-plagiat, et le déroulé dépend du projet).
 *
 * Server Component pur, zéro JS. Aucun prix. FR canonique — EN = miroir
 * (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { ProcessSteps } from "@/components/sections/ProcessSteps";

export interface ImplementationMethodologyProps {
  readonly isFr: boolean;
}

export function ImplementationMethodology({ isFr }: ImplementationMethodologyProps): ReactNode {
  const chips: ReadonlyArray<string> = isFr
    ? ["Sprints courts", "Démos régulières", "Code livré, à vous"]
    : ["Short sprints", "Regular demos", "Code delivered, yours"];

  const steps = isFr
    ? [
        {
          id: "cadrage",
          title: "Cadrage & conception",
          description:
            "On part de votre besoin réel : ateliers métier, choix de l'architecture, backlog priorisé et spécifications claires. Vous savez exactement ce qu'on va construire, et pourquoi.",
        },
        {
          id: "developpement",
          title: "Développement itératif",
          description:
            "On construit par sprints courts, avec des démos régulières et une validation métier à chaque étape. Pas d'effet tunnel : vous voyez la solution prendre forme.",
        },
        {
          id: "mise-en-prod",
          title: "Recette & mise en production",
          description:
            "Tests, corrections, puis passage en production sur vos outils. Le code et la documentation vous sont livrés, et vos équipes sont formées pour être autonomes.",
        },
        {
          id: "suivi",
          title: "Suivi & évolution",
          description:
            "Un support inclus à la livraison pour les ajustements. Ensuite, vous faites évoluer à la demande — sans abonnement ni maintenance imposée.",
        },
      ]
    : [
        {
          id: "cadrage",
          title: "Scoping & design",
          description:
            "We start from your real need: business workshops, architecture choices, a prioritised backlog and clear specs. You know exactly what we'll build, and why.",
        },
        {
          id: "developpement",
          title: "Iterative development",
          description:
            "We build in short sprints, with regular demos and business validation at every step. No tunnel effect: you watch the solution take shape.",
        },
        {
          id: "mise-en-prod",
          title: "QA & go-live",
          description:
            "Testing, fixes, then go-live on your tools. The code and documentation are delivered to you, and your teams are trained to be autonomous.",
        },
        {
          id: "suivi",
          title: "Support & evolution",
          description:
            "Included support at delivery for adjustments. Then you evolve on demand — no subscription, no imposed maintenance.",
        },
      ];

  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Notre méthodologie" : "Our methodology"}
      title={isFr ? "De l'idée à la prod," : "From idea to production,"}
      titleEm={isFr ? "sans mauvaise surprise" : "with no bad surprises"}
      titleTail="."
      description={
        isFr
          ? "Avant de coder, on comprend comment vous travaillez vraiment. Un travail méthodique, par étapes, avec des points de validation réguliers — du premier cadrage jusqu'à la mise en production et au-delà."
          : "Before we code, we understand how you actually work. Methodical, step by step, with regular validation points — from the first scoping through go-live and beyond."
      }
    >
      {/* Chips de réassurance — sans durée chiffrée */}
      <ul className="mb-12 flex list-none flex-wrap justify-center gap-3 p-0">
        {chips.map((c) => (
          <li
            key={c}
            className="border-terracotta/30 bg-paper text-terracotta-deep inline-flex items-center rounded-full border px-4 py-1.5 text-[13px] font-semibold"
          >
            {c}
          </li>
        ))}
      </ul>

      <ProcessSteps steps={steps} orientation="horizontal" />

      <p className="text-fg-muted mx-auto mt-12 max-w-2xl text-center text-sm leading-relaxed">
        {isFr
          ? "Chaque projet est unique : le déroulé s'adapte à votre besoin, vos outils et vos contraintes — d'une automatisation simple à un système d'agents connectés."
          : "Every project is unique: the process adapts to your need, your tools and your constraints — from a simple automation to a system of connected agents."}
      </p>
    </Section>
  );
}
