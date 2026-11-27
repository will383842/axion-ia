import type { ReactNode } from "react";

interface BlocDefinitionProps {
  /** Terme défini, balisé `<dfn>`. */
  readonly terme: string;
  /** Libellé du bloc, déjà traduit. */
  readonly libelle: string;
  /** Définition (réponse directe). */
  readonly children: ReactNode;
}

/** Bloc de définition : `<dfn>` pour le terme, réponse directe à côté. */
export function BlocDefinition({ terme, libelle, children }: BlocDefinitionProps) {
  return (
    <section className="encadre encadre--modele" aria-labelledby="bloc-definition">
      <p id="bloc-definition" className="encadre__titre">
        {libelle}
      </p>
      <p>
        <dfn>{terme}</dfn> : {children}
      </p>
    </section>
  );
}
