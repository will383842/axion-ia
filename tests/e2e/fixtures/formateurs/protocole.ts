// Banc @formateurs — le contrat entre le spec Playwright et l'exécuteur `tsx`.
//
// Module PUR, importé des deux côtés : le spec n'importe JAMAIS
// `serveur/executer.ts`, qui s'exécute dès son chargement.

import type { RendezVousSimule } from "./calendly-simule";
import type { AppelReseau } from "./reseau-simule";

/** Préfixe de la ligne de résultat sur la sortie standard de l'exécuteur. */
export const MARQUEUR_RESULTAT = "@@BANC-RESULTAT@@";

export type EntreeBanc =
  | {
      readonly action: "livrer-webhook-calendly";
      readonly rdv: RendezVousSimule;
      /** Altère le corps APRÈS signature : la route doit refuser (401). */
      readonly alterer?: boolean;
    }
  | {
      readonly action: "passage-decouverte-calendly";
      readonly rendezVous: readonly RendezVousSimule[];
      /** L'instant du passage (ISO 8601) — l'horloge pilotée du banc. */
      readonly maintenant: string;
    };

export interface ResultatWebhook {
  readonly statut: number;
  readonly corps: unknown;
  readonly reseau: readonly AppelReseau[];
}

export interface ResultatPassage {
  readonly issue: {
    readonly ok: boolean;
    readonly scanned: number;
    readonly created: number;
    readonly rattrapageMinutes?: number;
    readonly reason?: string;
  };
  readonly reseau: readonly AppelReseau[];
}
