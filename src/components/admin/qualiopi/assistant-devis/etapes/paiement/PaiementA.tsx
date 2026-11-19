"use client";
// use-client: cases à cocher contrôlées du rythme de maintenance.

/**
 * Paiement de la formule A (fiche E15) : rappel des phases fixées à l'étape 1b, avec les
 * montants par phase fournis par le SERVEUR (jamais calculés ici), puis le rythme de
 * paiement de la maintenance, limité à 1, 2, 6 ou 12 mois (décision D3 : pas de trimestre).
 * La « durée minimale de maintenance » est un texte du brouillon, sans montant calculé.
 */
import { useId, type Dispatch } from "react";

import { AdminCard } from "@/components/admin/ui/AdminCard";
import type { ActionAssistant } from "../../etat";
import { LibelleSegment } from "../LibelleSegment";
import type { EtatAssistant, MoisPeriode } from "../../types";
import { RappelPhases } from "./RappelPhases";

export interface PropsPaiementA {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  /** Centimes par phase, calculés par le serveur. */
  montants?: ReadonlyArray<number | null> | undefined;
}

// Contrôle segmenté : vraie case à cocher masquée visuellement mais focusable ; bordure d'accent
// de même épaisseur dans les deux états.
const SEGMENT =
  "relative flex min-h-[44px] cursor-pointer items-center rounded-[var(--radius-admin-md)] border-2 border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] pl-[calc(var(--space-admin-4)+1.375rem)] pr-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] motion-safe:transition-colors has-[:checked]:border-[color:var(--color-admin-accent)] has-[:checked]:shadow-[0_0_0_3px_var(--color-admin-accent-track)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--color-admin-accent)] has-[:disabled]:cursor-not-allowed has-[:disabled]:text-[color:var(--color-admin-fg-muted)] has-[:checked]:font-semibold forced-colors:has-[:checked]:outline forced-colors:has-[:checked]:outline-2";

export const RYTHMES_MAINTENANCE: ReadonlyArray<{ mois: MoisPeriode; libelle: string }> = [
  { mois: 1, libelle: "Chaque mois" },
  { mois: 2, libelle: "Tous les 2 mois" },
  { mois: 6, libelle: "Tous les 6 mois" },
  { mois: 12, libelle: "Chaque année" },
];

export function PaiementA({ etat, dispatch, montants }: PropsPaiementA) {
  const uid = useId();
  const m = etat.achat.maintenance;
  const bascule = (mois: MoisPeriode) => {
    const periodes = m.periodes.includes(mois)
      ? m.periodes.filter((x) => x !== mois)
      : [...m.periodes, mois].sort((a, b) => a - b);
    if (periodes.length === 0) return;
    dispatch({ type: "achat", patch: { maintenance: { ...m, periodes } } });
  };
  return (
    <div>
      <RappelPhases
        nom="Phases de la mise en place"
        phases={etat.achat.phases}
        montants={montants}
      />
      <AdminCard as="div" className="mb-[var(--space-admin-8)]">
        <fieldset>
          <legend className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold">
            Maintenance : rythme de paiement proposé
          </legend>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap gap-1 rounded-[var(--radius-admin-lg)] bg-[color:var(--color-admin-surface-sunken)] p-1">
              {RYTHMES_MAINTENANCE.map((r) => (
                <label key={r.mois} className={SEGMENT}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    value={r.mois}
                    checked={m.periodes.includes(r.mois)}
                    disabled={m.periodes.length === 1 && m.periodes[0] === r.mois}
                    aria-describedby={`${uid}-aide`}
                    onChange={() => bascule(r.mois)}
                  />
                  <LibelleSegment coche={m.periodes.includes(r.mois)} texte={r.libelle} />
                </label>
              ))}
            </div>
            <details className="relative inline-block">
              <summary
                aria-label="En savoir plus sur le rythme de maintenance"
                className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-ring)] [&::-webkit-details-marker]:hidden"
              >
                <span
                  aria-hidden="true"
                  className="grid h-[22px] w-[22px] place-items-center rounded-full border border-[color:var(--color-admin-control-border)] text-[length:var(--text-admin-xs)] font-bold"
                >
                  ?
                </span>
              </summary>
              <div
                id={`${uid}-aide`}
                className="absolute top-11 left-0 z-10 w-80 rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] shadow-[var(--shadow-admin-2)]"
              >
                Ne concerne que la maintenance. Au moins un rythme reste proposé.
              </div>
            </details>
          </div>
        </fieldset>
      </AdminCard>
      <div className="flex items-center gap-[var(--space-admin-1)]">
        <details className="relative inline-block">
          <summary
            aria-label="En savoir plus sur le démarrage des travaux"
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
            Aucun travail ne démarre avant la réception du premier versement. Chaque versement
            suivant est appelé à la fin de la phase correspondante.
          </div>
        </details>
      </div>
    </div>
  );
}
