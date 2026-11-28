import type { ReactNode } from "react";

export interface CarteItem {
  readonly titre: string;
  readonly texte: string;
  /** Pictogramme décoratif (SVG inline fourni par l'appelant), facultatif. */
  readonly icone?: ReactNode;
}

/** Grille de cartes (`.cartes`) : une liste, chaque carte avec titre et texte. */
export function Cartes({ items }: { readonly items: ReadonlyArray<CarteItem> }) {
  if (items.length === 0) return null;
  return (
    <ul className="cartes">
      {items.map((c) => (
        <li className="carte" key={c.titre}>
          {c.icone ? (
            <span className="carte__icone" aria-hidden="true">
              {c.icone}
            </span>
          ) : null}
          <p className="carte__titre">{c.titre}</p>
          <p>{c.texte}</p>
        </li>
      ))}
    </ul>
  );
}
