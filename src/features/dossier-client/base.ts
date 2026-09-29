/**
 * Les deux formes d'accès à la base que prennent les modules du dossier client
 * (chantier visio, PR 4).
 *
 *   · `Tx` : un client DÉJÀ dans une transaction. Les fonctions qui le
 *     prennent n'en ouvrent pas : elles s'ajoutent à celle de l'appelant, et
 *     une erreur annule tout ;
 *   · `BaseTransactionnelle` : de quoi OUVRIR une transaction — le client
 *     Prisma réel (`@/lib/prisma`), ou la base en mémoire des tests.
 *
 * `dansLaTransaction(tx)` fait passer un `Tx` pour une base qui « ouvre »
 * une transaction en restant dans celle de l'appelant : c'est ce qui permet
 * d'appeler la porte unique (`creerOuRetrouverClient`, qui ouvre la sienne)
 * DANS la transaction de « Créer la fiche prospect ».
 *
 * Module neutre : aucun import d'exécution.
 */

import type { Prisma } from "../../../prisma/generated/client";

export type Tx = Prisma.TransactionClient;

export interface BaseTransactionnelle {
  $transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

/** Une base qui « ouvre » une transaction… en restant dans celle de l'appelant. */
export function dansLaTransaction(tx: Tx): Tx & BaseTransactionnelle {
  return new Proxy(tx as Tx & BaseTransactionnelle, {
    get(cible, nom, recepteur) {
      if (nom === "$transaction") {
        return <T>(fn: (t: Tx) => Promise<T>): Promise<T> => fn(tx);
      }
      return Reflect.get(cible, nom, recepteur);
    },
  });
}
