// Registre du CHARGEUR d'`enqueueEmail` pour le hub de notifications (14/11/2026).
//
// Pourquoi ce module existe : le doublon e-mail d'une demande de client (`doublon-client.ts`) doit
// enfiler un e-mail, mais `notifications/index.ts` fait partie de la fermeture d'imports du worker
// d'e-mails et du relevé Zoho, que la garde `email-worker.opposition.graphe-worker.spec.ts`
// maintient hors de `queues.ts` (qui tire `next/headers`, `next-auth`, des Server Actions).
// Un import — statique, dynamique ou de valeur — de `queues.ts` depuis le hub fait donc rougir la
// garde, et on ne l'assouplit pas.
//
// Solution : cette FEUILLE ne contient aucun import d'exécution. Les deux points d'entrée de
// processus y POSENT un chargeur paresseux :
//   - le worker : `queues.ts` pose le sien à son chargement (`worker.ts` l'importe statiquement) ;
//   - l'app Next : `instrumentation.ts` (branche nodejs) pose un chargeur qui n'importe `queues.ts`
//     qu'au premier envoi — rien n'est chargé au démarrage.
//
// ⚠️ `import type { … }` UNIQUEMENT (jamais `import { type … }`, que la garde compte comme un
// import d'exécution).

import type { enqueueEmail } from "@/server/queue/queues";

export type EnfileurEmail = typeof enqueueEmail;
export type ChargeurEnfileurEmail = () => Promise<EnfileurEmail>;

const CLE = Symbol.for("axionia.enfileurEmail");

/** L'état vit sur `globalThis` : un module dupliqué entre deux bundles partage le même chargeur. */
const portee = globalThis as unknown as { [CLE]?: ChargeurEnfileurEmail };

/** Pose le chargeur. La PREMIÈRE pose gagne ; ne lève jamais. */
export function poserChargeurEnfileurEmail(chargeur: ChargeurEnfileurEmail): void {
  if (portee[CLE] === undefined) portee[CLE] = chargeur;
}

/**
 * L'enfileur, ou `null` si aucun point d'entrée n'a posé de chargeur (script `tsx` isolé, test).
 * Lève si le chargeur lui-même lève : l'appelant (`doublon-client.ts`) l'attrape.
 */
export async function chargerEnfileurEmail(): Promise<EnfileurEmail | null> {
  const chargeur = portee[CLE];
  return chargeur === undefined ? null : await chargeur();
}

/** Tests seulement. */
export function __reinitialiserPourTests(): void {
  delete portee[CLE];
}
