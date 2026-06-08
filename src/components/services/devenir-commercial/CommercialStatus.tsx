// Server Component — « Indépendant, et bien accompagné ». Refonte visuelle
// 2026-06-08 (Will : trop textuel) : 2 blocs contrastés (liberté / accompagnement)
// + icônes + tagline. Contenu FIXE.

import type { ReactNode } from "react";
import { Compass, LifeBuoy } from "lucide-react";
import { Section } from "@/components/layout/Section";

export interface CommercialStatusProps {
  readonly isFr: boolean;
}

export function CommercialStatus({ isFr }: CommercialStatusProps): ReactNode {
  return (
    <Section
      tone="canvas"
      eyebrow={isFr ? "Votre cadre" : "Your setup"}
      title={isFr ? "Indépendant," : "Self-employed,"}
      titleEm={isFr ? "et bien accompagné" : "and well supported"}
    >
      <div className="grid gap-5 md:grid-cols-2">
        {/* Liberté */}
        <div className="border-terracotta/20 bg-halo-warm rounded-3xl border-2 p-7 sm:p-8">
          <span className="bg-paper text-terracotta mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
            <Compass aria-hidden="true" className="h-6 w-6" />
          </span>
          <h3 className="text-fg text-lg font-semibold tracking-tight">
            {isFr ? "Votre liberté" : "Your freedom"}
          </h3>
          <p className="text-fg-soft mt-2 leading-relaxed">
            {isFr
              ? "Vous organisez vos journées, votre secteur, votre rythme. Pas de hiérarchie pesante, pas d'horaires imposés — juste vos résultats et vos commissions."
              : "You organise your days, your territory, your pace. No heavy hierarchy, no imposed hours — just your results and your commissions."}
          </p>
        </div>

        {/* Accompagnement */}
        <div className="border-primary/20 bg-primary-soft rounded-3xl border-2 p-7 sm:p-8">
          <span className="bg-paper text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
            <LifeBuoy aria-hidden="true" className="h-6 w-6" />
          </span>
          <h3 className="text-fg text-lg font-semibold tracking-tight">
            {isFr ? "Notre accompagnement" : "Our support"}
          </h3>
          <p className="text-fg-soft mt-2 leading-relaxed">
            {isFr
              ? "Vous n'êtes jamais seul : supports de vente prêts à l'emploi, formation à l'offre, réponses techniques rapides et suivi de vos commissions."
              : "You're never alone: ready-to-use sales materials, training on the offer, fast technical answers and commission tracking."}
          </p>
        </div>
      </div>

      <p className="text-fg mt-6 text-center text-lg font-medium">
        {isFr
          ? "La liberté de l'indépendant, la force d'une structure derrière vous."
          : "The freedom of going solo, with a real structure behind you."}
      </p>
    </Section>
  );
}
