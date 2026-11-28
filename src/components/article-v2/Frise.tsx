export interface EtapeFrise {
  readonly titre: string;
  readonly texte: string;
  readonly duree?: string;
}

/**
 * Frise verticale d'étapes numérotées (`.etapes`) : liste ordonnée, numéros par la CSS.
 * Les étapes d'un guide à ancres `step-N` restent portées par `ArticleEtapes`.
 */
export function Frise({ etapes }: { readonly etapes: ReadonlyArray<EtapeFrise> }) {
  if (etapes.length === 0) return null;
  return (
    <ol className="etapes">
      {etapes.map((e) => (
        <li key={e.titre}>
          <p className="etapes__titre">{e.titre}</p>
          {e.duree ? <p className="etapes__duree">{e.duree}</p> : null}
          <p>{e.texte}</p>
        </li>
      ))}
    </ol>
  );
}
