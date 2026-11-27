import type { BlocCorps } from "./types";

interface CorpsArticleProps {
  /** HTML du corps (article en base), déjà sanitisé en amont : rendu tel quel. */
  readonly html: string | null;
  /** Corps d'un article en fichier, quand `html` est null. */
  readonly blocs: ReadonlyArray<BlocCorps> | null;
}

/** Corps de l'article (`prose-axionia`, mesure 68ch). Composant serveur. */
export function CorpsArticle({ html, blocs }: CorpsArticleProps) {
  if (html) {
    return <div className="corps-html" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <div>
      {(blocs ?? []).map((bloc, idx) =>
        bloc.kind === "ol" ? (
          <ol key={`b-${idx}`} className="marker:text-terracotta list-decimal pl-6">
            {bloc.items.map((it, j) => (
              <li key={`i-${j}`}>{it}</li>
            ))}
          </ol>
        ) : (
          <p key={`b-${idx}`}>{bloc.text}</p>
        ),
      )}
    </div>
  );
}
