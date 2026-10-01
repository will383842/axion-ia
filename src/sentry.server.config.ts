import * as Sentry from "@sentry/nextjs";

import { optionsSentryServeur } from "./lib/observability/sentry-options";
import { corpsAIgnorer } from "./lib/observability/sentry-pii-scrub";

// ⚠️ Ce fichier ne couvre QUE l'application Next : il est chargé par le hook
// d'instrumentation de Next, qui ne s'exécute jamais dans le worker BullMQ
// (`tsx server/queue/worker.ts`, Node pur). L'initialisation du worker vit dans
// `server/queue/lib/sentry-worker-init.ts` et partage les MÊMES options, via
// `lib/observability/sentry-options.ts`.

const dsn = process.env["SENTRY_DSN"];

if (dsn) {
  Sentry.init({
    ...optionsSentryServeur(dsn),
    // Questionnaire en ligne (2026-10-01, veto sécurité PR 1258) : le SDK ne lit
    // pas le CORPS des requêtes des routes à requête secrète (jeton, réponses,
    // nom du client). Défense en profondeur : `piiScrubBeforeSend` les purge de
    // toute façon. Remplace l'intégration HTTP par défaut (même nom).
    integrations: [Sentry.httpIntegration({ ignoreIncomingRequestBody: corpsAIgnorer })],
  });
}
