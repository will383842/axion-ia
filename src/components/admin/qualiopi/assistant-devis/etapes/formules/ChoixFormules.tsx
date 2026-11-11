"use client";
// use-client: choix exclusif contrôlé (boutons radio) dont les raisons de grisage sont lues au clavier.

/**
 * Étape 2, choix de la proposition (fiche E13) : prix unique, A seule, B seule, les deux.
 * Les formules sont grisées quand `raisonPrixUniqueImpose` le dit ; la raison est lue par
 * `aria-describedby`. Le choix demandé reste dans l'état même s'il est refusé.
 */
import { useId, type Dispatch } from "react";

import { propositionEffective, raisonPrixUniqueImpose, type ActionAssistant } from "../../etat";
import type { EtatAssistant, Proposition } from "../../types";

export interface PropsChoixFormules {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
}

const CHOIX: ReadonlyArray<{ valeur: Proposition; libelle: string }> = [
  { valeur: "prix_unique", libelle: "Prix unique : le client signe le montant total" },
  { valeur: "A", libelle: "Formule A seule" },
  { valeur: "B", libelle: "Formule B seule" },
  { valeur: "AB", libelle: "Les deux, le client choisit" },
];

export function ChoixFormules({ etat, dispatch }: PropsChoixFormules) {
  const uid = useId();
  const raison = raisonPrixUniqueImpose(etat);
  const actif = propositionEffective(etat);
  return (
    <fieldset className="mb-[var(--space-admin-6,16px)]">
      <legend>Que proposez-vous au client ?</legend>
      <p className="text-[length:var(--text-admin-sm)]">
        Le client verra seulement ce que vous cochez. S&apos;il y a deux formules, il choisit au
        moment de signer.
      </p>
      <div className="flex flex-wrap gap-4">
        {CHOIX.map((c) => {
          const grise = raison !== null && c.valeur !== "prix_unique";
          return (
            <label key={c.valeur} className="flex min-h-[44px] items-center gap-2">
              <input
                type="radio"
                name={`proposition-${uid}`}
                checked={actif === c.valeur}
                disabled={grise}
                aria-describedby={grise ? `${uid}-raison` : undefined}
                onChange={() => dispatch({ type: "proposer", proposition: c.valeur })}
              />
              {c.libelle}
            </label>
          );
        })}
      </div>
      {raison !== null ? (
        <p id={`${uid}-raison`} className="text-[length:var(--text-admin-sm)]">
          {raison}
        </p>
      ) : null}
    </fieldset>
  );
}
