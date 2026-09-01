/**
 * Sonde exécutée PAR `sentry-worker-atteint-vraiment-sentry.spec.ts`, sous
 * `tsx` — exactement le runtime du worker (`tsx src/server/queue/worker.ts`).
 *
 * Elle n'est PAS un test : c'est le sujet de mesure. Vitest la lance dans un
 * processus séparé, parce que Vite résout `@sentry/nextjs` autrement que Node et
 * masquerait précisément le défaut qu'on surveille. Éprouvé le 2026-09-01 : une
 * première version de la garde, écrite en vitest, restait VERTE après
 * neutralisation du repli — elle ne mesurait rien.
 *
 * Extension `.mts` et suffixe `.fixture` : les deux la tiennent hors de la
 * collecte de vitest.
 *
 * ⚠️ `flush` et `close` sont pris par la résolution CJS : le build ESM
 * n'expose que 28 symboles et ne les porte pas non plus. L'initialisation, elle,
 * reste sur le chemin ESM — c'est celui du worker, et c'est justement la
 * liaison ESM→CJS qu'on veut éprouver.
 *
 * Sortie : une seule ligne, `VERDICT:<atteint|perdu>`.
 */

import { createRequire } from "node:module";

import * as Sentry from "@sentry/nextjs";

import { captureWorkerError } from "../sentry-worker.js";

const cjs = createRequire(import.meta.url)("@sentry/nextjs") as {
  flush: (t: number) => Promise<boolean>;
  close: (t: number) => Promise<boolean>;
};

const vus: string[] = [];

Sentry.init({
  // DSN valide en forme, qui ne désigne aucun projet. `beforeSend` rend null :
  // rien ne part sur le réseau.
  dsn: "https://0123456789abcdef0123456789abcdef@o0.ingest.sentry.io/0",
  beforeSend(evenement) {
    vus.push(evenement.exception?.values?.[0]?.value ?? "");
    return null;
  },
});

captureWorkerError("email", "email", undefined, new Error("sonde-de-liaison"));
await cjs.flush(3000);
await cjs.close(2000);

console.log("VERDICT:" + (vus.includes("sonde-de-liaison") ? "atteint" : "perdu"));
