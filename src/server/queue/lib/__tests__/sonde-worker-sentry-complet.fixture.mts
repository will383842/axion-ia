/**
 * Sonde du CHEMIN COMPLET, exécutée sous `tsx` — le runtime du worker.
 *
 * 🔑 Ce qui la distingue de `sonde-sentry-worker.fixture.mts` : celle-ci
 * n'appelle PAS `Sentry.init` elle-même. Elle appelle `initialiserSentryWorker()`,
 * c'est-à-dire le code que le worker exécute réellement.
 *
 * C'est exactement l'écart qui a laissé passer l'étage 2. La première sonde
 * initialisait Sentry de sa propre main, donc elle mesurait le pont
 * (`captureException` résolu) en supposant le client déjà présent — alors que
 * dans le worker, personne ne l'avait jamais créé. Une sonde qui fournit
 * elle-même la condition qu'elle devrait vérifier ne vérifie rien.
 *
 * Sortie : `VERDICT:<atteint|perdu|sans-dsn>`.
 */

import { createRequire } from "node:module";

import { initialiserSentryWorker } from "../sentry-worker-init.js";
import { captureWorkerError } from "../sentry-worker.js";

const cjs = createRequire(import.meta.url)("@sentry/nextjs") as {
  getClient: () => unknown;
  flush: (t: number) => Promise<boolean>;
  close: (t: number) => Promise<boolean>;
};

// DSN de forme valide, projet inexistant. Rien ne part : le transport
// échouerait à joindre l'hôte, et on ferme avant d'attendre.
process.env["SENTRY_DSN"] = "https://0123456789abcdef0123456789abcdef@o0.ingest.sentry.io/0";

const initialise = initialiserSentryWorker();
if (!initialise) {
  console.log("VERDICT:sans-dsn");
  process.exit(0);
}

// Le client existe-t-il APRÈS le seul appel que le worker fait vraiment ?
const client = cjs.getClient();
if (!client) {
  console.log("VERDICT:perdu");
  process.exit(0);
}

// Et l'événement traverse-t-il le pont ESM → CJS jusqu'à ce client ?
let vu = false;
const c = client as { on?: (ev: string, cb: (...a: unknown[]) => void) => void };
c.on?.("beforeEnvelope", () => {
  vu = true;
});

captureWorkerError("email", "email", undefined, new Error("sonde-chemin-complet"));
await cjs.flush(3000);
await cjs.close(2000);

console.log("VERDICT:" + (vu ? "atteint" : "perdu"));
