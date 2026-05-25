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
                ? "Appel découverte gratuit. On définit le périmètre (toute l'entreprise ou un service), la taille du diagnostic et la date d'intervention."
                : "Free discovery call. We define the scope (entire company or one department), diagnostic size, and intervention date.",
            },
            {
              id: "step-2-investigation",
              title: isFr ? "Investigation terrain" : "Field investigation",
              description: isFr
                ? "1 à 5 jours sur site selon le niveau (Flash, Ciblé, Stratégique). Entretiens collaborateurs, observation des processus réels, analyse des outils existants."
                : "1 to 5 days on-site depending on level (Flash, Targeted, Strategic). Employee interviews, observation of real processes, analysis of existing tools.",
            },
            {
              id: "step-3-restitution",
              title: isFr ? "Restitution chiffrée" : "Costed delivery",
              description: isFr
                ? "Livrable PDF priorisé sous 48 h à 5 jours : chaque opportunité IA chiffrée individuellement (coût mise en place vs gain annuel attendu sur 12 mois)."
                : "Prioritised PDF delivery within 48 h to 5 days: each AI opportunity costed individually (deployment cost vs expected 12-month annual gain).",
            },
            {
              id: "step-4-action",
              title: isFr ? "Plan d'action" : "Action plan",
              description: isFr
                ? "Roadmap séquencée des quick-wins (≤ 30 j) aux chantiers structurels (3-12 mois). Vous décidez si vous implémentez en interne, avec nous, ou pas du tout."
                : "Sequenced roadmap from quick-wins (≤ 30 days) to structural projects (3-12 months). You decide whether you implement in-house, with us, or not at all.",
            },
          ]}
        />
      </Container>
    </Section>
  );
}
