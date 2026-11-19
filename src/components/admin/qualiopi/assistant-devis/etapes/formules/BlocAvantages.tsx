"use client";
// use-client: cases à cocher contrôlées sur les textes reçus en props.

/**
 * Avantages et points d'attention d'une formule (fiche E14). AUCUN texte en dur : les
 * propositions viennent de la bibliothèque (props) ; l'état ne garde que ceux qui sont cochés.
 */
import { Check } from "lucide-react";
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

// Pastille : vraie case à cocher masquée visuellement mais focusable ; cible de 44 px.
const PASTILLE =
  "group relative flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-2 border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] motion-safe:transition-colors has-[:checked]:border-[color:var(--color-admin-accent)] has-[:checked]:shadow-[0_0_0_3px_var(--color-admin-accent-track)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--color-admin-accent)]";

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
      <fieldset className="mb-[var(--space-admin-5)]">
        <legend className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)]">
          {legende}
        </legend>
        <div className="flex flex-wrap gap-2">
          {textes.map((t) => (
            <label key={t} className={PASTILLE}>
              <input
                type="checkbox"
                className="sr-only"
                checked={choisis.includes(t)}
                onChange={() => basculer(t)}
              />
              <Check
                size={16}
                aria-hidden="true"
                className="shrink-0 opacity-0 group-has-[:checked]:opacity-100"
              />
              {t}
            </label>
          ))}
        </div>
      </fieldset>
    );
  if (avantagesPossibles.length === 0 && aSavoirPossibles.length === 0) return null;
  return (
    <div aria-labelledby={`${uid}-t`} role="group" className="mb-[var(--space-admin-8)]">
      <p id={`${uid}-t`} className="mb-[var(--space-admin-3)] font-semibold">
        Afficher avantages et points d&apos;attention
      </p>
      {groupe("Avantages", avantagesPossibles)}
      {groupe("À savoir", aSavoirPossibles)}
    </div>
  );
}
