import type { ReactNode } from "react";

export interface EtapeArticle {
  /** Ancre stable (unique dans la page). */
  readonly id: string;
  readonly titre: string;
  readonly contenu?: ReactNode;
}

interface ArticleEtapesProps {
  readonly etapes: ReadonlyArray<EtapeArticle>;
  /** Niveau des titres d'étape (3 par défaut : sous le h2 du corps). */
  readonly niveauTitre?: 3 | 4;
}

/**
 * Liste numérotée à pastilles (compteur CSS, aucun JS). Chaque étape porte son
 * `id` pour le sommaire. Rend `null` sans étape.
 */
export function ArticleEtapes({ etapes, niveauTitre = 3 }: ArticleEtapesProps) {
  if (etapes.length === 0) return null;
  const Titre = niveauTitre === 4 ? "h4" : "h3";
  return (
    <ol className="art-etapes">
      {etapes.map((e) => (
        <li key={e.id} id={e.id}>
          <Titre>{e.titre}</Titre>
          {e.contenu}
        </li>
      ))}
    </ol>
  );
}
