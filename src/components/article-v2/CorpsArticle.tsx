import { envelopperTableaux } from "@/server/content-gen/blog/transformations";
import type { BlocCorps } from "./types";

/** Nom accessible d'un tableau qui n'a pas de légende (le gabarit ne sert que le français). */
const LIBELLE_TABLEAU = "Tableau de données";

interface CorpsArticleProps {
  /** HTML du corps (article en base), déjà sanitisé en amont : rendu tel quel. */
  readonly html: string | null;
  /** Corps d'un article en fichier, quand `html` est null. */
  readonly blocs: ReadonlyArray<BlocCorps> | null;
}

/**
 * Corps de l'article (`prose-axionia`, mesure 68ch). Composant serveur. Les `<table>` du HTML sont
 * enveloppés dans un cadre défilant focusable (`.table-scroll`) : sans cela, un tableau large
 * fait défiler TOUTE la page sur téléphone (WCAG 1.4.10).
 */
export function CorpsArticle({ html, blocs }: CorpsArticleProps) {
  if (html) {
    return (
      <div
        className="corps-html"
        dangerouslySetInnerHTML={{ __html: envelopperTableaux(html, LIBELLE_TABLEAU) }}
      />
    );
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
