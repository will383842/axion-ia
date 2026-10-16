// Banc @formateurs, équipe sécurité — `@sentry/nextjs` sous `tsx`.
//
// Chargé sous `tsx`, l'espace de noms du paquet n'expose ses fonctions que par
// `default` (interopérabilité CommonJS) : `Sentry.captureException` y vaut
// `undefined`, et une garde qui REFUSE puis signale le refus (ex. : code de
// signature demandé pour une adresse non concordante) levait un `TypeError` au
// lieu de rendre son refus. On rend ici les fonctions du vrai module, prises sur
// `default` quand il le faut. Sans DSN, elles ne transmettent rien.

import * as reel from "@sentry/nextjs";

type Fonction = (...args: unknown[]) => unknown;
const S = ((reel as unknown as { default?: Record<string, unknown> }).default ?? reel) as Record<
  string,
  unknown
>;
const appeler =
  (nom: string): Fonction =>
  (...args) =>
    typeof S[nom] === "function" ? (S[nom] as Fonction)(...args) : undefined;

export const captureException = appeler("captureException");
export const captureMessage = appeler("captureMessage");
export const setTag = appeler("setTag");
export const withScope = appeler("withScope");
export const addBreadcrumb = appeler("addBreadcrumb");
export default S;
