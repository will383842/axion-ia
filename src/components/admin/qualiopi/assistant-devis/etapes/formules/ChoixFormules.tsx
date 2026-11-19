"use client";
// use-client: choix exclusif contrôlé (boutons radio) dont les raisons de grisage sont lues au clavier.

/**
 * Étape 2, choix de la proposition (fiche E13) : prix unique, A seule, B seule, les deux.
 * Les formules sont grisées quand `raisonPrixUniqueImpose` le dit ; la raison est lue par
 * `aria-describedby`. Le choix demandé reste dans l'état même s'il est refusé.
 */
import { useId, type Dispatch } from "react";

import { propositionEffective, raisonPrixUniqueImpose, type ActionAssistant } from "../../etat";
import { LibelleSegment } from "../LibelleSegment";
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

// Contrôle segmenté : vrai bouton radio masqué visuellement mais focusable ; le choix retenu porte
// une bordure d'accent de même épaisseur que les autres (pas de saut de mise en page).
const SEGMENT =
  "relative flex min-h-[44px] cursor-pointer items-center rounded-[var(--radius-admin-md)] border-2 border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] pl-[calc(var(--space-admin-4)+1.375rem)] pr-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] motion-safe:transition-colors has-[:checked]:border-[color:var(--color-admin-accent)] has-[:checked]:shadow-[0_0_0_3px_var(--color-admin-accent-track)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--color-admin-accent)] has-[:disabled]:cursor-not-allowed has-[:disabled]:text-[color:var(--color-admin-fg-muted)] has-[:checked]:font-semibold forced-colors:has-[:checked]:outline forced-colors:has-[:checked]:outline-2";

export function ChoixFormules({ etat, dispatch }: PropsChoixFormules) {
  const uid = useId();
  const raison = raisonPrixUniqueImpose(etat);
  const actif = propositionEffective(etat);
  return (
    <fieldset className="mb-[var(--space-admin-8)]">
      <legend className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold">
        Que proposez-vous au client ?
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-1 rounded-[var(--radius-admin-lg)] bg-[color:var(--color-admin-surface-sunken)] p-1">
          {CHOIX.map((c) => {
            const grise = raison !== null && c.valeur !== "prix_unique";
            return (
              <label key={c.valeur} className={SEGMENT}>
                <input
                  type="radio"
                  className="sr-only"
                  name={`proposition-${uid}`}
                  checked={actif === c.valeur}
                  disabled={grise}
                  aria-describedby={grise ? `${uid}-raison` : undefined}
                  onChange={() => dispatch({ type: "proposer", proposition: c.valeur })}
                />
                <LibelleSegment coche={actif === c.valeur} texte={c.libelle} />
              </label>
            );
          })}
        </div>
        <details className="relative inline-block">
          <summary
            aria-label="En savoir plus sur le choix de la proposition"
            className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-ring)] [&::-webkit-details-marker]:hidden"
          >
            <span
              aria-hidden="true"
              className="grid h-[22px] w-[22px] place-items-center rounded-full border border-[color:var(--color-admin-control-border)] text-[length:var(--text-admin-xs)] font-bold"
            >
              ?
            </span>
          </summary>
          <div className="absolute top-11 left-0 z-10 w-80 rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] shadow-[var(--shadow-admin-2)]">
            Le client verra seulement ce que vous cochez. S&apos;il y a deux formules, il choisit au
            moment de signer.
          </div>
        </details>
      </div>
      {raison !== null ? (
        <p
          id={`${uid}-raison`}
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
        >
          {raison}
        </p>
      ) : null}
    </fieldset>
  );
}
