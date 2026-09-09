// Battement du webhook de rebonds : savoir si ZeptoMail nous appelle VRAIMENT.
//
// ## Le trou que ce module ferme
//
// `health.ts` porte deja `detectionRebondsDebranchee`, leve quand
// `ZEPTOMAIL_WEBHOOK_KEY` est absente. Ce drapeau couvre un seul cas : la cle
// n'est pas posee, donc aucun rebond n'est enregistrable.
//
// Mesure du 2026-09-01 : la cle EST posee en production (un POST non signe sur
// `/api/zeptomail/webhook` rend 401, pas le 200 muet du cas non configure). Le
// recepteur est donc arme. Mais il restait une question sans reponse :
//
//   ZeptoMail appelle-t-il reellement cette route ?
//
// Une cle posee cote NOUS ne prouve rien sur l'abonnement cote EUX. Si le
// webhook n'a jamais ete enregistre dans la console ZeptoMail, la route est
// armee, correcte, testee — et ne sera jamais appelee. `rebondsRecents` vaudrait
// 0 pour toujours, avec `detectionRebondsDebranchee` a faux : le rendu exact
// d'une chaine saine.
//
// ## Pourquoi un BATTEMENT et pas une ALERTE
//
// La tentation est d'alerter sur le silence : « aucun appel depuis N jours ».
// Ce serait crier au loup. ZeptoMail n'appelle que sur EVENEMENT ; si aucun
// message ne rebondit, le silence est le comportement d'un systeme en parfait
// etat. Une alerte qui se declenche quand tout va bien finit ignoree, et elle
// emporte dans son discredit les alertes qui, elles, disent vrai.
//
// On enregistre donc une DATE, et on la fait remonter dans la ligne horaire de
// `verifierSanteEmails()`. La question cesse d'etre indecidable : elle devient
// une valeur qu'on lit.
//
// ## Comment obtenir une reponse DEFINITIVE en trente secondes
//
// Console ZeptoMail -> Webhooks -> le webhook des rebonds -> « Test ». Puis,
// dans les journaux Coolify de l'application web, chercher `email-sante:` :
//
//   - `authentifie : 2026-09-01T...`  -> l'abonnement existe ET la cle concorde.
//   - `recu : <date>` + `authentifie : JAMAIS`  -> ZeptoMail NOUS ATTEINT, mais
//     la signature est refusee : cle desynchronisee entre les deux cotes.
//   - `recu : JAMAIS`  -> rien n'atteint la route. Verifier l'URL enregistree
//     dans la console ZeptoMail, et que le webhook y existe bel et bien.
//
// ⚠️ CE QUE CE MODULE NE SAVAIT PAS DIRE AVANT LE 2026-09-07, et qui l'a rendu
// muet pendant une semaine : `noterAppelWebhook()` n'etait appele qu'APRES la
// verification de signature. Un appel refuse ne laissait donc AUCUNE trace ici
// — et la route rend `200 {ok:true, ignored:"invalid_signature"}`, pas 401
// (choix delibere : ZeptoMail sonde l'URL en POST NON SIGNE avant d'autoriser
// la creation du webhook, un 401 fermait le cercle). ZeptoMail lisait donc un
// succes, ne reessayait pas, et `JAMAIS` s'affichait aussi bien pour
// « personne n'appelle » que pour « on appelle et on est refuse ».
//
// 🔑 Deux pannes, un seul zero : c'est la definition d'un instrument qui ne
// mesure pas. D'ou les DEUX battements ci-dessous — `recu` est pose AVANT la
// signature, `authentifie` apres. Leur ECART est le diagnostic.
//
// ⚠️ Le paragraphe ci-dessus disait « un POST non signe rend 401 ». C'etait vrai
// le 2026-09-01, ca ne l'est plus. Un lecteur qui teste aujourd'hui obtient 200
// et conclurait « clé absente » — l'inverse de la verite.
//
// ## Stockage
//
// Redis, pas Postgres : c'est une donnee d'exploitation, sans valeur
// historique, et elle ne merite pas une migration. La perte de la valeur a un
// redemarrage de Redis est sans consequence — le prochain appel la repose, et
// « JAMAIS » apres un redemarrage se lit pour ce qu'il est.

import { redis } from "@/lib/redis";

/** Pas de TTL : un battement qui expire ne se distingue pas d'une absence. */
const CLE = "zeptomail:webhook:dernier-appel";

