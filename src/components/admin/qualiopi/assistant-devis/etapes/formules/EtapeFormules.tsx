"use client";
// use-client: assemble des blocs contrôlés de l étape 2.

/**
 * Étape 2 assemblée : choix de la proposition, carte(s), services extérieurs. Une carte non
 * choisie n'est pas rendue mais ses données restent dans l'état (rien n'est perdu si on
 * rebascule). Les textes d'avantages et du plafond viennent de la bibliothèque (props).
 */
import type { Dispatch } from "react";

import { propositionEffective, type ActionAssistant } from "../../etat";
import type { Etape, EtatAssistant } from "../../types";
import { BlocAvantages } from "./BlocAvantages";
import { CarteFormuleA } from "./CarteFormuleA";
import { CarteFormuleB } from "./CarteFormuleB";
import { ChoixFormules } from "./ChoixFormules";
import { ServicesExterieurs } from "./ServicesExterieurs";

export interface PropsEtapeFormules {
  etape: Etape;
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  tvaStandardPct: number;
  avantagesPossibles: { A: readonly string[]; B: readonly string[] };
  aSavoirPossibles: { A: readonly string[]; B: readonly string[] };
  textePlafond: string;
}

export function EtapeFormules({
  etat,
  dispatch,
  tvaStandardPct,
  avantagesPossibles,
  aSavoirPossibles,
  textePlafond,
}: PropsEtapeFormules) {
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
        <>
          <CarteFormuleA etat={etat} dispatch={dispatch} tvaStandardPct={tvaStandardPct} />
          <BlocAvantages
            formule="A"
            etat={etat}
            dispatch={dispatch}
            avantagesPossibles={avantagesPossibles.A}
            aSavoirPossibles={aSavoirPossibles.A}
          />
        </>
      ) : null}
      {p === "B" || p === "AB" ? (
        <>
          <CarteFormuleB etat={etat} dispatch={dispatch} tvaStandardPct={tvaStandardPct} />
          <BlocAvantages
            formule="B"
            etat={etat}
            dispatch={dispatch}
            avantagesPossibles={avantagesPossibles.B}
            aSavoirPossibles={aSavoirPossibles.B}
          />
        </>
      ) : null}
      {p !== "prix_unique" ? (
        <ServicesExterieurs etat={etat} dispatch={dispatch} textePlafond={textePlafond} />
      ) : null}
    </div>
  );
}
