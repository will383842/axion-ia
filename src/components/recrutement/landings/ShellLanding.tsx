// Coque commune des landings apporteurs d'affaires (maquettes validées du 09/11/2026).
//
// La feuille de style est celle des maquettes, préfixée par `.lp-app` : rien ne change ailleurs
// sur le site. Les sections, elles, sont GÉNÉRÉES depuis les maquettes (voir `generer.mjs` dans le
// dossier de chantier) : on modifie la maquette, puis on régénère.
import type { ReactNode } from "react";

import "./landings.css";
import { IconesApporteurs } from "./Icones";
import { SuiviClicsLanding } from "./SuiviClicsLanding";

interface Props {
  /** Identifiant de la page dans la mesure (`landing`), par exemple `apporteur-hub`. */
  landing: string;
  /** Classes de variante de la maquette : `pub`, `annonce`, `vsl`, `merci`. */
  variante?: string;
  children: ReactNode;
}

export function ShellLanding({ landing, variante = "", children }: Props) {
  return (
    <div className={`lp-app mobile-cta ${variante}`.trim()}>
      <IconesApporteurs />
      {children}
      <SuiviClicsLanding landing={landing} />
    </div>
  );
}
