// Hub notifications — envoi APRÈS la réponse au visiteur (relecture PR 1553).
//
// 🔴 POURQUOI. Les sévérités info/warn partent en synchrone (`shouldDispatchAsync`).
// Depuis le salon « Clients », un `notify` peut durer bien plus que les 3 s d'un
// seul POST : attente d'un 429 jusqu'à 5 s, renvoi vers un supergroupe migré,
// plusieurs morceaux, puis le repli. Attendu depuis une Server Action ou une
// route, c'est le VISITEUR qui patientait — jusqu'à ~24 s devant un bouton
// « Envoyer » figé.
//
// 🔑 `after()` (next/server) lance le travail une fois la réponse partie, avec
// TOUTES les relances. Le serveur Next standalone (`node server.js`, même
// `startServer` que `next start`) le prend en charge, et au SIGTERM il attend
// les rappels `after()` en cours avant de quitter (`createInternalWaitUntil` →
// `onServerClose`) : une fusion ne perd pas l'alerte.
//
// ⚠️ Réservé aux contextes de REQUÊTE WEB. Le worker (discover / enrich) garde
// son `await notify(...)` : là, attendre ne gêne personne, et il n'y a pas de
// réponse après laquelle s'exécuter. C'est aussi pourquoi ce module n'est PAS
// réexporté par `./index` — le worker n'a pas à charger `next/server`.

import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { notify } from "./index";
import type { NotifyInput } from "./types";

/**
 * Programme `notify(input)` après la réponse. Ne throw jamais, ne bloque jamais.
 *
 * Hors d'une requête (`after` refuse : test, script), l'envoi part quand même,
 * détaché — une alerte de client n'est jamais perdue faute de contexte.
 */
export function notifyApresReponse(input: NotifyInput, origine: string): void {
  const envoyer = async (): Promise<void> => {
    try {
      const r = await notify(input);
      if (!r.ok && !r.deduped && !r.rateLimited) {
        console.error(`[${origine}] alerte ${input.category} non partie:`, r.channels);
      }
    } catch (err) {
      console.error(`[${origine}] notify a échoué:`, err);
      Sentry.captureException(err, { tags: { step: "notify", origine } });
    }
  };
  try {
    after(envoyer);
  } catch {
    void envoyer();
  }
}
