/**
 * InterventionsAudienceStrip — Strip 4 pills sous le hero.
 *
 * Sprint A Phase 2 (2026-05-25). Server Component. Réutilisé hub + pages ville.
 * Mentionne TPE/PME/ETI/GE explicitement (audit forms 2026-05-24).
 *
 * Pas de villeContext : bandeau universel quel que soit l'angle géographique.
 */

import { Globe2, Building2, Sparkles, Plane } from "lucide-react";
import { Container } from "@/components/layout/Container";

interface InterventionsAudienceStripProps {
  readonly isFr: boolean;
}

const TIGHT_X = "lg:px-6 xl:px-10";

export function InterventionsAudienceStrip({ isFr }: InterventionsAudienceStripProps) {
  const audienceStrip = [
    {
      icon: Globe2,
      label: isFr ? "France & international" : "France & international",
      detail: isFr ? "Sur site partout dans le monde" : "On site worldwide",
    },
    {
      icon: Building2,
      label: isFr ? "TPE · PME · ETI · grandes entreprises" : "Small · mid-cap · ETI · enterprise",
      detail: isFr ? "Tous secteurs, tous niveaux" : "All sectors, all levels",
    },
    {
      icon: Sparkles,
      label: isFr ? "De débutant à expert IA" : "From AI novice to fluent",
      detail: isFr ? "Un format adapté à chaque maturité" : "A format for every maturity",
    },
    {
      icon: Plane,
      label: isFr ? "Déplacement & logement" : "Travel & lodging",
      detail: isFr
        ? "À la charge du client · forfait journalier"
        : "Covered by client · flat daily rate",
    },
  ] as const;

  return (
    <section className="bg-paper border-border border-y py-10">
      <Container className={TIGHT_X}>
        <ul className="grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-4">
          {audienceStrip.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className="flex items-start gap-3">
                <span className="bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-fg text-sm font-semibold">{item.label}</p>
                  <p className="text-fg-soft mt-1 text-xs">{item.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
