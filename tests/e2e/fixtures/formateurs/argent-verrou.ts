// Banc @formateurs, équipe ARGENT — UN SCÉNARIO D'ARGENT À LA FOIS, ET JAMAIS EN MÊME
// TEMPS QU'UN SCÉNARIO D'UNE AUTRE ÉQUIPE.
//
// Les scénarios d'argent posent des interrupteurs GLOBAUX (lignes `settings` : date de
// bascule, bilan de fin de formation, textes validés…) puis les rendent à l'état d'avant,
// et leurs passages (suivi, campagnes, calcul mensuel) lisent TOUTE la base. Les autres
// équipes ont chacune leur verrou, qui n'exclut que leurs propres scénarios :
//   · équipe A (entrée, contrat) : clé Redis `banc:formateurs:scenario` (`scenario.ts`) ;
//   · équipe B (missions)        : fichier `scenarios-missions.verrou` (`missions-scenario.ts`).
// Un scénario d'argent prend donc LES TROIS — le fichier de B, puis la clé de A, puis sa
// propre clé — dans cet ordre fixe (A et B n'en prennent qu'un : aucun interblocage). Il
// en résulte qu'une date de bascule posée ici n'est jamais vue par un scénario voisin, ni
// ses passages par des données qui ne sont pas les siennes.
//
// Chaque verrou est RENOUVELÉ tant que le scénario tourne : un bail qui expire en cours de
// route laisserait un voisin entrer sous les interrupteurs de celui-ci.

import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, stat, unlink, utimes } from "node:fs/promises";
import path from "node:path";

import { Redis } from "ioredis";

const CLE_ARGENT = "banc:formateurs:argent:verrou";
/** Le verrou des scénarios de l'équipe A (voir `scenario.ts`) : même clé, même sens. */
const CLE_SCENARIOS = "banc:formateurs:scenario";
/** Le verrou fichier de l'équipe B (voir `missions-scenario.ts`) : même chemin, même format. */
const FICHIER_MISSIONS = path.join(
  process.env["IMAGE_BANK_STORAGE_PATH"]
    ? path.dirname(process.env["IMAGE_BANK_STORAGE_PATH"])
    : "/tmp/banc-formateurs/stockage",
  "scenarios-missions.verrou",
);
/** Un verrou orphelin (processus tué) se libère seul ; le détenteur vivant le renouvelle. */
const BAIL_MS = 60_000;
const RENOUVELLEMENT_MS = 10_000;
/** Les scénarios s'enchaînent (~16 min au total) : on peut attendre presque tout le banc. */
const ATTENTE_MAX_MS = 40 * 60_000;
/** Plus vieux que ceci, le fichier de B appartient à un processus mort (même seuil que B). */
const FICHIER_PERIME_MS = 15 * 60_000;

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

async function prendreFichier(jeton: string): Promise<void> {
  await mkdir(path.dirname(FICHIER_MISSIONS), { recursive: true });
  const limite = Date.now() + ATTENTE_MAX_MS;
  for (;;) {
    try {
      const f = await open(FICHIER_MISSIONS, "wx");
      await f.writeFile(jeton);
      await f.close();
      return;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      if (Date.now() > limite) throw new Error("verrou missions : attente de plus de 40 min");
      try {
        if (Date.now() - (await stat(FICHIER_MISSIONS)).mtimeMs > FICHIER_PERIME_MS)
          await unlink(FICHIER_MISSIONS);
      } catch {
        // Rendu entre-temps : on retente.
      }
      await pause(500);
    }
  }
}

export async function avecVerrouArgent<T>(fn: () => Promise<T>): Promise<T> {
  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
  });
  const jeton = `argent:${randomUUID()}`;
  let fichierPris = false;
  const cles: string[] = [];
  let renouvellement: ReturnType<typeof setInterval> | undefined;
  try {
    await prendreFichier(jeton);
    fichierPris = true;
    await prendreCleRedis(redis, CLE_SCENARIOS, jeton);
    cles.push(CLE_SCENARIOS);
    await prendreCleRedis(redis, CLE_ARGENT, jeton);
    cles.push(CLE_ARGENT);
    // Le bridage à 40 e-mails par heure (worker de production) n'a pas d'objet devant un
    // puits ; les scénarios des autres équipes remettent ce compteur à zéro à chaque tour.
    await redis.del("bull:emails:limiter");
    renouvellement = setInterval(() => {
      for (const cle of cles)
        void redis.eval(PROLONGER, 1, cle, jeton, String(BAIL_MS)).catch(() => undefined);
      // Le fichier : sa date est son bail.
      const maintenant = new Date();
      void utimes(FICHIER_MISSIONS, maintenant, maintenant).catch(() => undefined);
    }, RENOUVELLEMENT_MS);
    return await fn();
  } finally {
    if (renouvellement) clearInterval(renouvellement);
    // Ne libère que SES verrous (comparaison et suppression atomiques / jeton relu).
    for (const cle of cles.reverse())
      await redis.eval(LIBERER, 1, cle, jeton).catch(() => undefined);
    if (fichierPris) {
      try {
        if ((await readFile(FICHIER_MISSIONS, "utf8")) === jeton) await unlink(FICHIER_MISSIONS);
      } catch {
        // Déjà rendu.
      }
    }
    redis.disconnect();
  }
}
