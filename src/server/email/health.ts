/**
 * Surveillance de la chaîne d'envoi (audit du 2026-08-16).
 *
 * ## Pourquoi ce module n'existait pas, et ce que ça coûtait
 *
 * Trois canaux de remontée d'erreur, trois impasses :
 *
 *   1. **Sentry** — `captureWorkerError()` détecte lui-même que
 *      `@sentry/nextjs` n'expose pas `captureException` hors du bundle Next
 *      (constat du 2026-07-21 inscrit dans `sentry-worker.ts`, correctif jamais
 *      appliqué). Aucune erreur worker n'a jamais atteint Sentry.
 *   2. **La base** — `email_logs` était écrite depuis toujours, et RIEN ne la
 *      lisait pour y chercher des échecs. `content-monitoring-worker` surveille
 *      les jobs de contenu, pas les e-mails.
 *   3. **Redis** — le `on("error")` de la connexion BullMQ ne journalise
 *      qu'en dehors de la production.
 *
 * Résultat : un mot de passe SMTP expiré coupait 100 % des envois, et le seul
 * moyen de l'apprendre était d'ouvrir une page de console et de remarquer un
 * silence. Sur une chaîne qui porte convocations, attestations et
 * questionnaires — les indicateurs Qualiopi 4, 9, 11, 30 et 32 — c'est le
 * défaut le plus coûteux du système.
 *
 * ## Deux symptômes distincts, deux alertes distinctes
 *
 * - `emails_en_echec` : les envois PARTENT et sont REFUSÉS. Relais injoignable,
 *   authentification rejetée, quota dépassé.
 * - `emails_echecs_consecutifs` : les envois échouent EN SÉRIE, sans un seul
 *   succès entre eux. Ajouté le 2026-09-17, après 43 heures de panne dont
 *   personne n'a été averti. C'est le seul des trois qui ne dépende pas du
 *   volume : `emails_en_echec` ci-dessus compte un taux (3 échecs / 6 h) et
 *   reste donc muet sous 0,5 échec par heure, quelle que soit la durée de la
 *   panne.
 * - `emails_bloques_en_file` : les envois ne partent même pas. Des lignes
 *   restent `pending` bien après leur enfilage — worker mort, file non
 *   consommée. C'est le symptôme qu'aucun compteur ne pouvait montrer avant que
 *   `pending` ne soit réellement écrit (cf. `email-log.ts`).
 *
 * ## 🔴 Une alerte sur l'e-mail ne doit pas dépendre de l'e-mail
 *
 * `notifierAlerteInterne()` n'est volontairement PAS appelé ici : il enfile un
 * e-mail. Prévenir d'une panne d'e-mail par un e-mail, c'est écrire au
 * destinataire qu'on ne peut pas le joindre. On emprunte donc deux canaux hors
 * bande : l'alerte console (`AlerteSysteme`, visible sur /qualiopi/a-traiter) et
 * Telegram via la catégorie `MONITORING_ALERT`.
 */

import { prisma } from "@/lib/prisma";
import { lireDernierAppelRecu, lireDernierAppelWebhook } from "./webhook-battement";
import {
  creerOuActualiser,
  resoudreAlertesParCode,
} from "@/server/qualiopi/alertes/alertes-service";
import { notify } from "@/server/notifications";
import {
  analyserSerie,
  doitAlerterSerie,
  resumeSerie,
  whereEchecsDeLaSerie,
  SERIE_VIDE,
  type SerieEchecs,
} from "./serie-echecs";
import { EmailLogStatus } from "../../../prisma/generated/client";

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/**
 * Fenêtre d'observation des échecs. Six heures : assez large pour qu'une panne
 * réelle dépasse le seuil, assez courte pour qu'une alerte résolue hier ne
 * ressuscite pas aujourd'hui.
 */
export const FENETRE_ECHECS_H = 6;

/**
 * Seuil d'échecs sur la fenêtre. Trois et non un : un rebond isolé sur une
 * adresse morte est un incident de destinataire, pas de chaîne. Trois échecs en
 * six heures, sur une prod qui envoie ~4 e-mails par jour, ne peut pas être du
 * bruit.
 */
export const SEUIL_ECHECS = 3;

/**
 * Combien de lignes d'échec on relit au plus pour reconstituer la série.
 *
 * ⚠️ LIMITE DÉCLARÉE : au-delà, `serieEchecs.total` et `serieEchecs.depuis`
 * SOUS-ESTIMENT (on lit les plus récentes). La DÉCISION, elle, n'en dépend
 * pas — elle se prend à 3. Deux cents échecs consécutifs représentent des
 * semaines de panne sur cette production ; l'alerte sera tombée depuis
 * longtemps.
 */
export const PLAFOND_LECTURE_SERIE = 200;

