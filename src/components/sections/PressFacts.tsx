import * as React from "react";

interface PressFact {
  id: string;
  label: string;
  value: string;
}

interface PressFactsProps {
  /** Section caption above the dl. */
  eyebrow?: string;
  facts: ReadonlyArray<PressFact>;
}

// Press fact-sheet — sober card-aside, used in the pitch row alongside the
// boilerplate paragraph. Keeps a journalist scannable list of definitive
// data points (HQ, founding year, hosting…) — no tone surface so the parent
// `<Section>` controls the bg.
export function PressFacts({ eyebrow, facts }: PressFactsProps) {
  return (
    <aside className="border-border bg-paper rounded-xl border p-6 sm:p-7">
      {eyebrow ? (
        <p className="text-terracotta mb-5 text-[11px] font-semibold tracking-[0.18em] uppercase">
          <span
            aria-hidden="true"
            className="bg-terracotta mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
          />
          {eyebrow}
        </p>
      ) : null}
      <dl className="divide-border divide-y">
        {facts.map((fact) => (
          <div key={fact.id} className="flex items-baseline justify-between gap-4 py-3 first:pt-0">
            <dt className="text-fg-muted text-sm">{fact.label}</dt>
            <dd className="text-fg text-right text-sm font-semibold">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
