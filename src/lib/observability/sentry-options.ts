// Options Sentry côté serveur — point UNIQUE, partagé par deux processus.
//
// ## Pourquoi ce fichier existe
//
// Deux processus distincts remontent des erreurs serveur, et ils ne chargent
// PAS le même code :
//
//   - l'application Next (`sentry.server.config.ts`, chargé par son hook
//     d'instrumentation) ;
//   - le worker BullMQ (`server/queue/worker.ts`, lancé par `tsx`, HORS Next —
//     le hook d'instrumentation ne s'y exécute jamais).
//
// Recopier la configuration dans le second aurait produit deux vérités qui
// dérivent : le jour où quelqu'un ajuste `tracesSampleRate` ou ajoute un motif
// à `ignoreErrors` d'un côté, l'autre garde l'ancien — et personne ne le voit,
// puisqu'une configuration d'observabilité ne casse rien quand elle se trompe.
//
// 🔑 Le point qui compte pour la vie privée : `beforeSend` et
// `beforeSendTransaction` expurgent les données personnelles (RGPD art. 32,
// ADR 0010 — Sentry est hébergé aux États-Unis). Une seconde configuration
// écrite à la main aurait pu les OUBLIER, et un jeton ou une adresse serait
// parti chez un sous-traitant hors UE sans que rien ne le signale.

import { piiScrubBeforeSend, piiScrubBeforeSendTransaction } from "./sentry-pii-scrub";

/**
 * Construit les options d'initialisation communes aux deux processus serveur.
 *
 * @param dsn Le DSN, déjà vérifié non vide par l'appelant.
 */
export function optionsSentryServeur(dsn: string) {
  return {
    dsn,
    // V-04 P6 (Sprint Correctif suite 2026-05-22) — tracesSampleRate prod
    // 0.1 → 0.02 : overhead RUM/TTFB Caddy + RSC stream ramené de 10 % à 2 %.
    // -80 % requêtes tracées server-side, suffisant pour observabilité (cible
    // P1 audit V-04 : LCP server-side TTFB amélioré ~30-80 ms p75).
    // Dev reste 1.0 (full tracing local pour debug). Errors restent 100 %
    // (sampleRate par défaut, non changé — visibilité incidents préservée).
    tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.02 : 1.0,
    // Bruit non-actionnable : `controller[kState].transformAlgorithm is not a
    // function` (node:internal/webstreams/transformstream). Bug Next.js/Node 22
    // CONNU et non résolu (vercel/next.js#75995) : le contrôleur du
    // TransformStream que Next utilise pour streamer le RSC est corrompu quand
    // une connexion se FERME PRÉMATURÉMENT en plein stream. NON fatal.
    // Cf. _AUDIT/SENTRY-TRANSFORMSTREAM-2026-06-19/DECISION.md.
    ignoreErrors: [/transformAlgorithm is not a function/],
    environment: process.env["NEXT_PUBLIC_APP_ENV"] ?? "development",
    // Méta-cert 2026-05-15 AGENT 17 P1 — release tracking explicite.
    release: process.env["SENTRY_RELEASE"] ?? process.env["npm_package_version"],
    // Audit E2E 2026-05-11 P0-CONF-06 — RGPD Art. 32.
    sendDefaultPii: false,
    beforeSend: piiScrubBeforeSend,
    // Les transactions portent elles aussi `request.url` : sans ce hook, un
    // jeton partirait chez Sentry sans qu'aucune erreur ne se soit produite.
    beforeSendTransaction: piiScrubBeforeSendTransaction,
  };
}
