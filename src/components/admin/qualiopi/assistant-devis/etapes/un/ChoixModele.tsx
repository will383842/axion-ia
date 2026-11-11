"use client";
// use-client: groupe de boutons radio contrôlé (gestionnaires d événements).

/**
 * Étape 1 — « Que vendez-vous ? » (fiche E08). Vrais boutons radio stylés en pastilles
 * (flèches du clavier), dans un groupe nommé. Aucun montant : le modèle ne fait que poser
 * l'activité ; les lignes se chiffrent à la main.
 */
import type { Dispatch } from "react";

import type { ActionAssistant } from "../../etat";
import { MODELES_ACTIVITE } from "../../modeles";
import type { EtatAssistant } from "../../types";

export interface PropsChoixModele {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
}

export function ChoixModele({ etat, dispatch }: PropsChoixModele) {
  return (
    <div
      role="radiogroup"
      aria-labelledby="titre-modele"
      className="mb-[var(--space-admin-6,16px)]"
    >
      <h3 id="titre-modele" className="mb-[var(--space-admin-3,6px)]">
        Que vendez-vous ?
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODELES_ACTIVITE.map((m) => {
          const id = `modele-${m.activite}`;
          return (
            <label
              key={m.activite}
              htmlFor={id}
              className="flex min-h-[44px] cursor-pointer flex-col rounded border p-3 has-[:checked]:border-[color:var(--color-admin-accent)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2"
            >
              <span className="flex items-center gap-2">
                <input
                  id={id}
                  type="radio"
                  name="modele-devis"
                  checked={etat.modele === m.activite}
                  onChange={() => dispatch({ type: "modele", modele: m.activite })}
                />
                <span className="font-medium">{m.libelle}</span>
              </span>
              <span className="mt-1 text-[length:var(--text-admin-sm)]">{m.detail}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
