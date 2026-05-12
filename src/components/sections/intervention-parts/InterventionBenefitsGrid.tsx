// Sous-composant partagé — grille 4 bénéfices des interventions.
// Sprint 14.10.7 + audit 2026-05-12 : factorise la grille répétée entre
// `InterventionDetailPage`, `IndividualCoachingPage`, `CollectiveTrainingPage`.

import type { LucideIcon } from "lucide-react";
import { Heading } from "@/components/typography/Heading";

export interface InterventionBenefit {
  icon: LucideIcon;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
}

interface Props {
  items: ReadonlyArray<InterventionBenefit>;
  isFr: boolean;
  /** Niveau H sémantique (défaut h3 = sous-titre dans page produit). */
  headingLevel?: 2 | 3 | 4;
}

export function InterventionBenefitsGrid({ items, isFr, headingLevel = 3 }: Props) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:gap-7">
      {items.map((b, i) => {
        const BenefitIcon = b.icon;
        return (
          <article
            key={i}
            className="bg-paper border-border shadow-subtle rounded-2xl border p-6 sm:p-7"
          >
            <div className="bg-terracotta-soft text-terracotta-deep mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl">
              <BenefitIcon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <Heading level={headingLevel} variant="sub">
              {isFr ? b.titleFr : b.titleEn}
            </Heading>
            <p className="text-fg-soft mt-3 text-[14.5px] leading-relaxed">
              {isFr ? b.bodyFr : b.bodyEn}
            </p>
          </article>
        );
      })}
    </div>
  );
}
