"use client";
// use-client: champs contrôlés de la maintenance, montés à deux endroits sur UN seul état.

/**
 * Maintenance après livraison (fiche E12). Monté en 1b et dans la carte A (E13) : les deux
 * lisent et écrivent `achat.maintenance`, il n'y a qu'un état. Les « mois offerts » ne sont pas
 * saisis ici : le moteur les porte (`moisOfferts`), mais cet écran n'en propose pas. Le montant mensuel est une saisie,
 * jamais un prix en dur ; les rythmes de paiement se choisissent à l'étape 3.
 */
import { useId, type Dispatch } from "react";

import { eurosEnCents } from "../../calculs";
import type { ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";

export interface PropsBlocMaintenance {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
}

export function BlocMaintenance({ etat, dispatch }: PropsBlocMaintenance) {
  const uid = useId();
  const m = etat.achat.maintenance;
  const maj = (patch: Partial<EtatAssistant["achat"]["maintenance"]>) =>
    dispatch({ type: "achat", patch: { maintenance: { ...m, ...patch } } });
  const illisible = m.mensuelEur.trim() !== "" && eurosEnCents(m.mensuelEur) === null;

  return (
    <div>
      <fieldset className="mb-3">
        <legend>Maintenance</legend>
        <div className="flex flex-wrap gap-4">
          {(["obligatoire", "facultative"] as const).map((r) => (
            <label key={r} className="flex min-h-[44px] items-center gap-2">
              <input
                type="radio"
                name={`maintenance-regle-${uid}`}
                checked={m.regle === r}
                onChange={() => maj({ regle: r })}
              />
              {r === "obligatoire" ? "Obligatoire" : "Facultative"}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col">
          Puis (HT par mois)
          <input
            inputMode="decimal"
            className="min-h-[44px] rounded border px-2"
            value={m.mensuelEur}
            aria-invalid={illisible}
            aria-describedby={illisible ? `${uid}-mensuel` : undefined}
            onChange={(e) => maj({ mensuelEur: e.target.value })}
          />
          {illisible ? (
            <span id={`${uid}-mensuel`}>
              Montant illisible : des euros avec 2 décimales au plus.
            </span>
          ) : null}
        </label>
        <label className="flex flex-col">
          Durée minimale de maintenance
          <input
            className="min-h-[44px] rounded border px-2"
            value={m.dureeMinimale}
            onChange={(e) => maj({ dureeMinimale: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
