"use client";
// use-client: interrupteur, champs contrôlés et copie unique du texte d origine (effet).

/**
 * « Notre garantie » (fiche E12). Proposée par défaut, modifiable à chaque devis. Décochée :
 * les champs sont masqués mais la saisie reste dans le brouillon (rien n'est perdu). La phrase
 * d'origine vient de la bibliothèque (prop), jamais d'un texte écrit ici.
 */
import { useEffect, useId, type Dispatch } from "react";

import type { ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";

export interface PropsBlocGarantie {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  phraseGarantie: string;
}

export function BlocGarantie({ etat, dispatch, phraseGarantie }: PropsBlocGarantie) {
  const uid = useId();
  const g = etat.garantie;
  const maj = (patch: Partial<EtatAssistant["garantie"]>) =>
    dispatch({ type: "champs", patch: { garantie: { ...g, ...patch } } });

  useEffect(() => {
    // Une seule fois, pour un champ jamais touché : une phrase vidée reste vide.
    if (g.afficher && g.touche !== true && g.phrase === "" && phraseGarantie !== "") {
      dispatch({
        type: "champs",
        patch: { garantie: { ...g, phrase: phraseGarantie, touche: true } },
      });
    }
  }, [g, phraseGarantie, dispatch]);

  return (
    <section aria-labelledby={`${uid}-t`} className="mb-[var(--space-admin-6,16px)]">
      <h3 id={`${uid}-t`}>Notre garantie</h3>
      <label className="flex min-h-[44px] items-center gap-2">
        <input
          type="checkbox"
          checked={g.afficher}
          onChange={(e) => maj({ afficher: e.target.checked })}
        />
        Afficher la garantie sur le devis (décochez pour ne rien promettre)
      </label>
      {g.afficher ? (
        <div className="mt-2 grid gap-3">
          <label className="flex flex-col sm:w-64">
            Durée (jours après livraison)
            <input
              inputMode="numeric"
              className="min-h-[44px] rounded border px-2"
              value={g.jours}
              onChange={(e) => {
                if (/^\d*$/.test(e.target.value)) maj({ jours: e.target.value });
              }}
            />
          </label>
          <label className="flex flex-col">
            Phrase de garantie affichée sur le devis
            <textarea
              rows={3}
              className="rounded border p-2"
              value={g.phrase}
              onChange={(e) => maj({ phrase: e.target.value, touche: true })}
            />
          </label>
          <button
            type="button"
            className="min-h-[44px] rounded border px-3 sm:w-fit"
            onClick={() => maj({ phrase: phraseGarantie, touche: true })}
          >
            Revenir à la phrase d&apos;origine
          </button>
        </div>
      ) : null}
    </section>
  );
}
