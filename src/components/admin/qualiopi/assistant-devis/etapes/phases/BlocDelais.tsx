"use client";
// use-client: texte modifiable, fourchette synchronisée avec les lignes (effets), gestionnaires.

/**
 * « Délais estimatifs, pas garantis » (fiche E12). La phrase vient de la bibliothèque de textes
 * (prop) : copiée dans le brouillon seulement si le champ est vide, jamais par-dessus une
 * saisie. La fourchette est calculée par `fourchetteSemaines` (les lignes), pas saisie.
 */
import { useEffect, useId, type Dispatch } from "react";

import { fourchetteSemaines, semainesTotales } from "../../calculs";
import type { ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";

export interface PropsBlocDelais {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  /** Texte d'origine de la bibliothèque (« actif par défaut »). */
  texteDelais: string;
}

function libelleFourchette({ min, max }: { min: number; max: number }): string {
  if (max <= 0) return "";
  const s = (n: number) => `${n} semaine${n > 1 ? "s" : ""}`;
  return min === max ? s(max) : `${min} à ${max} semaines`;
}

export function BlocDelais({ etat, dispatch, texteDelais }: PropsBlocDelais) {
  const uid = useId();
  const { delais, lignes } = etat;
  const calcule = libelleFourchette(fourchetteSemaines(lignes));
  const total = semainesTotales(etat.achat.phases);

  useEffect(() => {
    if (delais.texte === "" && texteDelais !== "") {
      dispatch({ type: "champs", patch: { delais: { ...delais, texte: texteDelais } } });
    }
  }, [delais, texteDelais, dispatch]);

  // Fourchette cochée : elle suit les lignes (aucune valeur périmée dans le devis).
  useEffect(() => {
    if (delais.fourchette !== "" && delais.fourchette !== calcule) {
      dispatch({ type: "champs", patch: { delais: { ...delais, fourchette: calcule } } });
    }
  }, [delais, calcule, dispatch]);

  return (
    <section aria-labelledby={`${uid}-t`} className="mb-[var(--space-admin-6,16px)]">
      <h3 id={`${uid}-t`}>Délais estimatifs, pas garantis</h3>
      <p className="text-[length:var(--text-admin-sm)]">
        Les délais dépendent aussi des réponses du client. Le devis le dit clairement, avec une
        phrase que vous pouvez modifier.
      </p>
      <label className="mt-2 flex flex-col">
        Phrase affichée sur le devis pour les délais
        <textarea
          rows={3}
          className="rounded border p-2"
          value={delais.texte}
          onChange={(e) =>
            dispatch({ type: "champs", patch: { delais: { ...delais, texte: e.target.value } } })
          }
        />
      </label>
      <button
        type="button"
        className="mt-2 min-h-[44px] rounded border px-3"
        onClick={() =>
          dispatch({ type: "champs", patch: { delais: { ...delais, texte: texteDelais } } })
        }
      >
        Revenir au texte d&apos;origine
      </button>
      <div className="mt-3">
        <label className="flex min-h-[44px] items-center gap-2">
          <input
            type="checkbox"
            checked={delais.fourchette !== ""}
            disabled={calcule === "" && delais.fourchette === ""}
            aria-describedby={calcule === "" && delais.fourchette === "" ? `${uid}-f` : undefined}
            onChange={(e) =>
              dispatch({
                type: "champs",
                patch: { delais: { ...delais, fourchette: e.target.checked ? calcule : "" } },
              })
            }
          />
          Afficher une fourchette {calcule !== "" ? `(« ${calcule} »)` : ""}
        </label>
        {calcule === "" && delais.fourchette === "" ? (
          <p id={`${uid}-f`} className="text-[length:var(--text-admin-sm)]">
            Renseignez le délai (en semaines) d&apos;au moins une ligne pour proposer une
            fourchette.
          </p>
        ) : null}
      </div>
      {total > 0 ? (
        <p aria-live="polite" className="mt-2">
          {total} semaine{total > 1 ? "s" : ""} estimées au total
        </p>
      ) : null}
    </section>
  );
}
