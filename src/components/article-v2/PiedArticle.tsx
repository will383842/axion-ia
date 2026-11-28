import type { ReactNode } from "react";

/**
 * Pied d'article (PLAN §4, points 9-10) : UN seul conteneur à espacement
 * vertical commun, à la place des `Section`/`Container` imbriqués de la V1.
 */
export function PiedArticle({ children }: { readonly children: ReactNode }) {
  return <div>{children}</div>;
}
