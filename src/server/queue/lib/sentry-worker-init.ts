// Initialisation de Sentry DANS le processus worker — le second étage.
//
// ## Deux étages, et le premier seul ne suffisait pas
//
// Étage 1 (corrigé le 2026-09-01, PR #913) : `captureException` était
// INTROUVABLE sous `tsx`, parce que les exports conditionnels de
// `@sentry/nextjs` donnent 28 symboles à la condition `import` et 201 à la
// condition `require`. `sentry-worker.ts` résout désormais la fonction par la
// seconde.
//
// 🔴 Étage 2, trouvé juste après : le worker n'appelle JAMAIS
// `Sentry.init`. Les trois `Sentry.init` du dépôt vivent dans
// `sentry.server.config.ts`, `sentry.edge.config.ts` et
// `instrumentation-client.ts` — tous chargés par Next, et le hook
// d'instrumentation de Next **ne s'exécute pas** sous `tsx`. Sans client, un
// `captureException` résolu ne lève plus et ne part nulle part.
//
// 🔑 Ce qui rend cette panne redoutable : **un appel qui part
// nulle part a exactement la même tête qu'un appel qui marche.** Rien ne casse,
// aucun journal, aucune différence observable — sauf l'absence d'événements
// dans Sentry, qui ressemble à « tout va bien ». C'est ce qui a masqué une
// panne de quota OpenAI pendant plusieurs jours.
//
// ## Ce que ce module garantit, et ce qu'il ne garantit pas
//
// ✅ Si `SENTRY_DSN` est posée, un client est initialisé avec **exactement** les
//    mêmes options que l'application Next — expurgation des données
//    personnelles comprise (`lib/observability/sentry-options.ts`).
//
// ❌ Il ne peut pas garantir que la variable EST posée sur l'application
//    Coolify `axion-ia-worker`. C'est un réglage d'exploitation. D'où le
//    signalement bruyant ci-dessous : sans lui, l'absence de DSN serait aussi
//    silencieuse que la panne qu'on vient de corriger.

import * as Sentry from "@sentry/nextjs";

import { optionsSentryServeur } from "@/lib/observability/sentry-options";

/**
 * Initialise Sentry pour le processus worker.
 *
 * À appeler comme TOUTE PREMIÈRE instruction de `worker.ts` : une erreur levée
 * au démarrage d'un worker, avant l'initialisation, ne serait pas capturée.
 *
 * @returns `true` si un client a été initialisé, `false` si `SENTRY_DSN` est absente.
 */
export function initialiserSentryWorker(): boolean {
  const dsn = process.env["SENTRY_DSN"]?.trim();

  if (!dsn) {
    // Bruyant, et en `error` plutôt qu'en `warn` : c'est l'état dans lequel
    // TOUTES les erreurs des 33 workers disparaissent en silence. Le signaler
    // discrètement reviendrait à reproduire le défaut d'à côté.
    console.error(
      "[sentry-worker-init] ⛔ SENTRY_DSN absente du processus worker — " +
        "AUCUNE erreur de worker ne sera remontée. Les appels à " +
        "`captureWorkerError()` ne lèveront pas et ne partiront nulle part. " +
        "Poser SENTRY_DSN sur l'application Coolify `axion-ia-worker` " +
        "(portée RUN), puis redéployer.",
    );
    return false;
  }

  Sentry.init(optionsSentryServeur(dsn));
  // La confirmation est journalisée par l'appelant (`worker.ts`), qui porte
  // déjà la bannière de démarrage — et où `console.log` est admis. Ici on rend
  // seulement le verdict, ce qui garde ce module testable sans capturer la
  // sortie standard.
  return true;
}
