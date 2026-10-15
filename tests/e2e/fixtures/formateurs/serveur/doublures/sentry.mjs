// `@sentry/nextjs` pour l'exécuteur des étapes : la construction SERVEUR, celle que
// Next charge, lue par `require`. Sous `tsx`, la condition `import` n'expose que
// 28 symboles, sans `captureException` (cf. `src/server/queue/lib/sentry-worker-init.ts`) ;
// et un module CommonJS importé en ESM n'expose que les noms que son analyseur
// détecte. Les fonctions que le code appelle sont donc relayées une à une. Aucun
// client n'est initialisé : un signalement ne part nulle part.
import { createRequire } from "node:module";

const S = createRequire(import.meta.url)("@sentry/nextjs");

export const captureException = (...a) => S.captureException(...a);
export const captureMessage = (...a) => S.captureMessage(...a);
export const setTag = (...a) => S.setTag(...a);
export const init = (...a) => S.init(...a);
export default S;