/**
 * Fraîcheur EXIGÉE du succès qui referme l'alerte de série.
 *
 * 🔴 Défaut relevé en relecture (2026-09-17) : la première version refermait sur
 * « plus aucun échec dans la série » + « un succès existe quelque part dans
 * l'histoire ». Ce n'est pas une preuve de rétablissement, et le renvoi en lot
 * de cette même PR le démontrait : il repasse les lignes en `pending`, la série
 * tombe à zéro, et l'alerte CRITIQUE se refermait **relais toujours mort**.
 *
 * Six heures : un succès doit avoir eu lieu RÉCEMMENT. Une période sans trafic
 * ne referme donc rien — c'est le bon côté du marché, l'absence de mesure n'est
 * pas un rétablissement.
 */
export const FENETRE_RETABLISSEMENT_H = 6;

/**
 * La chaîne est-elle DÉMONTRABLEMENT rétablie ?
 *
 * Fonction pure, isolée pour être éprouvée sur des valeurs — la première version
 * de cette condition vivait en ligne dans un `else if`, et ses deux fautes y
 * étaient invisibles :
 *
 * 🔴 **(a) elle lisait `total`, pas `chaine`.** Une seule adresse morte dans la
 * série empêchait donc la fermeture, et l'alerte CRITIQUE « plus rien ne part »
 * restait ouverte après réparation — le faux critique du 07→09/09 que
 * `AGE_BLOCAGE_MIN` raconte plus haut, refait à l'identique dix jours plus tard.
 * Le déclenchement lit `chaine` ; la fermeture doit lire la même grandeur, sinon
 * les deux portes ne donnent pas sur la même pièce.
 *
 * 🔴 **(b) elle acceptait n'importe quel succès de l'histoire.** « Aucun échec
 * dans la série » + « un `sent` existe quelque part » n'est pas un
 * rétablissement : le renvoi en lot de cette même PR repasse les lignes en
 * `pending`, la série tombe à zéro, et l'alerte se refermait **relais toujours
 * mort**. Le succès doit être RÉCENT.
 *
 * ⚠️ Une période sans aucun trafic ne referme rien, et c'est voulu : l'absence
 * de mesure n'est pas une bonne nouvelle.
 */
export function retablissementProuve(
  serie: SerieEchecs,
  dernierSucces: Date | null,
  maintenant: Date,
): boolean {
  if (serie.chaine > 0) return false;
  if (dernierSucces === null) return false;
  const age = maintenant.getTime() - dernierSucces.getTime();
  return age >= 0 && age <= FENETRE_RETABLISSEMENT_H * 3600_000;
}

/**
 * Condition « cet échec appartient à la série en cours », isolée pour être
 * éprouvée sur des lignes plutôt que sur sa forme.
 *
 * La série, ce sont les échecs postérieurs au dernier envoi RÉUSSI. Deux
 * branches, parce que `failedAt` n'est pas garanti sur les lignes anciennes :
 * on retombe alors sur `createdAt`, plutôt que de les laisser disparaître de la
 * série — un échec qu'on ne compte pas est un échec qui n'alerte pas.
 *
 * `dernierSucces === null` (aucun envoi réussi de toute l'histoire, ou base
 * fraîche) : aucune borne basse, tous les échecs appartiennent à la série.
 *
 * ⚠️ Elle VIT dans `serie-echecs.ts` et n'est que ré-exportée ici. Motif
 * mesuré : l'écran `emails-envoyes` a besoin de la même borne, et l'importer
 * depuis CE module tirait `@/server/notifications` — donc `next-auth`, donc
 * `next/server` — dans un test d'écran qui n'en a que faire. La collecte
 * échouait avant le premier test. Une condition partagée doit vivre dans le
 * module PUR, pas dans celui qui parle à Telegram.
 */
// ⚠️ IMPORTÉE ci-dessus ET ré-exportée ici. `export { X } from "…"` seul ne
// lie PAS le nom dans le module : la sonde a compilé, et `whereEchecsDeLaSerie`
// y était `undefined` à l'exécution — donc un `TypeError` avalé par le
// fail-soft, donc dix-huit tests qui rendaient « je n'ai rien pu mesurer » au
// lieu de leur mesure. Le contre-témoin `mesureIndisponible` a attrapé la faute.
export { whereEchecsDeLaSerie };

