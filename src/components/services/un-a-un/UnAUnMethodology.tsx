/**
 * UnAUnMethodology — Section "Comment ça se passe" (3 étapes) du service `un-a-un`.
 *
 * Sprint A Phase 2 — extrait depuis `src/app/[locale]/un-a-un/page.tsx`.
 * Réutilise `ProcessSteps` (orientation horizontal) avec 3 étapes :
 * cadrage individuel 30 min → sessions de coaching (visio/site) → progression
 * mesurable. Pas de variation ville-aware (méthodologie identique partout).
 *
 * Server Component pur, zéro JS.
 */

import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ProcessSteps } from "@/components/sections/ProcessSteps";

interface UnAUnMethodologyProps {
  readonly isFr: boolean;
}

export function UnAUnMethodology({ isFr }: UnAUnMethodologyProps) {
  return (
    <Section
      eyebrow={isFr ? "Format" : "Format"}
      title={isFr ? "Comment ça se passe" : "How it works"}
    >
      <Container>
        <ProcessSteps
          orientation="horizontal"
          steps={[
            {
              id: "step-1-cadrage",
              title: isFr ? "Cadrage individuel" : "Individual scoping",
              description: isFr
                ? "30 min, gratuit. On apprend à connaître le poste, les outils utilisés, les tâches chronophages et les objectifs prioritaires de la personne."
                : "30 min, free. We get to know the role, tools used, time-consuming tasks and priority objectives of the person.",
            },
            {
              id: "step-2-coaching",
              title: isFr ? "Sessions de coaching" : "Coaching sessions",
              description: isFr
                ? "En visio ou sur site selon la préférence. Rythme adapté à l'agenda — pas de format imposé. Chaque session travaille sur des cas réels tirés du quotidien de la personne."
                : "Remote or on-site according to preference. Pace adapted to the schedule — no imposed format. Each session works on real cases from the person's daily life.",
            },
            {
              id: "step-3-progression",
              title: isFr ? "Progression mesurable" : "Measurable progress",
              description: isFr
                ? "À chaque étape, on valide ce qui est acquis et on ajuste la suite. L'objectif : que la personne soit autonome sur l'IA dans son poste — pas dépendante d'un prestataire."
                : "At each stage, we validate what has been acquired and adjust what comes next. The objective: the person becomes autonomous with AI in their role — not dependent on a provider.",
            },
          ]}
        />
      </Container>
    </Section>
  );
}