/**
 * Battement des appels RECUS, quelle que soit l'issue de la signature.
 *
 * Pose avant toute verification : c'est ce qui permet de distinguer
 * « ZeptoMail ne nous appelle pas » de « ZeptoMail nous appelle et on le
 * refuse ». Sans lui, les deux rendent `JAMAIS`.
 */
const CLE_RECU = "zeptomail:webhook:dernier-appel-recu";

/**
 * Note qu'un appel AUTHENTIFIE vient d'arriver.
 *
 * A appeler apres la verification de signature et AVANT l'analyse du contenu :
 * un appel de test ZeptoMail, ou un evenement qui n'est pas un rebond, prouve
 * l'abonnement tout aussi bien qu'un vrai rebond. C'est l'abonnement qu'on
 * mesure ici, pas les rebonds.
 *
 * Fail-soft : une panne Redis ne doit jamais faire echouer le webhook. Un 500
 * repete fait desabonner ZeptoMail — on detruirait l'abonnement qu'on surveille.
 */
export async function noterAppelWebhook(maintenant: Date = new Date()): Promise<void> {
  try {
    await redis.set(CLE, maintenant.toISOString());
  } catch {
    // Silence volontaire : voir ci-dessus. L'absence de battement se lira
    // comme « JAMAIS », ce qui est le bon defaut prudent.
  }
}

/**
 * Note qu'un appel vient d'arriver sur la route, AVANT toute verification.
 *
 * A appeler des que la cle de webhook est connue presente, donc avant le
 * controle de taille, avant la limite de debit et surtout avant la signature :
 * la question a laquelle ce battement repond est « quelque chose atteint-il
 * cette route ? », pas « cet appel etait-il valide ? ».
 *
 * Fail-soft, meme raison que {@link noterAppelWebhook} : une panne Redis ne
 * doit jamais faire echouer le webhook, sous peine de faire desabonner
 * ZeptoMail — on detruirait l'abonnement qu'on surveille.
 */
export async function noterAppelRecu(maintenant: Date = new Date()): Promise<void> {
  try {
    await redis.set(CLE_RECU, maintenant.toISOString());
  } catch {
    // Silence volontaire : l'absence de battement se lira comme « JAMAIS ».
  }
}

/**
 * Delai au-dela duquel on abandonne la lecture.
 *
 * 🔴 Sans cette borne, la lecture PEND quand Redis est injoignable — et elle
 * est appelee depuis `verifierSanteEmails()`, c'est-a-dire depuis la fonction
 * qui surveille la chaine d'envoi, elle-meme portee par un cron horaire.
 * Une surveillance qui se bloque emporte dans son silence tout ce que son cron
 * surveille par ailleurs. Constate le 2026-09-01 : la premiere version de ce
 * module, sans borne, a fait expirer neuf tests de `health.spec.ts` a 5 s.
 * Ces tests ne simulaient pas Redis, donc ils ont mesure le comportement REEL
 * face a un Redis absent — exactement le cas qu'on doit survivre en production.
 */
const DELAI_LECTURE_MS = 1_500;

/**
 * Date ISO du dernier appel RECU sur la route, authentifie ou non.
 *
 * Compare a {@link lireDernierAppelWebhook}, il repond a une autre question :
 * non pas « un appel valide est-il arrive ? » mais « quelque chose atteint-il
 * cette route ? ». Un ecart entre les deux — recu date, authentifie JAMAIS —
 * designe une cle desynchronisee, et rien d autre.
 *
 * Ne leve jamais, et ne depasse jamais {@link DELAI_LECTURE_MS}.
 */
export async function lireDernierAppelRecu(): Promise<string | null> {
  return lireBattement(CLE_RECU);
}

/**
 * Date ISO du dernier appel authentifie, ou `null` si aucun n'a jamais ete vu.
 *
 * `null` ne signifie pas « casse » : il signifie « jamais observe ». La nuance
 * est dans le nom de la fonction appelante et dans la ligne journalisee.
 *
 * Ne leve jamais, et ne depasse jamais {@link DELAI_LECTURE_MS}.
 */
export async function lireDernierAppelWebhook(): Promise<string | null> {
  return lireBattement(CLE);
}

/** Lecture bornee et fail-soft, commune aux deux battements. */
async function lireBattement(cle: string): Promise<string | null> {
  try {
    const valeur = await Promise.race([
      redis.get(cle),
      new Promise<null>((resoudre) => setTimeout(() => resoudre(null), DELAI_LECTURE_MS)),
    ]);
    return typeof valeur === "string" && valeur.length > 0 ? valeur : null;
  } catch {
    return null;
  }
}
