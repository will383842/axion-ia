"use client";
// use-client: cases à cocher contrôlées sur les textes reçus en props.

/**
 * Avantages et points d'attention d'une formule (fiche E14). AUCUN texte en dur : les
 * propositions viennent de la bibliothèque (props) ; l'état ne garde que ceux qui sont cochés.
 */
import { useId, type Dispatch } from "react";

import type { ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";

export interface PropsBlocAvantages {
  formule: "A" | "B";
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  avantagesPossibles: readonly string[];
  aSavoirPossibles: readonly string[];
}

export function BlocAvantages({
  formule,
  etat,
  dispatch,
  avantagesPossibles,
  aSavoirPossibles,
}: PropsBlocAvantages) {
  const uid = useId();
  // Limite connue : « avantages » et « à savoir » partagent UNE liste dans l'état. Un même texte
  // présent dans les deux groupes serait coché dans les deux ; la bibliothèque n'en produit pas.
  const choisis = etat.avantages[formule];
  const basculer = (t: string) => {
    const suivant = choisis.includes(t) ? choisis.filter((x) => x !== t) : [...choisis, t];
    dispatch({ type: "champs", patch: { avantages: { ...etat.avantages, [formule]: suivant } } });
  };
  const groupe = (legende: string, textes: readonly string[]) =>
    textes.length === 0 ? null : (
      <fieldset className="mb-3">
        <legend>{legende}</legend>
        {textes.map((t) => (
          <label key={t} className="flex min-h-[44px] items-center gap-2">
            <input type="checkbox" checked={choisis.includes(t)} onChange={() => basculer(t)} />
            {t}
          </label>
        ))}
      </fieldset>
    );
  if (avantagesPossibles.length === 0 && aSavoirPossibles.length === 0) return null;
  return (
    <div aria-labelledby={`${uid}-t`} role="group">
      <p id={`${uid}-t`}>Afficher avantages et points d&apos;attention</p>
      {groupe("Avantages", avantagesPossibles)}
      {groupe("À savoir", aSavoirPossibles)}
    </div>
  );
}
