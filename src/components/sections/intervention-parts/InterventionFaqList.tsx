// Sous-composant partagé — accordion FAQ des interventions.
// Sprint 14.10.7 + audit 2026-05-12 : factorise le pattern `<details>` répété
// entre `InterventionDetailPage`, `IndividualCoachingPage`,
// `CollectiveTrainingPage`.
//
// Note : le JSON-LD FAQPage reste émis par l'appelant (avec son helper
// `buildFaqJsonLd` ou un objet inline). On factorise UNIQUEMENT le rendu HTML.

export interface InterventionFaqItem {
  qFr: string;
  qEn: string;
  aFr: string;
  aEn: string;
}

interface Props {
  items: ReadonlyArray<InterventionFaqItem>;
  isFr: boolean;
}

export function InterventionFaqList({ items, isFr }: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {items.map((f, i) => (
        <details
          key={i}
          className="bg-paper border-border group/faq open:shadow-subtle rounded-2xl border p-5"
        >
          <summary className="text-fg flex cursor-pointer items-start justify-between gap-3 text-base font-semibold">
            <span data-faq-q>{isFr ? f.qFr : f.qEn}</span>
            <span
              aria-hidden="true"
              className="bg-terracotta-soft text-terracotta-deep mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs transition-transform duration-200 group-open/faq:rotate-45"
            >
              +
            </span>
          </summary>
          <p data-faq-a data-answer className="text-fg-soft mt-3 text-[14.5px] leading-relaxed">
            {isFr ? f.aFr : f.aEn}
          </p>
        </details>
      ))}
    </div>
  );
}
