import type { ReactNode } from "react";

interface MiseEnPageLectureProps {
  /** Sommaire (`ArticleTOC` variante v2) ; absent → colonne unique. */
  readonly sommaire?: ReactNode;
  readonly children: ReactNode;
}

/**
 * Grille de lecture : une colonne (mobile), puis rail de sommaire de 15 rem +
 * colonne de corps de 68ch (≥ 1024 px). Aucun `overflow: hidden` en ancêtre du
 * rail collant. Un seul niveau de conteneur (fin des `Section`/`Container`
 * imbriqués de la V1).
 */
export function MiseEnPageLecture({ sommaire, children }: MiseEnPageLectureProps) {
  return (
    <div className={`art-layout${sommaire ? "" : " art-sans-sommaire"}`}>
      {sommaire ? <div>{sommaire}</div> : null}
      <div className="art-corps-colonne min-w-0">{children}</div>
    </div>
  );
}
