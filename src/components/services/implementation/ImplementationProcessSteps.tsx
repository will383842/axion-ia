/**
 * ImplementationProcessSteps — 5 étapes de déroulement projet (transparence).
 *
 * Sprint A · Phase 2 Extract-3 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/implementation/page.tsx` (l.1260-1272). Vous décrivez →
 * Devis 48 h → Cadrage → Build 2-6 sem → Livraison + formation. Sprints courts,
 * démos hebdo, validation continue. Lève l'opacité projet (zéro tunnel).
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { ProcessSteps } from "@/components/sections/ProcessSteps";

export interface ImplementationProcessStepsProps {
  readonly isFr: boolean;
}

export function ImplementationProcessSteps({ isFr }: ImplementationProcessStepsProps): ReactNode {
  const processSteps = isFr
    ? [
        {
          id: "p1",
          title: "Vous décrivez le besoin",
          description:
            "Formulaire de 5 min ou appel de 20 min. On creuse le contexte, les outils en place, les contraintes.",
        },
        {
          id: "p2",
          title: "Devis ferme sous 48 h ouvrées",
          description:
            "Périmètre précis, jalons, prix fixe. Vous signez ou pas — sans engagement avant signature.",
        },
        {
          id: "p3",
          title: "Cadrage technique · 1 sprint",
          description: "On valide les détails, on connecte les outils, on aligne avec vos équipes.",
        },
        {
          id: "p4",
          title: "Build · 2 à 6 semaines",
          description: "Sprints courts, démos hebdomadaires, validation continue. Pas de tunnel.",
        },
        {
          id: "p5",
          title: "Livraison + formation incluse",
          description:
            "Demi-journée de prise en main avec vos équipes. Documentation, runbook, accès à tout. C'est à vous.",
        },
      ]
    : [
        {
          id: "p1",
          title: "You describe the need",
          description:
            "5-minute form or 20-minute call. We dig into context, existing tools, constraints.",
        },
        {
          id: "p2",
          title: "Firm quote within 48 business hours",
          description:
            "Precise scope, milestones, fixed price. You sign or not — no commitment before.",
        },
        {
          id: "p3",
          title: "Technical framing · 1 sprint",
          description: "We validate details, connect tools, align with your teams.",
        },
        {
          id: "p4",
          title: "Build · 2 to 6 weeks",
          description: "Short sprints, weekly demos, continuous validation. No tunnel effect.",
        },
        {
          id: "p5",
          title: "Delivery + training included",
          description:
            "Half-day onboarding with your teams. Docs, runbook, full access. It's yours.",
        },
      ];

  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "Comment ça se passe" : "How it runs"}
      title={isFr ? "5 étapes," : "5 steps,"}
      titleEm={isFr ? "zéro tunnel" : "zero tunnel"}
      description={
        isFr
          ? "Sprints courts, démos hebdomadaires, validation continue. Vous voyez l'avancement en permanence — pas de boîte noire."
          : "Short sprints, weekly demos, continuous validation. You see progress at all times — no black box."
      }
    >
      <ProcessSteps steps={processSteps} />
    </Section>
  );
}
