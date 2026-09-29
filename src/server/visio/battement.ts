/**
 * Le BATTEMENT du balayage du dossier client (chantier visio, PR 4 ; modèle
 * `webhook-battement.ts`).
 *
 * Chaque passage du balayage écrit sa ligne dans `battements_circuit`. Le
 * panneau « État du circuit » de la console la LIT et la juge : au-delà de
 * `BATTEMENT_ROUGE_MIN` sans battement, le balayage est tenu pour arrêté. Le
 * témoin vit en base et le site le calcule — Telegram n'est qu'un doublon
 * (principe PA-14 du plan).
 *
 * `premierLe` est écrit UNE fois, au premier passage : c'est la BORNE du
 * balayage. Aucune rencontre n'est créée automatiquement pour un rendez-vous
 * plus ancien ; l'historique passe par le script de reprise (V-07b).
 *
 * Le drapeau vu par le worker est recopié tel quel (tronqué à 10 caractères) :
 * une valeur mal saisie dans Coolify doit se VOIR sur l'écran de santé.
 *
 * Module neutre.
 */

import type { Tx } from "@/features/dossier-client/base";

/** Nom de la ligne du balayage dans `battements_circuit`. */
export const BATTEMENT_BALAYAGE = "balayage";

/** Cadence du balayage, en minutes (file `visio-balayage`). */
export const CADENCE_BALAYAGE_MIN = 5;

/** Au-delà, le panneau passe au rouge. */
export const BATTEMENT_ROUGE_MIN = 30;

/** Version du balayage, écrite dans le battement (lue sur l'écran de santé). */
export const VERSION_BALAYAGE = "pr4-2026-09-29";

type TxBattement = Pick<Tx, "battementCircuit">;

/** La borne du balayage (`premierLe`), ou `null` s'il n'a jamais tourné. */
export async function lireBorneDuBalayage(tx: TxBattement): Promise<Date | null> {
  const b = await tx.battementCircuit.findUnique({
    where: { nom: BATTEMENT_BALAYAGE },
    select: { premierLe: true },
  });
  return b?.premierLe ?? null;
}

/** Écrit le battement ; `premierLe` n'est posé qu'à la création. */
export async function ecrireBattement(
  tx: TxBattement,
  e: { readonly maintenant: Date; readonly drapeauBrut: string | undefined },
): Promise<void> {
  const drapeau = (e.drapeauBrut ?? "(absent)").slice(0, 10);
  await tx.battementCircuit.upsert({
    where: { nom: BATTEMENT_BALAYAGE },
    create: {
      nom: BATTEMENT_BALAYAGE,
      premierLe: e.maintenant,
      dernierLe: e.maintenant,
      drapeauVuParWorker: drapeau,
      version: VERSION_BALAYAGE,
    },
    update: { dernierLe: e.maintenant, drapeauVuParWorker: drapeau, version: VERSION_BALAYAGE },
  });
}

export type EtatBattement =
  | { readonly etat: "jamais" }
  | { readonly etat: "vert" | "rouge"; readonly ageMin: number; readonly dernierLe: Date };

/** Juge un battement. PURE. */
export function jugerBattement(dernierLe: Date | null, maintenant: Date): EtatBattement {
  if (dernierLe === null) return { etat: "jamais" };
  const ageMin = Math.max(0, Math.floor((maintenant.getTime() - dernierLe.getTime()) / 60_000));
  return { etat: ageMin > BATTEMENT_ROUGE_MIN ? "rouge" : "vert", ageMin, dernierLe };
}