/**
 * Âge à partir duquel une ligne `pending` est anormale — compté depuis son
 * ÉCHÉANCE, jamais depuis sa création. Le worker prend un job en quelques
 * secondes ; quinze minutes couvrent largement un redéploiement et une reprise
 * de file.
 *
 * 🔴 2026-09-09 — LE FAUX POSITIF QUE CE FICHIER AVAIT LUI-MÊME ANNONCÉ.
 *
 * Cette place portait l'avertissement : « Les envois différés volontairement
 * (`delayMs`) au-delà de cette fenêtre déclencheraient un faux positif. Aucun
 * appelant n'en pose aujourd'hui de plus long ; si cela change, il faudra
 * porter la date d'échéance sur la ligne. »
 *
 * Les relances apporteur (`relances-lead-apporteur.ts`) ont ensuite posé des
 * envois à **J+2 et J+7**. L'hypothèse est tombée, la consigne n'a pas été
 * suivie, et le compteur s'est mis à lire « la file n'est pas consommée » sur
 * quatre envois qui attendaient sagement leur date.
 *
 * Le coût n'est pas théorique : une alerte CRITIQUE est restée ouverte du 07/09
 * au 09/09 en annonçant « AUCUN e-mail ne part — convocations comprises »,
 * pendant que 137 e-mails partaient sans un seul échec. Une alerte critique qui
 * ment est pire qu'une alerte absente : elle apprend à ne plus lire les
 * critiques.
 *
 * 🔑 Une constante de seuil ne protège de rien si la GRANDEUR qu'elle borne
 * n'est pas la bonne. Ici le seuil était juste et la grandeur fausse.
 */
export const AGE_BLOCAGE_MIN = 15;

/**
 * Condition « cet envoi est réellement bloqué », isolée pour être éprouvée.
 *
 * Elle vit hors de la requête parce qu'une condition noyée dans un `count()`
 * ne se teste qu'à travers un mock qui ne regarde pas ce qu'elle dit — c'est
 * exactement ainsi que la précédente a pu être fausse pendant deux jours sans
 * qu'un seul test ne rougisse.
 *
 * Deux branches, et les deux comptent :
 *   - `dueAt` posée (toute ligne écrite depuis le 2026-09-09) → on borne sur
 *     l'échéance. Un envoi différé à J+7 n'est en retard qu'à J+7 + 15 min ;
 *   - `dueAt` absente (lignes antérieures au champ) → on retombe sur
 *     `createdAt`, c'est-à-dire sur le comportement d'avant. Ne rien compter
 *     dans ce cas rendrait la surveillance AVEUGLE sur l'historique, ce qui
 *     échangerait un faux positif contre un faux négatif — le mauvais côté du
 *     marché quand l'enjeu est « aucune convocation ne part ».
 */
export function whereEnvoisBloques(avant: Date): {
  status: typeof EmailLogStatus.pending;
  OR: [{ dueAt: { lt: Date } }, { dueAt: null; createdAt: { lt: Date } }];
} {
  return {
    status: EmailLogStatus.pending,
    OR: [{ dueAt: { lt: avant } }, { dueAt: null, createdAt: { lt: avant } }],
  };
}

/**
 * Fenêtre d'observation des rebonds. Vingt-quatre heures et non six : un rebond
 * n'arrive pas au moment de l'envoi mais quand le serveur destinataire répond,
 * ce qui peut prendre plusieurs heures (rebond « différé » puis « dur »).
 */
export const FENETRE_REBONDS_H = 24;

/**
 * Un seul rebond suffit à alerter, là où il faut trois échecs.
 *
 * Ce n'est pas une incohérence : un échec d'envoi est souvent transitoire et se
 * rattrape au réessai, alors qu'un rebond DUR est définitif — le message
 * n'arrivera jamais, et sur cette chaîne il peut s'agir d'une convocation ou
 * d'une confirmation de rendez-vous. Le destinataire, lui, ne saura rien.
 */
export const SEUIL_REBONDS = 1;

/** Un « approuvé » sans envoi au-delà de ce délai est un tombeau (lot 3). */
export const AGE_APPROUVE_ABANDONNE_MIN = 15;

