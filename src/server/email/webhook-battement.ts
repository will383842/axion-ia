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
//   - `dernier appel webhook : 2026-09-01T...`  -> l'abonnement existe et porte.
//   - `dernier appel webhook : JAMAIS`          -> ZeptoMail n'atteint pas la
//     route. Verifier l'URL enregistree, puis que la cle des deux cotes est la
//     meme (une cle differente rend 401, et ZeptoMail desabonne au bout de
//     plusieurs echecs).
//
// ## Stockage
//
// Redis, pas Postgres : c'est une donnee d'exploitation, sans valeur
// historique, et elle ne merite pas une migration. La perte de la valeur a un
// redemarrage de Redis est sans consequence — le prochain appel la repose, et
// « JAMAIS » apres un redemarrage se lit pour ce qu'il est.

import { redis } from "@/lib/redis";

/** Cle unique. Pas de TTL : un battement qui expire ne se distingue pas d'une absence. */
const CLE = "zeptomail:webhook:dernier-appel";

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
 * Date ISO du dernier appel authentifie, ou `null` si aucun n'a jamais ete vu.
 *
 * `null` ne signifie pas « casse » : il signifie « jamais observe ». La nuance
 * est dans le nom de la fonction appelante et dans la ligne journalisee.
 *
 * Ne leve jamais, et ne depasse jamais {@link DELAI_LECTURE_MS}.
 */
export async function lireDernierAppelWebhook(): Promise<string | null> {
  try {
    const valeur = await Promise.race([
      redis.get(CLE),
      new Promise<null>((resoudre) => setTimeout(() => resoudre(null), DELAI_LECTURE_MS)),
    ]);
    return typeof valeur === "string" && valeur.length > 0 ? valeur : null;
  } catch {
    return null;
  }
}
