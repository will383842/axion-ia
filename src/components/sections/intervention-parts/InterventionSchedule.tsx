// Sous-composant partagé — programme jour des interventions.
// Sprint 14.10.7 + audit 2026-05-12 : factorise le pattern dupliqué entre
// `InterventionDetailPage`, `IndividualCoachingPage`, `CollectiveTrainingPage`.
//
// Le composant rend uniquement la liste `<ol>` + le pavé frais déplacement —
// le bloc <Section eyebrow/title/description/> reste assemblé côté template
// pour conserver la flexibilité éditoriale (chaque page peut customiser le
// titre du programme : « Le détail de votre journée », « ... de votre
// demi-journée », « ... de votre intervention »).

import { Clock } from "lucide-react";

export interface InterventionScheduleItem {
  time: string;
  titleFr: string;
  titleEn: string;
  descriptionFr?: string;
  descriptionEn?: string;
}

interface Props {
  items: ReadonlyArray<InterventionScheduleItem>;
  isFr: boolean;
  /** Optionnel : masquer le pavé frais déplacement (ex. coaching à distance). */
  hideTravelNote?: boolean;
}

export function InterventionSchedule({ items, isFr, hideTravelNote = false }: Props) {
  return (
    <>
      <ol className="border-border/60 mx-auto max-w-3xl border-l-2 pl-6">
        {items.map((item, i) => (
          <li key={i} className="relative pb-6 last:pb-0">
            <span
              aria-hidden="true"
              className="bg-terracotta ring-terracotta-soft absolute -left-[31px] mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full ring-4"
            >
              <Clock aria-hidden="true" className="text-paper h-2 w-2" strokeWidth={3} />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-terracotta-deep text-[13px] font-bold tracking-wide uppercase tabular-nums">
                {item.time}
              </span>
              <span className="text-fg text-[15px] font-semibold">
                {isFr ? item.titleFr : item.titleEn}
              </span>
            </div>
            {item.descriptionFr || item.descriptionEn ? (
              <p className="text-fg-soft mt-1 text-[13.5px] leading-relaxed">
                {isFr ? item.descriptionFr : item.descriptionEn}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      {!hideTravelNote ? (
        <p className="text-fg-muted mx-auto mt-6 max-w-3xl text-[12.5px] leading-relaxed">
          {isFr
            ? "Frais de logement, repas et forfait trajet en sus, facturés au cas par cas selon la distance et la durée. Devis transparent fourni avant signature."
            : "Lodging, meals and travel allowance billed separately, calculated case by case based on distance and duration. Transparent quote provided before signature."}
        </p>
      ) : null}
    </>
  );
}
