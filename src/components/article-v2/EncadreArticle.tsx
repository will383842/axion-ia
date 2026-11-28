import type { ReactNode } from "react";

interface EncadreArticleProps {
  /** Identifiant unique du libellé (cible de `aria-labelledby`). */
  readonly id: string;
  /** Libellé texte : le type d'un encadré n'est jamais porté par la couleur seule. */
  readonly titre: string;
  /** Fonction fixe de l'encadré (couleur du socle ; le libellé texte reste dans le DOM). */
  readonly type?: "retenir" | "attention" | "exemple" | "modele" | "saviez" | "bon";
  readonly children: ReactNode;
}

/**
 * Encadré : `<section aria-labelledby>` (pas de `role="note"`/`alert`/`status`,
 * pas d'`<aside>` anonyme). Le libellé est un `<p>` : il ne crée pas de saut de
 * niveau de titre au milieu du corps.
 */
export function EncadreArticle({ id, titre, type = "retenir", children }: EncadreArticleProps) {
  return (
    <section className={`encadre encadre--${type}`} aria-labelledby={id}>
      <p id={id} className="encadre__titre">
        {titre}
      </p>
      {children}
    </section>
  );
}
