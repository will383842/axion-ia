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
import { ApercuClientVerra } from "../paiement/ApercuClientVerra";
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
  const carteA = (
    <div className="min-w-0">
      <CarteFormuleA etat={etat} dispatch={dispatch} tvaStandardPct={tvaStandardPct} />
      <BlocAvantages
        formule="A"
        etat={etat}
        dispatch={dispatch}
        avantagesPossibles={avantagesPossibles.A}
        aSavoirPossibles={aSavoirPossibles.A}
      />
    </div>
  );
  const carteB = (
    <div className="min-w-0">
      <CarteFormuleB etat={etat} dispatch={dispatch} tvaStandardPct={tvaStandardPct} />
      <BlocAvantages
        formule="B"
        etat={etat}
        dispatch={dispatch}
        avantagesPossibles={avantagesPossibles.B}
        aSavoirPossibles={aSavoirPossibles.B}
      />
    </div>
  );
  return (
    <div className="flex flex-col gap-[var(--space-admin-8)] lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <ChoixFormules etat={etat} dispatch={dispatch} />
        {p === "prix_unique" ? (
          <p className="mb-[var(--space-admin-8)] rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-sunken)] p-[var(--space-admin-5)]">
            Le devis garde un seul prix : le total des lignes de l&apos;étape 1.
          </p>
        ) : null}
        {p === "AB" ? (
          <div className="grid gap-x-[var(--space-admin-6)] lg:grid-cols-2">
            {carteA}
            {carteB}
          </div>
        ) : p === "A" ? (
          carteA
        ) : p === "B" ? (
          carteB
        ) : null}
        {p !== "prix_unique" ? (
          <ServicesExterieurs etat={etat} dispatch={dispatch} textePlafond={textePlafond} />
        ) : null}
      </div>
      <ApercuClientVerra etat={etat} tvaStandardPct={tvaStandardPct} />
    </div>
  );
}
