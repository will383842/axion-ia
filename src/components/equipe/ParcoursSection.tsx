import { Section } from "@/components/layout/Section";
import type { ContenuFiche } from "@/lib/equipe";

/** Parcours : faits fournis par la personne ; aucun nombre de collaborateurs. */
export function ParcoursSection({ donnees }: { donnees: NonNullable<ContenuFiche["parcours"]> }) {
  return (
    <Section title={donnees.titre}>
      <div className="max-w-3xl space-y-7">
        {donnees.blocs.map((b) => (
          <div key={b.titre}>
            <p className="text-fg text-lg font-semibold">{b.titre}</p>
            <p className="text-fg-soft mt-2 text-base leading-relaxed">{b.texte}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
