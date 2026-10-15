// Banc @formateurs, équipe ARGENT — UN SCÉNARIO D'ARGENT À LA FOIS.
//
// Les scénarios d'argent posent des interrupteurs GLOBAUX (lignes `settings` : date de
// bascule, bilan de fin de formation, textes validés…) puis les rendent à l'état d'avant,
// et leurs passages (suivi, campagnes, calcul mensuel) lisent TOUTE la base. Ils
// s'excluent donc entre eux, par une clé Redis à bail renouvelé.
//
// Les autres équipes n'ont plus à être attendues : depuis l'isolation par équipe
// (`scripts/banc-formateurs/groupes.mjs`), le groupe C tourne dans SON job, avec sa base,
// son Redis et son worker. Les verrous de A (clé Redis) et de B (fichier) ne sont donc
// plus pris ici.
//
// Le verrou est RENOUVELÉ tant que le scénario tourne : un bail qui expire en cours de
// route laisserait un voisin entrer sous les interrupteurs de celui-ci.

import { randomUUID } from "node:crypto";

import { Redis } from "ioredis";

const CLE_ARGENT = "banc:formateurs:argent:verrou";
/** Un verrou orphelin (processus tué) se libère seul ; le détenteur vivant le renouvelle. */
const BAIL_MS = 60_000;
const RENOUVELLEMENT_MS = 10_000;
/** Les scénarios s'enchaînent : on peut attendre presque tout le groupe. */
const ATTENTE_MAX_MS = 40 * 60_000;

// Comparer-puis-agir en UN seul appel : un `get` suivi d'un `del` laisserait un
// intervalle où le verrou a pu changer de main.
const PROLONGER = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end`;
const LIBERER = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function prendreCleRedis(redis: Redis, cle: string, jeton: string): Promise<void> {
  const limite = Date.now() + ATTENTE_MAX_MS;
  while ((await redis.set(cle, jeton, "PX", BAIL_MS, "NX")) !== "OK") {
    if (Date.now() > limite) throw new Error(`verrou ${cle} : attente de plus de 40 min`);
    await pause(500);
  }
}

export async function avecVerrouArgent<T>(fn: () => Promise<T>): Promise<T> {
  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
  });
  const jeton = `argent:${randomUUID()}`;
  let pris = false;
  let renouvellement: ReturnType<typeof setInterval> | undefined;
  try {
    await prendreCleRedis(redis, CLE_ARGENT, jeton);
    pris = true;
    // Le bridage à 40 e-mails par heure (worker de production) n'a pas d'objet devant un
    // puits ; on remet ce compteur à zéro à chaque tour.
    await redis.del("bull:emails:limiter");
    renouvellement = setInterval(() => {
      void redis.eval(PROLONGER, 1, CLE_ARGENT, jeton, String(BAIL_MS)).catch(() => undefined);
    }, RENOUVELLEMENT_MS);
    return await fn();
  } finally {
    if (renouvellement) clearInterval(renouvellement);
    // Ne libère que SON verrou (comparaison et suppression atomiques).
    if (pris) await redis.eval(LIBERER, 1, CLE_ARGENT, jeton).catch(() => undefined);
    redis.disconnect();
  }
}
