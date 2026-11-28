import { Section } from "@/components/layout/Section";
import type { ContenuFiche } from "@/lib/equipe";

/** Constats de terrain : 3 à 5 citations validées. */
export function CitationsTerrain({ donnees }: { donnees: NonNullable<ContenuFiche["citations"]> }) {
  return (
    <Section tone="paper" title={donnees.titre}>
      <ul className="grid max-w-5xl gap-6 lg:grid-cols-2" role="list">
        {donnees.items.map((c) => (
          <li key={c}>
            <blockquote className="border-terracotta text-fg h-full border-l-4 pl-5 text-lg leading-relaxed">
              <p>«&nbsp;{c}&nbsp;»</p>
            </blockquote>
          </li>
        ))}
      </ul>
    </Section>
  );
}