export interface SanteEmails {
  /** Lignes de corbeille remises en attente parce que bloquées en « approuvé » (lot 3). */
  approuvesRemisEnAttente: number;
  echecsRecents: number;
  bloquesEnFile: number;
  /**
   * Rebonds enregistrés sur la fenêtre. Distinct de `echecsRecents` : un échec
   * est un envoi REFUSÉ par notre relais, un rebond est un message ACCEPTÉ par
   * le relais puis refusé par le serveur destinataire. Le second est invisible
   * du worker — il n'arrive que par le webhook ZeptoMail.
   */
  rebondsRecents: number;
  /**
   * 🔑 Vrai quand AUCUN rebond ne peut être enregistré, faute de
   * `ZEPTOMAIL_WEBHOOK_KEY`.
   *
   * Ajouté le 2026-08-31. `rebondsRecents` valait alors 0 sur 141 e-mails
   * envoyés depuis le 2026-07-21 — et ce zéro n'était pas une mesure : la route
   * `/api/zeptomail/webhook` sort en `skipped: not_configured` avant de lire
   * quoi que ce soit, donc le statut `bounced` est structurellement
   * inatteignable. Un rebond dur sur l'adresse d'un prospect était strictement
   * invisible.
   *
   * ⚠️ Quand ce drapeau est levé, `rebondsRecents` **ne veut rien dire** —
   * même contrat que `mesureIndisponible` pour les deux autres compteurs.
   */
  detectionRebondsDebranchee: boolean;
  /**
   * 🔑 Date ISO du dernier appel AUTHENTIFIÉ reçu sur
   * `/api/zeptomail/webhook`, ou `null` si aucun n'a jamais été vu.
   *
   * Ajouté le 2026-09-01. `detectionRebondsDebranchee` ne couvre qu'un cas : la
   * clé absente. Or la clé EST posée en production (un POST non signé rend 401,
   * pas le 200 muet du cas non configuré) — et pourtant rien ne prouvait que
   * ZeptoMail appelle. Une clé posée côté NOUS ne dit rien de l'abonnement
   * côté EUX : si le webhook n'a jamais été enregistré dans leur console, la
   * route reste armée, correcte, et jamais appelée. `rebondsRecents` vaudrait
   * alors 0 pour toujours, avec `detectionRebondsDebranchee` à faux : le rendu
   * exact d'une chaîne saine.
   *
   * ⚠️ `null` ne lève AUCUNE alerte, et c'est voulu : ZeptoMail n'appelle que
   * sur événement, donc le silence est le comportement normal d'un parc dont
   * rien ne rebondit. Alerter dessus serait crier au loup, et le discrédit
   * emporterait les alertes qui, elles, disent vrai. On expose la valeur, on ne
   * la juge pas — cf. `server/email/webhook-battement.ts`, qui explique comment
   * obtenir une réponse définitive en trente secondes.
   */
  dernierAppelWebhook: string | null;
  /**
   * 🔑 Date ISO du dernier appel RECU sur la route, **authentifie ou non**, ou
   * `null` si aucun n'a jamais ete vu.
   *
   * Ajoute le 2026-09-07. `dernierAppelWebhook` ne se pose qu'apres une
   * signature valide ; comme la route rend `200` sur signature invalide (pour
   * que ZeptoMail puisse creer le webhook), un appel refuse etait totalement
   * invisible. Les deux pannes rendaient donc le meme `JAMAIS` :
   *
   *   `dernierAppelRecu` null      -> rien n'atteint la route (abonnement absent
   *                                   ou URL fausse cote ZeptoMail).
   *   `dernierAppelRecu` date +
   *   `dernierAppelWebhook` null   -> ils nous atteignent, la signature est
   *                                   refusee : cle desynchronisee.
   *
   * ⚠️ Comme son voisin, ce champ ne leve AUCUNE alerte : ZeptoMail n'appelle
   * que sur evenement, donc le silence est le comportement normal d'un parc
   * dont rien ne rebondit. On expose la valeur, on ne la juge pas.
   */
  dernierAppelRecu: string | null;
  /**
   * 🔑 La SÉRIE d'échecs en cours — échecs consécutifs depuis le dernier envoi
   * réussi. Ajouté le 2026-09-17 après 43 heures de panne muette.
   *
   * Indépendante du volume, là où `echecsRecents` est un taux sur six heures :
   * une chaîne morte un week-end calme ne produit jamais 3 échecs dans une même
   * fenêtre, et produit toujours 3 échecs d'affilée.
   *
   * ⚠️ Ne veut rien dire quand `mesureIndisponible` est levé, comme les autres
   * compteurs.
   */
  serieEchecs: SerieEchecs;
  /**
   * Date ISO du dernier envoi RÉUSSI, ou `null` si aucun n'a jamais abouti.
   *
   * C'est la preuve positive sur laquelle la série se referme : sans un succès
   * postérieur, on ne prétend pas que la chaîne est rétablie.
   */
  dernierSuccesAt: string | null;
  /** Codes d'alerte que ce passage a REFERMÉS parce que les envois sont repartis. */
  alertesResolues: string[];
  /**
   * Combien d'accusés de notification ont été RELÂCHÉS parce que la chaîne était
   * en panne au moment où ils ont été posés.
   *
   * 🔑 `notifiedAt` veut dire « quelqu'un a été poussé ». Pendant une panne
   * d'envoi, il ne veut plus rien dire : l'e-mail a été accepté par la file et
   * refusé par le relais. Le laisser posé condamne l'alerte au silence
   * définitif, puisque `notifierAlertesGroupees` n'examine que `notifiedAt: null`.
   */
  notificationsRelachees: number;
  alertesLevees: string[];
  /**
   * 🔑 « Je n'ai rien pu regarder » ≠ « rien ne va mal ».
   *
   * Sans ce champ, un zéro était **indistinguable** d'une chaîne saine : un
   * échec de lecture du journal rendait `{ 0, 0, [] }`, c'est-à-dire le rendu
   * exact d'un système en parfait état. Un compteur à zéro n'est une bonne
   * nouvelle que si l'on sait qu'il a compté.
   *
   * ⚠️ Les deux compteurs ci-dessus **ne veulent rien dire** quand ce drapeau
   * est levé — ils n'ont jamais été renseignés.
   */
  mesureIndisponible: boolean;
}

