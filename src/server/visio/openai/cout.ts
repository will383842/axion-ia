/**
 * Le COÛT de chaque appel OpenAI du circuit, tracé et plafonné par le
 * mécanisme EXISTANT de content-gen (ADR 0055 ; LOTS-EXECUTION §1.4).
 *
 *   · AVANT l'appel : `assertCostCapAvailable("openai", estimation)` — lève
 *     `cost_cap_reached` si le plafond mensuel est atteint, `auth_failed` si
 *     OpenAI est désactivé dans l'admin content-gen ;
 *   · APRÈS l'appel : `trackCost` — une ligne `cost_ledger` dont le `jobId`
 *     (`idTacheVisio`, `../id-tache.ts`, seule fabrique) rend le coût
 *     attribuable à un rendez-vous.
 *
 * ⚠️ PLAFOND PARTAGÉ, conséquence assumée : la ligne `provider_config`
 * `openai` sert aussi content-gen. Atteindre le plafond ici bloque aussi
 * content-gen, et un OpenAI désactivé à la main dans l'admin content-gen
 * arrête aussi ce circuit. Ce module ne touche JAMAIS au kill switch de
 * content-gen (ni `handleCostCapHit`, ni `recordPermanentProviderFailure`).
 *
 * Les deux fonctions passent par un PORT injectable : les tests (et la
 * chaîne de Gate D) vérifient que chaque appel l'a traversé, sans écrire de
 * ligne `cost_ledger`.
 */

import { coutUsd, type UsageAppel } from "./tarifs";

export interface EcritureCout {
  readonly jobId: string;
  readonly provider: "openai";
  readonly model: string;
  readonly tokensInput: number;
  readonly tokensOutput: number;
  readonly costUsd: number;
}

export interface PortCout {
  /** Lève si le plafond est atteint (ou OpenAI désactivé). */
  readonly verifierPlafond: (estimationUsd: number) => Promise<void>;
  /** Écrit la dépense réelle. */
  readonly enregistrer: (ecriture: EcritureCout) => Promise<void>;
}

/** Le port réel : `cost-tracker` de content-gen, importé paresseusement (worker seulement). */
export const portCoutReel: PortCout = {
  verifierPlafond: async (estimationUsd) => {
    const { assertCostCapAvailable } = await import("@/server/content-gen/lib/cost-tracker");
    await assertCostCapAvailable("openai", estimationUsd);
  },
  enregistrer: async (e) => {
    const { trackCost } = await import("@/server/content-gen/lib/cost-tracker");
    await trackCost(e);
  },
};

/** Avant chaque appel. */
export async function avantAppel(port: PortCout, estimationUsd: number): Promise<void> {
  await port.verifierPlafond(estimationUsd);
}

/** Après chaque appel (même raté par la suite : on a été facturé). */
export async function apresAppel(
  port: PortCout,
  a: { readonly jobId: string; readonly modele: string; readonly usage: UsageAppel },
): Promise<void> {
  await port.enregistrer({
    jobId: a.jobId,
    provider: "openai",
    model: a.modele,
    tokensInput: a.usage.jetonsEntree,
    tokensOutput: a.usage.jetonsSortie,
    costUsd: coutUsd(a.modele, a.usage),
  });
}
