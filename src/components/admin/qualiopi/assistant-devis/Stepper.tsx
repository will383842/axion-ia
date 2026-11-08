"use client";
// use-client: composant interactif (boutons de navigation entre étapes).

/**
 * Assistant de devis — pastilles d'étapes (fiche E06).
 * 4 pastilles ; la sous-étape « 1b » (Phases) appartient à la pastille 1 et ne la quitte pas.
 * Étape courante : `aria-current="step"` (elle seule). Terminées : boutons. Futures : inertes.
 */
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Etape } from "./types";

export const PASTILLES = [
  { etape: 1, libelle: "Client et projet" },
  { etape: 2, libelle: "Formules" },
  { etape: 3, libelle: "Paiement" },
  { etape: 4, libelle: "Aperçu et envoi" },
] as const;

/** Rang (1 à 4) de la pastille qui porte l'étape. */
export function rangPastille(etape: Etape): 1 | 2 | 3 | 4 {
  return etape === "1b" ? 1 : etape;
}

/** « Étape 2 sur 4 : Formules » (annonce vocale) ; la sous-étape 1b ajoute « , Phases ». */
export function annonceEtape(etape: Etape): string {
  const rang = rangPastille(etape);
  const libelle = PASTILLES[rang - 1]!.libelle;
  return `Étape ${rang} sur ${PASTILLES.length} : ${libelle}${etape === "1b" ? ", Phases" : ""}`;
}

export interface StepperProps {
  etape: Etape;
  onAller: (etape: Etape) => void;
  /** Pendant une sauvegarde : les pastilles terminées ne sont plus cliquables. */
  desactive?: boolean | undefined;
}

export function Stepper({ etape, onAller, desactive = false }: StepperProps) {
  const courant = rangPastille(etape);
  return (
    <nav aria-label="Étapes du devis">
      <ol className="mb-[var(--space-admin-6,16px)] flex items-center gap-[var(--space-admin-3,6px)]">
        {PASTILLES.map((p) => {
          const etat = p.etape < courant ? "terminee" : p.etape === courant ? "courante" : "future";
          const pastille = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[length:var(--text-admin-xs)] font-semibold",
                  etat === "courante" &&
                    "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] text-white",
                  etat === "terminee" &&
                    "border-[color:var(--color-admin-success)] bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]",
                  etat === "future" &&
                    "border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg-soft)]",
                )}
              >
                {etat === "terminee" ? <Check size={14} /> : p.etape}
              </span>
              {/* Sous 640 px le libellé est masqué visuellement mais reste lu. */}
              <span className="sr-only text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)] sm:not-sr-only">
                {p.libelle}
                {etat === "courante" && etape === "1b" ? (
                  <span className="text-[color:var(--color-admin-fg-soft)]"> › Phases</span>
                ) : null}
              </span>
            </>
          );
          const cls = "flex min-h-[44px] items-center gap-[var(--space-admin-2,4px)]";
          return (
            <li key={p.etape} className="flex flex-1 items-center">
              {etat === "terminee" ? (
                <button
                  type="button"
                  className={cls}
                  disabled={desactive}
                  onClick={() => onAller(p.etape)}
                >
                  {pastille}
                </button>
              ) : etat === "courante" ? (
                <span className={cls} aria-current="step">
                  {pastille}
                </span>
              ) : (
                <span className={cls} aria-disabled="true" tabIndex={-1}>
                  {pastille}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
