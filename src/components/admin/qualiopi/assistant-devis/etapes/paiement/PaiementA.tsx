"use client";
// use-client: cases à cocher contrôlées du rythme de maintenance.

/**
 * Paiement de la formule A (fiche E15) : rappel des phases fixées à l'étape 1b, avec les
 * montants par phase fournis par le SERVEUR (jamais calculés ici), puis le rythme de
 * paiement de la maintenance, limité à 1, 2, 6 ou 12 mois (décision D3 : pas de trimestre).
 * La « durée minimale de maintenance » est un texte du brouillon, sans montant calculé.
 */
import { useId, type Dispatch } from "react";

import type { ActionAssistant } from "../../etat";
import type { EtatAssistant, MoisPeriode } from "../../types";
import { RappelPhases } from "./RappelPhases";

export interface PropsPaiementA {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  /** Centimes par phase, calculés par le serveur. */
  montants?: ReadonlyArray<number | null> | undefined;
}

export const RYTHMES_MAINTENANCE: ReadonlyArray<{ mois: MoisPeriode; libelle: string }> = [
  { mois: 1, libelle: "Chaque mois" },
  { mois: 2, libelle: "Tous les 2 mois" },
  { mois: 6, libelle: "Tous les 6 mois" },
  { mois: 12, libelle: "Chaque année" },
];

export function PaiementA({ etat, dispatch, montants }: PropsPaiementA) {
  const uid = useId();
  const m = etat.achat.maintenance;
  const bascule = (mois: MoisPeriode) => {
    const periodes = m.periodes.includes(mois)
      ? m.periodes.filter((x) => x !== mois)
      : [...m.periodes, mois].sort((a, b) => a - b);
    if (periodes.length === 0) return;
    dispatch({ type: "achat", patch: { maintenance: { ...m, periodes } } });
  };
  return (
    <div>
      <RappelPhases
        nom="Phases de la mise en place"
        phases={etat.achat.phases}
        montants={montants}
      />
      <fieldset className="mb-3">
        <legend>Maintenance : rythme de paiement proposé</legend>
        <p id={`${uid}-aide`} className="text-[length:var(--text-admin-sm)]">
          Ne concerne que la maintenance. Au moins un rythme reste proposé.
        </p>
        <div className="flex flex-wrap gap-4">
          {RYTHMES_MAINTENANCE.map((r) => (
            <label key={r.mois} className="flex min-h-[44px] items-center gap-2">
              <input
                type="checkbox"
                value={r.mois}
                checked={m.periodes.includes(r.mois)}
                disabled={m.periodes.length === 1 && m.periodes[0] === r.mois}
                aria-describedby={`${uid}-aide`}
                onChange={() => bascule(r.mois)}
              />
              {r.libelle}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-[length:var(--text-admin-sm)]">
        Aucun travail ne démarre avant la réception du premier versement. Chaque versement suivant
        est appelé à la fin de la phase correspondante.
      </p>
    </div>
  );
}
