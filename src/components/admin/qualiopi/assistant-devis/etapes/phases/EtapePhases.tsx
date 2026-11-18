"use client";
// use-client: assemble des blocs contrôlés de l étape 1b.

/**
 * Étape 1b assemblée (fiche E12) : phases, délais, maintenance, garantie. Les phases éditées
 * ici sont celles de la formule A (`achat.phases`), rappelées à l'étape 3. Les textes
 * d'origine viennent de la bibliothèque (props), aucun n'est écrit ici.
 */
import type { Dispatch } from "react";

import type { ActionAssistant } from "../../etat";
import type { Etape, EtatAssistant } from "../../types";
import { BlocDelais } from "./BlocDelais";
import { BlocGarantie } from "./BlocGarantie";
import { BlocMaintenance } from "./BlocMaintenance";
import { EditeurPhases } from "./EditeurPhases";

export interface PropsEtapePhases {
  etape: Etape;
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  texteDelais: string;
  phraseGarantie: string;
}

export function EtapePhases({ etat, dispatch, texteDelais, phraseGarantie }: PropsEtapePhases) {
  return (
    <div>
      <p className="mb-3">
        Pour : {etat.intitule.trim() !== "" ? etat.intitule : "ce devis"}. Chaque phase a un
        livrable, un délai estimatif et une part de paiement. Le total des versements fait toujours
        100 %.
      </p>
      <EditeurPhases
        nom="Phases"
        phases={etat.achat.phases}
        onChange={(phases) => dispatch({ type: "achat", patch: { phases } })}
      />
      <BlocDelais etat={etat} dispatch={dispatch} texteDelais={texteDelais} />
      <section aria-labelledby="titre-maintenance" className="mb-[var(--space-admin-6,16px)]">
        <h3 id="titre-maintenance">Après la livraison : la maintenance</h3>
        <p className="text-[length:var(--text-admin-sm)]">
          Elle ne fait pas partie des 100 %. Vous fixez sa durée comme vous le souhaitez.
        </p>
        <BlocMaintenance etat={etat} dispatch={dispatch} />
      </section>
      <BlocGarantie etat={etat} dispatch={dispatch} phraseGarantie={phraseGarantie} />
    </div>
  );
}
