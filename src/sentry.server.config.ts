import * as Sentry from "@sentry/nextjs";

import { optionsSentryServeur } from "./lib/observability/sentry-options";

// ⚠️ Ce fichier ne couvre QUE l'application Next : il est chargé par le hook
// d'instrumentation de Next, qui ne s'exécute jamais dans le worker BullMQ
// (`tsx server/queue/worker.ts`, Node pur). L'initialisation du worker vit dans
// `server/queue/lib/sentry-worker-init.ts` et partage les MÊMES options, via
// `lib/observability/sentry-options.ts`.

const dsn = process.env["SENTRY_DSN"];

if (dsn) {
  Sentry.init(optionsSentryServeur(dsn));
}
