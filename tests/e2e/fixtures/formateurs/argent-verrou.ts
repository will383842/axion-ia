// Banc @formateurs, équipe ARGENT — UN SCÉNARIO D'ARGENT À LA FOIS.
//
// Les scénarios d'argent posent des interrupteurs GLOBAUX (lignes `settings` :
// date de bascule, bilan de fin de formation, textes validés…) puis les rendent à
// l'état d'avant. Le job tourne avec plusieurs workers Playwright : deux scénarios
// d'argent en parallèle se couperaient leurs interrupteurs l'un l'autre. Ce verrou
// (une clé Redis, celle du job) les met en file ; les specs des autres équipes ne
// le prennent pas et ne sont pas ralenties.

import { randomUUID } from "node:crypto";

import { Redis } from "ioredis";

const CLE = "banc:formateurs:argent:verrou";
/** Au-delà, un verrou orphelin (processus tué) se libère seul. */
const BAIL_MS = 60_000;
/** Le détenteur vivant renouvelle son bail bien avant l'échéance (un scénario peut durer des minutes). */
const RENOUVELLEMENT_MS = 10_000;

// Comparer-puis-agir en UN seul appel : un `get` suivi d'un `del` laisserait un
// intervalle où le verrou a pu changer de main.
const PROLONGER = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end`;
const LIBERER = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

export async function avecVerrouArgent<T>(fn: () => Promise<T>): Promise<T> {
  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
  });
  const jeton = randomUUID();
  let renouvellement: ReturnType<typeof setInterval> | undefined;
  try {
    const limite = Date.now() + 600_000;
    while ((await redis.set(CLE, jeton, "PX", BAIL_MS, "NX")) !== "OK") {
      if (Date.now() > limite) throw new Error("verrou argent : attente de plus de 10 min");
      await new Promise((r) => setTimeout(r, 500));
    }
    // Tant que `fn` tourne, le bail est renouvelé : sans cela, un scénario de plus de
    // 180 s laissait un second scénario d'argent entrer et couper ses interrupteurs.
    renouvellement = setInterval(() => {
      void redis.eval(PROLONGER, 1, CLE, jeton, String(BAIL_MS)).catch(() => undefined);
    }, RENOUVELLEMENT_MS);
    return await fn();
  } finally {
    if (renouvellement) clearInterval(renouvellement);
    // Ne libère que SON verrou (comparaison et suppression atomiques).
    await redis.eval(LIBERER, 1, CLE, jeton).catch(() => undefined);
    redis.disconnect();
  }
}
