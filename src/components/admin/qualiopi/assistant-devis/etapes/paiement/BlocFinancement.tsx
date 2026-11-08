"use client";
// use-client: champs contrôlés du financement du prix unique.

/**
 * Financement suggéré du prix unique (fiche E15), port des cas de `DevisForm` : les champs
 * OPCO ne s'affichent que si le financement est OPCO. Le CPF n'est pas proposé (Axion-IA n'est
 * pas habilité). Les saisies restent des chaînes ; la conversion est faite par `vers-offre.ts`.
 */
import { useId, type Dispatch } from "react";

import type { ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";

export interface PropsBlocFinancement {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
}

type Financement = EtatAssistant["financement"];

const MODES: ReadonlyArray<{ value: Financement["mode"]; label: string }> = [
  { value: "", label: "— Aucun —" },
  { value: "direct", label: "Direct (entreprise)" },
  { value: "opco", label: "OPCO" },
  { value: "france_travail", label: "France Travail" },
];
const MODALITES: ReadonlyArray<{ value: Financement["modaliteOpco"]; label: string }> = [
  { value: "", label: "— Choisir —" },
  { value: "intra", label: "Intra" },
  { value: "inter_presentiel", label: "Inter présentiel" },
  { value: "inter_distanciel", label: "Inter distanciel" },
];

export function BlocFinancement({ etat, dispatch }: PropsBlocFinancement) {
  const uid = useId();
  const f = etat.financement;
  const maj = (patch: Partial<Financement>) =>
    dispatch({ type: "champs", patch: { financement: { ...f, ...patch } } });
  const champ = (
    id: string,
    libelle: string,
    cle: "nbParticipants" | "dureeHeures" | "enveloppeRestante" | "dateDebutSession",
    type: "number" | "date",
  ) => (
    <label className="flex flex-col" htmlFor={`${uid}-${id}`}>
      {libelle}
      <input
        id={`${uid}-${id}`}
        type={type}
        className="min-h-[44px] rounded border px-2"
        value={f[cle]}
        onChange={(e) => maj({ [cle]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col" htmlFor={`${uid}-mode`}>
        Financement suggéré
        <select
          id={`${uid}-mode`}
          className="min-h-[44px] rounded border px-2"
          value={f.mode}
          onChange={(e) => maj({ mode: e.target.value as Financement["mode"] })}
        >
          {MODES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {f.mode === "opco" ? (
        <>
          <label className="flex flex-col" htmlFor={`${uid}-modalite`}>
            Modalité OPCO
            <select
              id={`${uid}-modalite`}
              className="min-h-[44px] rounded border px-2"
              value={f.modaliteOpco}
              onChange={(e) => maj({ modaliteOpco: e.target.value as Financement["modaliteOpco"] })}
            >
              {MODALITES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {champ("nb", "Nb. stagiaires", "nbParticipants", "number")}
          {champ("duree", "Durée (heures)", "dureeHeures", "number")}
          {champ("env", "Enveloppe OPCO restante (€, optionnel)", "enveloppeRestante", "number")}
          {champ("debut", "Début prévu de la session (optionnel)", "dateDebutSession", "date")}
        </>
      ) : null}
    </div>
  );
}
