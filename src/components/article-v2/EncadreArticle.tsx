import type { ReactNode } from "react";

interface EncadreArticleProps {
  /** Identifiant unique du libellé (cible de `aria-labelledby`). */
  readonly id: string;
  /** Libellé texte : le type d'un encadré n'est jamais porté par la couleur seule. */
  readonly titre: string;
  readonly children: ReactNode;
}

/**
 * Encadré : `<section aria-labelledby>` (pas de `role="note"`/`alert`/`status`,
 * pas d'`<aside>` anonyme). Le libellé est un `<p>` : il ne crée pas de saut de
 * niveau de titre au milieu du corps.
 */
export function EncadreArticle({ id, titre, children }: EncadreArticleProps) {
  return (
    <section className="art-encadre" aria-labelledby={id}>
      <p id={id} className="art-encadre-titre">
        {titre}
      </p>
      {children}
    </section>
  );
}
