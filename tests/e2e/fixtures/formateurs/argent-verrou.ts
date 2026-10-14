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
const BAIL_MS = 180_000;

export async function avecVerrouArgent<T>(fn: () => Promise<T>): Promise<T> {
  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
  });
  const jeton = randomUUID();
  try {
    const limite = Date.now() + 600_000;
    while ((await redis.set(CLE, jeton, "PX", BAIL_MS, "NX")) !== "OK") {
      if (Date.now() > limite) throw new Error("verrou argent : attente de plus de 10 min");
      await new Promise((r) => setTimeout(r, 500));
    }
    return await fn();
  } finally {
    // Ne libère que SON verrou.
    if ((await redis.get(CLE)) === jeton) await redis.del(CLE);
    redis.disconnect();
  }
}
