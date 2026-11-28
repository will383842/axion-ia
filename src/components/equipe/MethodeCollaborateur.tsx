import { Section } from "@/components/layout/Section";
import type { ContenuFiche } from "@/lib/equipe";

/** Méthode : liste ordonnée (les étapes ne sont pas des titres du plan de page). */
export function MethodeCollaborateur({
  donnees,
}: {
  donnees: NonNullable<ContenuFiche["methode"]>;
}) {
  return (
    <Section tone="sand" title={donnees.titre}>
      <ol className="grid max-w-5xl gap-6 lg:grid-cols-3 lg:gap-8" role="list">
        {donnees.etapes.map((e) => (
          <li key={e.numero} className="border-border-strong flex flex-col border-t pt-6">
            <span
              aria-hidden="true"
              className="text-terracotta text-3xl leading-none font-semibold"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {e.numero}
            </span>
            <p className="text-fg mt-4 text-lg font-semibold tracking-tight">{e.titre}</p>
            <p className="text-fg-soft mt-3 text-base leading-relaxed">{e.texte}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
