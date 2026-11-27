import type { ReactNode } from "react";

interface MiseEnPageLectureProps {
  /** `header.heros` + `div.article__ouverture` (photo, « En bref »). */
  readonly ouverture: ReactNode;
  /** `ArticleTOC` variante v2 (un seul `<nav class="sommaire">`) ; absent → pas de sommaire. */
  readonly sommaire?: ReactNode;
  /** Corps, FAQ, sources, auteur… (`div.article__corps`). */
  readonly children: ReactNode;
  /** Colonne d'actions : UN `<aside>`, après `</article>`. */
  readonly colonne: ReactNode;
}

/**
 * Grille de lecture du socle (section 09) : `div.conteneur.mise-en-page > article.article`
 * puis la colonne d'actions. Ne rend jamais `<main>` (le layout le porte) : le conteneur
 * est un `div`. Aucun `overflow: hidden` en ancêtre des colonnes collantes.
 */
export function MiseEnPageLecture({
  ouverture,
  sommaire,
  children,
  colonne,
}: MiseEnPageLectureProps) {
  return (
    <div className="conteneur mise-en-page">
      <article className="article">
        {ouverture}
        {sommaire}
        <div className="article__corps prose">{children}</div>
      </article>
      {colonne}
    </div>
  );
}
