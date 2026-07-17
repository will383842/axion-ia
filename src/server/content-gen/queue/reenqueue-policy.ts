/**
 * Content Generator — politique de ré-enfilage BullMQ (fix 2026-07-17).
 *
 * Module PUR (aucun import BullMQ/Prisma) → testable sans mock.
 *
 * ## Le bug corrigé (cause racine des « 84 articles queued absents de Redis »)
 *
 * `enqueueGenJob` faisait `queue.add(..., { jobId: \`gen-${id}\` })` **sans
 * supprimer le job BullMQ précédent**. Or les jobs terminés sont CONSERVÉS dans
 * Redis (`removeOnFail: { age: 30j, count: 5000 }`, cf. `queues.ts`) : la clé
 * `gen-${id}` existe donc encore quand on relance un job `failed`.
 *
 * BullMQ **ignore silencieusement** un `add` dont le jobId existe déjà et
 * renvoie le job existant. Résultat : `retryJob` / `retryAllFailed` passaient le
 * job à `queued` en base, le `add` no-oppait, et le job devenait **zombie** —
 * `queued` en DB, absent de Redis, jamais traité.
 *
 * Mesuré en prod le 2026-07-17 : le set `failed` de la queue `content-gen`
 * contenait 1046 jobs → la collision était garantie, pas hypothétique.
 *
 * ## Pourquoi ne PAS changer le jobId
 *
 * Un jobId unique par tentative (`gen-${id}-r${retryCount}`) casserait les 4
 * sites qui retrouvent le job par sa clé pour le supprimer : `cancelJob`
 * (`jobs.ts`), `coverage.ts` (×2) et `content-gen-deadline-checker.ts`. On garde
 * donc la clé stable et on supprime explicitement le job périmé avant le `add` —
 * le motif que `cancelJob` utilise déjà (`getJob` puis `remove`).
 *
 * ## L'idempotence voulue est préservée
 *
 * Le commentaire d'origine (« jobId empêche les doublons ») n'est vrai que pour
 * un job **en vol**. On conserve cette propriété : si le job est encore
 * `active` / `waiting` / `delayed`, on ne touche à rien. Ce n'est que pour un job
 * **terminé** (`completed` / `failed`) que la clé squatte Redis et doit partir.
 */

/** États BullMQ retournés par `Job.getState()`. */
export type BullJobState =
  | "active"
  | "waiting"
  | "waiting-children"
  | "prioritized"
  | "delayed"
  | "completed"
  | "failed"
  | "unknown";

export type ReenqueueAction =
  /** Aucun job BullMQ existant → `add` direct. */
  | "enqueue"
  /** Job encore en vol → ne rien faire (idempotence voulue). */
  | "skip-in-flight"
  /** Job terminé dont la clé squatte Redis → `remove()` puis `add`. */
  | "remove-then-enqueue";

/**
 * Décide quoi faire d'un job BullMQ portant déjà la clé cible.
 *
 * @param state `null` si aucun job n'existe pour cette clé.
 */
export function resolveReenqueueAction(state: BullJobState | null): ReenqueueAction {
  if (state === null) return "enqueue";
  switch (state) {
    case "active":
    case "waiting":
    case "waiting-children":
    case "prioritized":
    case "delayed":
      return "skip-in-flight";
    case "completed":
    case "failed":
      return "remove-then-enqueue";
    case "unknown":
      // BullMQ renvoie "unknown" pour un job dont la clé a expiré/été purgée
      // entre le getJob et le getState. Le remove est alors un no-op inoffensif
      // et garantit que le add ne no-oppera pas.
      return "remove-then-enqueue";
  }
}
