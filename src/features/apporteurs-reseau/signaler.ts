// ⚠️ Atteint par le WORKER (tsx, hors Next) : aucun `server-only` ici.
// Sous le worker, `import * as Sentry from "@sentry/nextjs"` n'expose PAS `captureException`
// (cf. `src/server/queue/lib/sentry-worker.ts`) : on passe donc par `captureWorkerError`,
// qui sait résoudre la fonction par l'autre chemin et ne lève jamais.

import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

/**
 * Signale une erreur du réseau d'apporteurs à Sentry. Fail-soft : ne lève JAMAIS, que l'on
 * soit sous Next ou sous le worker. Ne jamais passer de donnée personnelle dans `contexte`.
 */
export function signalerErreurReseau(contexte: string, err: unknown): void {
  try {
    const source = err instanceof Error ? err : new Error(String(err));
    const erreur = new Error(`[${contexte}] ${source.message}`);
    erreur.name = source.name;
    if (source.stack) erreur.stack = source.stack;
    captureWorkerError("apporteur-crons", "apporteur-crons", undefined, erreur);
  } catch {
    // Observabilité : jamais bloquante.
  }
}
