"use client";
// use-client: assemble des blocs contrôlés de l étape 2.

/**
 * Étape 2 assemblée : choix de la proposition puis carte(s). Une carte non choisie n'est pas
 * rendue mais ses données restent dans l'état (rien n'est perdu si on rebascule).
 */
import type { Dispatch } from "react";

import { propositionEffective, type ActionAssistant } from "../../etat";
import type { Etape, EtatAssistant } from "../../types";
import { CarteFormuleA } from "./CarteFormuleA";
import { ChoixFormules } from "./ChoixFormules";

export interface PropsEtapeFormules {
  etape: Etape;
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  tvaStandardPct: number;
}

export function EtapeFormules({ etat, dispatch, tvaStandardPct }: PropsEtapeFormules) {
  const p = propositionEffective(etat);
  return (
    <div>
      <ChoixFormules etat={etat} dispatch={dispatch} />
      {p === "prix_unique" ? (
        <p className="rounded border p-3">
          Le devis garde un seul prix : le total des lignes de l&apos;étape 1.
        </p>
      ) : null}
      {p === "A" || p === "AB" ? (
        <CarteFormuleA etat={etat} dispatch={dispatch} tvaStandardPct={tvaStandardPct} />
      ) : null}
    </div>
  );
}