/**
 * Balaie le journal et lève les alertes qui s'imposent.
 *
 * Fail-soft de bout en bout : une surveillance qui casse le cron qui la porte
 * ferait taire, en plus d'elle-même, tout ce que ce cron surveille par ailleurs.
 */
export async function verifierSanteEmails(maintenant: Date = new Date()): Promise<SanteEmails> {
  const resultat: SanteEmails = {
    approuvesRemisEnAttente: 0,
    echecsRecents: 0,
    bloquesEnFile: 0,
    rebondsRecents: 0,
    // Le seul écrivain du statut `bounced` est `/api/zeptomail/webhook`, et il
    // sort en `skipped: not_configured` sans cette clé. Pas de clé = pas de
    // rebond possible, jamais.
    detectionRebondsDebranchee: !process.env["ZEPTOMAIL_WEBHOOK_KEY"]?.trim(),
    dernierAppelWebhook: null,
    dernierAppelRecu: null,
    serieEchecs: SERIE_VIDE,
    dernierSuccesAt: null,
    alertesResolues: [],
    notificationsRelachees: 0,
    alertesLevees: [],
    mesureIndisponible: false,
  };
  if (estStub()) return resultat;

  // Lu AVANT la base, et délibérément : le battement vit dans Redis, donc il
  // reste lisible quand Postgres est en panne — c'est-à-dire dans le chemin où
  // les trois compteurs ci-dessous ne veulent plus rien dire. Fail-soft de bout
  // en bout : la fonction rend `null` plutôt que de lever.
  [resultat.dernierAppelWebhook, resultat.dernierAppelRecu] = await Promise.all([
    lireDernierAppelWebhook(),
    lireDernierAppelRecu(),
  ]);

  const depuis = new Date(maintenant.getTime() - FENETRE_ECHECS_H * 3600_000);
  const avant = new Date(maintenant.getTime() - AGE_BLOCAGE_MIN * 60_000);
  const depuisRebonds = new Date(maintenant.getTime() - FENETRE_REBONDS_H * 3600_000);

  let dernierSuccesDate: Date | null = null;

  try {
    const [echecsRecents, bloquesEnFile, rebondsRecents, dernierSucces] = await Promise.all([
      prisma.emailLog.count({
        where: { status: EmailLogStatus.failed, failedAt: { gte: depuis } },
      }),
      prisma.emailLog.count({ where: whereEnvoisBloques(avant) }),
      // Fenêtre volontairement plus large que celle des échecs : un rebond
      // remonte quand le serveur destinataire répond, parfois des heures après
      // l'acceptation par le relais.
      prisma.emailLog.count({
        where: { status: EmailLogStatus.bounced, bouncedAt: { gte: depuisRebonds } },
      }),
      // Le dernier envoi RÉUSSI. C'est lui qui borne la série ET qui prouve le
      // rétablissement : sans succès postérieur, on ne referme rien.
      prisma.emailLog.findFirst({
        where: { status: EmailLogStatus.sent, sentAt: { not: null } },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      }),
    ]);
    resultat.echecsRecents = echecsRecents;
    resultat.bloquesEnFile = bloquesEnFile;
    resultat.rebondsRecents = rebondsRecents;

    const dernierSuccesAt = dernierSucces?.sentAt ?? null;
    dernierSuccesDate = dernierSuccesAt;
    resultat.dernierSuccesAt = dernierSuccesAt?.toISOString() ?? null;

    // Deuxième temps, et non un quatrième membre du `Promise.all` : la borne de
    // cette lecture est le résultat de la précédente.
    const lignes = await prisma.emailLog.findMany({
      where: whereEchecsDeLaSerie(dernierSuccesAt),
      orderBy: { failedAt: "desc" },
      take: PLAFOND_LECTURE_SERIE,
      select: { recipient: true, template: true, error: true, failedAt: true, createdAt: true },
    });
    resultat.serieEchecs = analyserSerie(lignes);
  } catch (e) {
    // 🔴 2026-08-25 — CE CHEMIN RENDAIT UN ZÉRO QUI AVAIT L'AIR SAIN.
    //
    // Il sortait sur `console.error` puis rendait `{ echecsRecents: 0,
    // bloquesEnFile: 0, alertesLevees: [] }` — c'est-à-dire **exactement** ce
    // que rend une chaîne en parfait état. Aucun consommateur ne pouvait
    // distinguer « rien ne va mal » de « je n'ai rien pu regarder ».
    //
    // Le *fail-soft* est juste, et il reste : une surveillance qui casse le cron
    // qui la porte ferait taire tout ce que ce cron surveille par ailleurs. Mais
    // ne pas lever d'exception n'oblige pas à rendre un résultat rassurant.
    // C'est le piège que ce dépôt nomme « les journaux muets = succès », sur le
    // module même dont l'en-tête raconte qu'un mot de passe SMTP expiré avait
    // coupé 100 % des envois en silence.
    //
    // 🔑 On lève donc l'alerte par les DEUX canaux hors bande. Le canal console
    // passe par la base — celle-là même qui vient d'échouer — et il échouera
    // probablement ; `leverAlerte` l'isole déjà. **Telegram, lui, ne dépend pas
    // de la base** : c'est le seul chemin qui reste debout quand Postgres tombe,
    // et c'est précisément le cas qu'on veut couvrir.
    const detail = e instanceof Error ? e.message : String(e);
    resultat.mesureIndisponible = true;
    await leverAlerte(
      "emails_sante_non_mesurable",
      "La surveillance des e-mails n'a rien pu mesurer",
      `La lecture du journal d'envois a échoué : ${detail}. Tant que dure cette panne, ` +
        `l'absence d'alerte « e-mails en échec » ou « e-mails bloqués » ne prouve RIEN — ` +
        `la chaîne peut être rompue sans que personne ne l'apprenne. Vérifier Postgres.`,
      0,
    );
    resultat.alertesLevees.push("emails_sante_non_mesurable");
    return resultat;
  }

  // ── La SÉRIE, et le retour à la normale ────────────────────────────────────
  //
  // 🔴 2026-09-17 — les deux moitiés du défaut qui a coûté 43 heures.
  //
  // (1) LA CAUSE DU SILENCE, mesurée : une alerte levée puis jamais refermée
  //     dé-duplique TOUTES les suivantes — `creerOuDedup` rend `null` sur une
  //     alerte ouverte de même code, sans rien écrire. Le premier incident de
  //     l'histoire du système consommait le signal pour toujours, et le titre
  //     affiché restait figé sur le compte de son premier passage. On rafraîchit
  //     donc l'alerte ouverte (`creerOuActualiser`) et on la referme sur preuve
  //     positive, ici même.
  //     ⚠️ Ce n'est PAS le seuil qui était en cause : 19 échecs sur 43 h
  //     atteignent bien 3 dans une fenêtre de 6 h. Mesuré dans
  //     `serie-echecs.spec.ts`, contre la mauvaise piste.
  // (2) Le critère de TAUX ci-dessous mesure quand même le trafic autant que la
  //     panne : il lui faut 0,5 échec par heure pour se lever. Une chaîne morte
  //     un week-end calme n'y arrive jamais. La série, elle, ne dépend de rien
  //     d'autre que d'elle-même.
  if (doitAlerterSerie(resultat.serieEchecs)) {
    const s = resultat.serieEchecs;
    const titre =
      `${s.chaine} envois d'e-mails échouent d'affilée — plus rien ne part` +
      (s.destinatairesDistincts > 1 ? ` (${s.destinatairesDistincts} destinataires)` : "");
    const message =
      `${resumeSerie(s, maintenant)} ` +
      `Aucun envoi n'a abouti depuis ${
        resultat.dernierSuccesAt
          ? `le ${new Date(resultat.dernierSuccesAt).toLocaleString("fr-FR")}`
          : "toujours (aucun succès au journal)"
      }. ` +
      (s.motif ? `Motif rendu par le relais : « ${s.motif} ». ` : "") +
      `Vérifier en priorité les identifiants du relais (SMTP_USER / SMTP_PASS côté Coolify), ` +
      `puis le quota du compte. Une fois réparé : console → E-mails envoyés, bandeau rouge → ` +
      `« Renvoyer les envois en échec » remet à la poste ce qui est resté à quai.`;
    await leverAlerte("emails_echecs_consecutifs", titre, message, s.chaine, {
      total: s.total,
      chaine: s.chaine,
      destinataire: s.destinataire,
      destinatairesDistincts: s.destinatairesDistincts,
      depuis: s.depuis?.toISOString() ?? null,
      motif: s.motif,
    });
    resultat.alertesLevees.push("emails_echecs_consecutifs");

    // 🔴 L'ACCUSÉ DE NOTIFICATION CONSOMMÉ PAR UN E-MAIL QUI N'EST JAMAIS PARTI.
    //
    // Mesuré en production le 2026-09-17 : une alerte du 16/09 portait
    // `notified_at = 17/09 07:00`, et l'e-mail `qualiopi-alerte-interne`
    // correspondant était en `failed` au même horodatage. `enqueueEmail` avait
    // réussi (Redis vivant, seul SMTP mort), donc `notifierAlertesGroupees`
    // n'avait pas relâché son claim — et sa sélection exigeant
    // `notifiedAt: null`, l'alerte n'aurait JAMAIS été re-notifiée, même après
    // réparation.
    //
    // Tant que la chaîne est en panne, AUCUN accusé de notification par e-mail
    // ne vaut : on les relâche tous. Les alertes redeviendront candidates dès que
    // la chaîne repartira — c'est-à-dire au moment précis où la notification peut
    // enfin arriver.
    resultat.notificationsRelachees = await relacherNotificationsNonParties();
  } else if (retablissementProuve(resultat.serieEchecs, dernierSuccesDate, maintenant)) {
    // 🔑 PREUVE POSITIVE, et elle seule — voir `retablissementProuve`, qui porte
    // les deux corrections de la relecture du 2026-09-17.
    try {
      const fermees = await resoudreAlertesParCode(["emails_echecs_consecutifs"]);
      if (fermees > 0) {
        resultat.alertesResolues.push("emails_echecs_consecutifs");
        console.warn(
          `[email-sante] ✅ les envois sont repartis : ${fermees} alerte(s) « série d'échecs » refermée(s).`,
        );
      }
    } catch (e) {
      console.error(
        "[email-sante] fermeture automatique impossible :",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  if (resultat.echecsRecents >= SEUIL_ECHECS) {
    const titre = `${resultat.echecsRecents} e-mails en échec sur ${FENETRE_ECHECS_H} h`;
    const message =
      `Le relais SMTP refuse ou n'aboutit pas. Vérifier en priorité les identifiants Zoho ` +
      `(SMTP_USER / SMTP_PASS côté Coolify) puis le quota horaire du compte. ` +
      `Détail par envoi : console → Ops & monitoring → E-mails envoyés, filtre « échec ».`;
    await leverAlerte("emails_en_echec", titre, message, resultat.echecsRecents);
    resultat.alertesLevees.push("emails_en_echec");
  }

  // 🔑 L'INSTRUMENT AVANT LA MESURE (2026-08-31). Cette alerte-ci ne dit pas
  // qu'un rebond a eu lieu : elle dit qu'aucun rebond ne PEUT être vu. Sans
  // elle, `rebondsRecents: 0` se lisait comme « aucun destinataire injoignable »
  // alors qu'il fallait lire « je n'ai aucun moyen de le savoir ». C'est le même
  // défaut que `mesureIndisponible` ci-dessus, sur un instrument qui n'a jamais
  // été branché plutôt que sur un instrument tombé en panne.
  if (resultat.detectionRebondsDebranchee) {
    await leverAlerte(
      "emails_rebonds_non_detectes",
      "Aucun rebond d'e-mail ne peut être détecté",
      `ZEPTOMAIL_WEBHOOK_KEY est absente : la route /api/zeptomail/webhook répond ` +
        `« non configuré » sans rien lire, donc le statut « rebond » ne peut JAMAIS être ` +
        `écrit. Un compteur de rebonds à zéro ne prouve donc rien — une convocation ou une ` +
        `confirmation de rendez-vous peut être refusée par le serveur destinataire sans que ` +
        `personne ne l'apprenne. Créer le webhook côté ZeptoMail, puis poser sa clé dans ` +
        `Coolify (application WEB, scope RUN) et redémarrer.`,
      0,
    );
    resultat.alertesLevees.push("emails_rebonds_non_detectes");
  } else if (resultat.rebondsRecents >= SEUIL_REBONDS) {
    const titre = `${resultat.rebondsRecents} e-mail(s) rejeté(s) par le destinataire sur ${FENETRE_REBONDS_H} h`;
    const message =
      `Ces messages ont été acceptés par le relais puis REFUSÉS à l'arrivée : ils ne sont ` +
      `jamais parvenus. Adresse erronée, boîte pleine ou domaine qui nous rejette. ` +
      `Détail : console → Ops & monitoring → E-mails envoyés, filtre « rebond ». ` +
      `Un rebond dur répété sur un même domaine abîme la réputation d'envoi : le traiter.`;
    await leverAlerte("emails_rebonds", titre, message, resultat.rebondsRecents);
    resultat.alertesLevees.push("emails_rebonds");
  }

  // ── Lot 3 (2026-09-02) — le statut « approuvé » n'a aucun écran ─────────
  // La transition a_valider → approuve est commitée AVANT la mise en file. Si
  // le conteneur meurt entre les deux (redéploiement Coolify), la ligne reste
  // « approuvé » : absente de « En attente », absente de « Traités »,
  // ni ré-approuvable ni refusable. Un tombeau, et l'email n'est jamais parti.
  // Le contrôle horaire la remet en attente et le dit.
  try {
    const avantApprouve = new Date(maintenant.getTime() - AGE_APPROUVE_ABANDONNE_MIN * 60_000);
    const remis = await prisma.emailOutbox.updateMany({
      where: { statut: "approuve", approuveAt: { lt: avantApprouve } },
      data: { statut: "a_valider", approuveAt: null, approuveById: null },
    });
    resultat.approuvesRemisEnAttente = remis.count;
    if (remis.count > 0) {
      await leverAlerte(
        "emails_approuves_abandonnes",
        `${remis.count} e-mail(s) approuvé(s) jamais partis, remis en attente`,
        `Ils avaient été approuvés il y a plus de ${AGE_APPROUVE_ABANDONNE_MIN} minutes sans être ` +
          `mis en file (conteneur redéployé entre l'approbation et l'envoi, ou Redis coupé). Ils sont ` +
          `de retour dans la corbeille « E-mails à valider » : les relire et les approuver de nouveau.`,
        remis.count,
      );
      resultat.alertesLevees.push("emails_approuves_abandonnes");
    }
  } catch (e) {
    console.error(
      "[email-sante] balayage des « approuvé » abandonnés impossible :",
      e instanceof Error ? e.message : String(e),
    );
  }

  if (resultat.bloquesEnFile > 0) {
    const titre = `${resultat.bloquesEnFile} e-mails enfilés mais jamais envoyés`;
    const message =
      `Des envois sont en attente depuis plus de ${AGE_BLOCAGE_MIN} minutes sans avoir été ` +
      `traités : la file n'est pas consommée. Vérifier que le conteneur worker tourne et que ` +
      `Redis répond. Tant que ce blocage dure, AUCUN e-mail ne part — convocations comprises.`;
    await leverAlerte("emails_bloques_en_file", titre, message, resultat.bloquesEnFile);
    resultat.alertesLevees.push("emails_bloques_en_file");
  }

  return resultat;
}

/**
 * Relâche les accusés de notification posés pendant que la chaîne était morte.
 *
 * Fail-soft : cette réparation ne doit jamais faire tomber le cron qui la porte.
 * Elle rend 0 plutôt que de lever.
 *
 * ⚠️ Elle ne s'appelle QUE sur une série d'échecs de chaîne avérée. L'appeler
 * inconditionnellement relâcherait des accusés parfaitement valides et
 * renverrait le même résumé tous les jours — le bruit qui désarme.
 */
async function relacherNotificationsNonParties(): Promise<number> {
  try {
    const { count } = await prisma.alerteSysteme.updateMany({
      where: { resolue: false, notifiedAt: { not: null } },
      data: { notifiedAt: null },
    });
    if (count > 0) {
      console.warn(
        `[email-sante] ${count} accusé(s) de notification relâché(s) : ils ont été posés ` +
          `pendant une panne d'envoi, donc aucun e-mail n'a pu arriver.`,
      );
    }
    return count;
  } catch (e) {
    console.error(
      "[email-sante] relâchement des accusés de notification impossible :",
      e instanceof Error ? e.message : String(e),
    );
    return 0;
  }
}

/**
 * Lève l'alerte sur les deux canaux hors bande, sans jamais laisser l'un
 * empêcher l'autre : Telegram peut être hors service sans que la console perde
 * sa trace, et réciproquement.
 */
async function leverAlerte(
  code: string,
  titre: string,
  message: string,
  compte: number,
  detail?: Record<string, unknown>,
): Promise<void> {
  console.error(`[email-sante] ⛔ ${titre} — ${message}`);

  try {
    // 🔴 `creerOuActualiser` et non `creerOuDedup` : ces alertes décrivent un
    // ÉTAT QUI DURE, pas un fait accompli. Avec la dé-duplication muette, le
    // titre affiché restait figé sur le compte du premier passage pendant que la
    // panne grossissait — et comme aucun de ces codes ne se referme tout seul,
    // la toute première occurrence de l'histoire du système éteignait le signal
    // pour toutes les suivantes. Un fusible qui ne fond qu'une fois.
    await creerOuActualiser({
      code,
      niveau: "critique",
      titre,
      message,
      metadata: { compte, detecteLe: new Date().toISOString(), ...(detail ?? {}) },
    });
  } catch (e) {
    console.error(
      `[email-sante] alerte console impossible (${code}) :`,
      e instanceof Error ? e.message : String(e),
    );
  }

  try {
    await notify({
      category: "MONITORING_ALERT",
      severity: "critical",
      // `legacyBody` est le seul champ que le formateur Telegram rend en clair ;
      // sans lui, le message arrive en JSON brut (cf. `legacyBodyOf` dans
      // `notifications/format.ts`). Une alerte illisible est une alerte ignorée.
      payload: { kind: code, details: { legacyBody: `${titre}\n\n${message}`, compte } },
      // Une panne d'envoi dure : sans clé de dédup, le passage horaire
      // reposterait la même alerte à chaque tour. Une par jour et par code
      // suffit à ne pas se faire oublier sans devenir du bruit.
      dedupKey: `email-sante:${code}:${new Date().toISOString().slice(0, 10)}`,
      dedupTtlSec: 24 * 3600,
    });
  } catch (e) {
    console.error(
      `[email-sante] notification hors bande impossible (${code}) :`,
      e instanceof Error ? e.message : String(e),
    );
  }
}
