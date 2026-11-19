"use client";
// use-client: onglets contrôlés (état local de l onglet affiché).

/**
 * Étape 3 assemblée (fiche E15) : un onglet par formule proposée, ou, pour un prix unique,
 * le rappel de l'échéancier (aucun financement n'est proposé). Les montants par phase arrivent du serveur
 * (`montantsPhases`, aperçu S07) ; rien n'est calculé ici.
 */
import { useId, useState, type Dispatch, type KeyboardEvent } from "react";

import { propositionEffective, type ActionAssistant } from "../../etat";
import type { Etape, EtatAssistant } from "../../types";
import { ApercuClientVerra } from "./ApercuClientVerra";
import { PaiementA } from "./PaiementA";
import { PaiementB } from "./PaiementB";
import { RappelPhases } from "./RappelPhases";

export interface PropsEtapePaiement {
  etape: Etape;
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  tvaStandardPct: number;
  montantsPhases?:
    | { A?: ReadonlyArray<number | null> | undefined; B?: ReadonlyArray<number | null> | undefined }
    | undefined;
}

export function EtapePaiement({
  etat,
  dispatch,
  tvaStandardPct,
  montantsPhases,
}: PropsEtapePaiement) {
  const uid = useId();
  const p = propositionEffective(etat);
  const formules: Array<"A" | "B"> = [
    ...(p === "A" || p === "AB" ? (["A"] as const) : []),
    ...(p === "B" || p === "AB" ? (["B"] as const) : []),
  ];
  const [choix, setChoix] = useState<"A" | "B">("A");
  const actif = formules.includes(choix) ? choix : formules[0];
  // Navigation clavier des onglets (motif WAI-ARIA) : flèches, Début, Fin ; tabIndex itinérant.
  const surTouche = (ev: KeyboardEvent<HTMLButtonElement>) => {
    const i = actif ? formules.indexOf(actif) : 0;
    const n = formules.length;
    const cible =
      ev.key === "ArrowRight"
        ? formules[(i + 1) % n]
        : ev.key === "ArrowLeft"
          ? formules[(i - 1 + n) % n]
          : ev.key === "Home"
            ? formules[0]
            : ev.key === "End"
              ? formules[n - 1]
              : undefined;
    if (!cible) return;
    ev.preventDefault();
    setChoix(cible);
    document.getElementById(`${uid}-tab-${cible}`)?.focus();
  };

  return (
    <div className="flex flex-col gap-[var(--space-admin-8)] lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        {p === "prix_unique" ? (
          <RappelPhases
            nom="Phases et versements"
            phases={etat.achat.phases}
            montants={montantsPhases?.A}
          />
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Formules"
              className="mb-[var(--space-admin-6)] flex gap-[var(--space-admin-2)] border-b border-[color:var(--color-admin-border)]"
            >
              {formules.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  id={`${uid}-tab-${f}`}
                  aria-selected={actif === f}
                  aria-controls={`${uid}-panneau-${f}`}
                  tabIndex={actif === f ? 0 : -1}
                  className="-mb-px min-h-[44px] border-b-2 border-transparent px-[var(--space-admin-5)] font-semibold text-[color:var(--color-admin-fg-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-admin-accent)] aria-selected:border-[color:var(--color-admin-accent)] aria-selected:text-[color:var(--color-admin-fg)] motion-safe:transition-colors"
                  onClick={() => setChoix(f)}
                  onKeyDown={surTouche}
                >
                  Formule {f}
                </button>
              ))}
            </div>
            {actif ? (
              <div
                role="tabpanel"
                id={`${uid}-panneau-${actif}`}
                aria-labelledby={`${uid}-tab-${actif}`}
              >
                {actif === "A" ? (
                  <PaiementA etat={etat} dispatch={dispatch} montants={montantsPhases?.A} />
                ) : (
                  <PaiementB etat={etat} dispatch={dispatch} montants={montantsPhases?.B} />
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
      <ApercuClientVerra etat={etat} tvaStandardPct={tvaStandardPct} />
    </div>
  );
}
