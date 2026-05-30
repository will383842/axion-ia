/**
 * AuditMethodology — 4 étapes de la démarche Audit IA (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis `src/app/[locale]/audit/page.tsx`
 * (l.486-527). Pipeline ProcessSteps horizontal : Cadrage 30 min → Investigation
 * terrain → Restitution chiffrée → Plan d'action. Universel — pas de villeContext.
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ProcessSteps } from "@/components/sections/ProcessSteps";

export interface AuditMethodologyProps {
  readonly isFr: boolean;
}

export function AuditMethodology({ isFr }: AuditMethodologyProps): ReactNode {
  return (
    <Section
      eyebrow={isFr ? "Méthodologie" : "Methodology"}
      title={isFr ? "Notre démarche" : "Our approach"}
      titleEm={isFr ? "en 4 étapes" : "in 4 steps"}
    >
      <Container>
        <ProcessSteps
          orientation="horizontal"
          steps={[
            {
              id: "step-1-cadrage",
              title: isFr ? "Cadrage 30 min" : "30-min scoping",
              description: isFr
                ? "Appel découverte gratuit. On cadre le périmètre et la date."
                : "Free discovery call. We scope the perimeter and date.",
            },
            {
              id: "step-2-investigation",
              title: isFr ? "Investigation" : "Investigation",
              description: isFr
                ? "Entretiens, observation des process réels, analyse de vos outils. Sur site ou à distance selon l'ampleur."
                : "Interviews, real-process observation, analysis of your tools. On site or remote.",
            },
            {
              id: "step-3-restitution",
              title: isFr ? "Restitution chiffrée" : "Costed delivery",
              description: isFr
                ? "Un livrable priorisé : chaque opportunité chiffrée, coût vs gain attendu."
                : "A prioritised report: each opportunity costed, cost vs expected gain.",
            },
            {
              id: "step-4-action",
              title: isFr ? "Plan d'action" : "Action plan",
              description: isFr
                ? "Roadmap des quick-wins (≤ 30 j) aux chantiers de fond. Vous implémentez seul, avec nous, ou pas."
                : "Roadmap from quick-wins (≤ 30 days) to deeper projects. You implement alone, with us, or not.",
            },
          ]}
        />
      </Container>
    </Section>
  );
}
