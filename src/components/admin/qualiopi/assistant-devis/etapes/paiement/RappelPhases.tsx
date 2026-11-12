"use client";
// use-client: partage le format d affichage entre les onglets de paiement.

/** Rappel en lecture des phases (étape 1b) ; montants du serveur affichés tels quels. */
import type { PhaseAssistant } from "../../types";

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function RappelPhases({
  nom,
  phases,
  montants,
}: {
  nom: string;
  phases: readonly PhaseAssistant[];
  montants?: ReadonlyArray<number | null> | undefined;
}) {
  return (
    <ol aria-label={nom} className="mb-3 list-none p-0">
      {phases.map((p, i) => (
        <li key={p.id} className="flex justify-between gap-2">
          <span>
            {i + 1}. {p.libelle} · {p.pourcentage} %
          </span>
          <span>{montants?.[i] == null ? "—" : EUROS.format(montants[i]! / 100)}</span>
        </li>
      ))}
    </ol>
  );
}
