// Banc @formateurs — `@sentry/nextjs` : le signalement d'erreurs est un ENVOI vers un
// service extérieur. Dans le processus du banc il est coupé, comme le réseau
// (`reseau-simule.ts`) : chaque appel est un no-op, mais il est GARDÉ en mémoire
// (`globalThis.__BANC_SENTRY__`) pour qu'un scénario puisse constater un signalement.
//
// (Sous `tsx`, le paquet ne présente pas `captureException` à un import d'espace de
// noms : sans ce bouchon, le premier signalement d'une action lèverait `TypeError`.)

function noter(sorte, x) {
  const journal = (globalThis.__BANC_SENTRY__ ??= []);
  journal.push({ sorte, message: x instanceof Error ? x.message : String(x) });
  return "banc";
}

export const captureException = (e) => noter("exception", e);
export const captureMessage = (m) => noter("message", m);
export const setTag = () => {};
export const setUser = () => {};
export const setContext = () => {};
export const addBreadcrumb = () => {};
export const init = () => {};
export const flush = async () => true;
export const withScope = (cb) => cb({ setTag() {}, setExtra() {}, setContext() {}, setLevel() {} });
export const startSpan = (_o, cb) => cb({ end() {} });
export const captureRouterTransitionStart = () => {};
const integration = () => ({ name: "banc" });
export const linkedErrorsIntegration = integration;
export const inboundFiltersIntegration = integration;
export const httpIntegration = integration;
export const httpContextIntegration = integration;
export const globalHandlersIntegration = integration;
export const functionToStringIntegration = integration;
export const dedupeIntegration = integration;
export default { captureException, captureMessage, setTag, init, withScope, startSpan, flush };
