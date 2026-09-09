/**
 * Chargement différé du SDK Sentry côté navigateur, et capture des erreurs de
 * frontière React.
 *
 * ## 🔴 2026-09-09 — TROIS FRONTIÈRES D'ERREUR, ZÉRO ÉVÉNEMENT
 *
 * La page `/qualiopi/alertes` affiche par intermittence l'écran `global-error`
 * en production. La consigne de reprise disait « chercher la trace exacte dans
 * Sentry, un `global-error` déclenché signifie qu'un événement est parti ».
 * **Aucun événement ne pouvait partir**, pour deux raisons indépendantes qui
 * donnaient le même silence :
 *
 *   1. **`global-error.tsx` et `[locale]/error.tsx` n'appelaient pas Sentry.**
 *      Le premier faisait `console.error`, le second portait le commentaire
 *      « Sprint 21 wires Sentry capture here. For now we log to the browser. »
 *      Personne ne lit la console d'un visiteur.
 *   2. **Le SDK n'est pas encore initialisé quand l'erreur survient.**
 *      `instrumentation-client.ts` diffère `Sentry.init()` à
 *      `requestIdleCallback` (repli 3 s) pour tenir le budget Web Vitals — un
 *      arbitrage assumé et documenté. Or une erreur d'hydratation survient dans
 *      la première seconde, et sur une page lourde le fil principal est
 *      justement occupé, donc l'inactivité arrive PLUS TARD. `captureException`
 *      sans client attaché ne lève pas : l'événement est **abandonné en
 *      silence**.
 *
 * ⟹ La frontière admin (`[adminPrefix]/error.tsx`) appelait pourtant bien
 * `Sentry.captureException` depuis mai 2026. Elle était soumise à la raison 2 :
 * son instrumentation paraissait en place et ne rapportait rien.
 *
 * 🔑 UNE CAPTURE QUI ARRIVE AVANT L'INITIALISATION EST INDISCERNABLE D'UNE
 * ABSENCE D'ERREUR. C'est pourquoi ce module ne se contente pas d'appeler
 * `captureException` : une erreur de frontière **force** le chargement du SDK
 * au lieu d'attendre l'inactivité, puis émet. Le compromis de performance est
 * préservé — le chemin nominal n'a pas changé, et forcer le chargement ne coûte
 * quelque chose que sur une page qui vient déjà de casser.
 */

type SentryModule = typeof import("@sentry/nextjs");

let sentryModule: SentryModule | null = null;
let sentryInitPromise: Promise<SentryModule | null> | null = null;

/**
 * Charge et initialise le SDK Sentry navigateur. Idempotent, et sûr à appeler
 * en concurrence : les appelants simultanés partagent la même promesse.
 *
 * Rend `null` quand aucun DSN n'est configuré (développement, recette locale) —
 * ce n'est pas une erreur, c'est l'absence de destination.
 */
export async function chargerSentry(): Promise<SentryModule | null> {
  if (sentryModule) return sentryModule;
  if (sentryInitPromise) return sentryInitPromise;

  const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];
  if (!dsn) return null;

  sentryInitPromise = (async () => {
    const [Sentry, { piiScrubBeforeSend }] = await Promise.all([
      import("@sentry/nextjs"),
      import("./sentry-pii-scrub"),
    ]);

    Sentry.init({
      dsn,
      // Slim integrations (batch 2 `df5b9ed`) — pas de BrowserTracing/Replay/
      // Breadcrumbs (économise ~80-100 KB raw vs default).
      defaultIntegrations: false,
      integrations: [
        Sentry.dedupeIntegration(),
        Sentry.inboundFiltersIntegration(),
        Sentry.functionToStringIntegration(),
        Sentry.linkedErrorsIntegration(),
        Sentry.globalHandlersIntegration(),
        Sentry.httpContextIntegration(),
      ],
      tracesSampleRate: 0,
      // Méta-cert 2026-05-15 AGENT 17 P1 — release tracking explicite cohérent
      // avec sentry.{server,edge}.config.ts. NEXT_PUBLIC_SENTRY_RELEASE pour le
      // client (lisible côté browser), fallback SENTRY_RELEASE puis npm version.
      environment: process.env["NEXT_PUBLIC_APP_ENV"] ?? "development",
      release:
        process.env["NEXT_PUBLIC_SENTRY_RELEASE"] ??
        process.env["SENTRY_RELEASE"] ??
        process.env["npm_package_version"],
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      sendDefaultPii: false,
      beforeSend: piiScrubBeforeSend,
    });

    if (process.env["NODE_ENV"] === "production") {
      Sentry.setTag("runtime.client", "browser");
    }

    sentryModule = Sentry;
    return Sentry;
  })();

  return sentryInitPromise;
}

/** Vrai si le SDK est déjà chargé — n'est utile qu'aux tests et à `onRouterTransitionStart`. */
export function sentryDejaCharge(): SentryModule | null {
  return sentryModule;
}

/** Nom de la frontière React qui a rattrapé l'erreur. Devient un tag Sentry. */
export type FrontiereErreur = "global-error" | "locale-error" | "admin-error";

/**
 * Signale une erreur rattrapée par une frontière React.
 *
 * ⚠️ **Ne jette jamais.** Elle est appelée depuis un `useEffect` d'écran
 * d'erreur : y lever une exception remplacerait la page d'erreur par une autre
 * erreur, ce que l'utilisateur verrait comme une boucle.
 *
 * 🔑 Le `console.error` est conservé et émis EN PREMIER, avant tout `await` :
 * il est le seul signal disponible quand le DSN est absent (développement), et
 * c'est celui que la recette navigateur lit. Le supprimer au profit de Sentry
 * échangerait une trace lisible tout de suite contre une trace lisible ailleurs.
 *
 * ⚠️ **La promesse rendue existe pour la RECETTE, pas pour les appelants.** Les
 * frontières l'ignorent avec `void` — un `useEffect` ne doit rien rendre d'autre
 * qu'une fonction de nettoyage. Sans elle, un test ne peut qu'attendre « assez
 * longtemps » : le chemin comporte deux `import()` dynamiques, qui ne se
 * résolvent pas en un nombre fixe de micro-tâches. Un témoin qui court après un
 * minuteur finit par verdir sur une machine lente et rougir sur une rapide, ce
 * qui est pire que pas de témoin.
 */
export async function capturerErreurDeFrontiere(
  error: Error & { digest?: string },
  frontiere: FrontiereErreur,
): Promise<void> {
  // Seul signal disponible quand aucun DSN n'est configuré (développement).
  console.error(`[${frontiere}]`, error);

  try {
    // Forcer le chargement : ne PAS attendre `requestIdleCallback`. Voir le
    // bloc en tête de fichier — c'est toute la raison d'être de ce module.
    const Sentry = await chargerSentry();
    if (!Sentry) return;
    Sentry.captureException(error, {
      tags: { boundary: frontiere },
      extra: { digest: error.digest ?? null },
    });
  } catch {
    // Le rapport d'erreur ne doit jamais devenir la panne suivante.
  }
}
