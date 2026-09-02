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
import { lireDernierAppelWebhook } from "./webhook-battement";
import { creerOuDedup } from "@/server/qualiopi/alertes/alertes-service";
import { notify } from "@/server/notifications";
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
 * Âge à partir duquel une ligne `pending` est anormale. Le worker prend un job
 * en quelques secondes ; quinze minutes couvrent largement un `delayMs` court,
 * un redéploiement et une reprise de file.
 *
 * ⚠️ Les envois différés volontairement (`delayMs`) au-delà de cette fenêtre
 * déclencheraient un faux positif. Aucun appelant n'en pose aujourd'hui de plus
 * long ; si cela change, il faudra porter la date d'échéance sur la ligne.
 */
export const AGE_BLOCAGE_MIN = 15;

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
    alertesLevees: [],
    mesureIndisponible: false,
  };
  if (estStub()) return resultat;

  // Lu AVANT la base, et délibérément : le battement vit dans Redis, donc il
  // reste lisible quand Postgres est en panne — c'est-à-dire dans le chemin où
  // les trois compteurs ci-dessous ne veulent plus rien dire. Fail-soft de bout
  // en bout : la fonction rend `null` plutôt que de lever.
  resultat.dernierAppelWebhook = await lireDernierAppelWebhook();

  const depuis = new Date(maintenant.getTime() - FENETRE_ECHECS_H * 3600_000);
  const avant = new Date(maintenant.getTime() - AGE_BLOCAGE_MIN * 60_000);
  const depuisRebonds = new Date(maintenant.getTime() - FENETRE_REBONDS_H * 3600_000);

  try {
    [resultat.echecsRecents, resultat.bloquesEnFile, resultat.rebondsRecents] = await Promise.all([
      prisma.emailLog.count({
        where: { status: EmailLogStatus.failed, failedAt: { gte: depuis } },
      }),
      prisma.emailLog.count({
        where: { status: EmailLogStatus.pending, createdAt: { lt: avant } },
      }),
      // Fenêtre volontairement plus large que celle des échecs : un rebond
      // remonte quand le serveur destinataire répond, parfois des heures après
      // l'acceptation par le relais.
      prisma.emailLog.count({
        where: { status: EmailLogStatus.bounced, bouncedAt: { gte: depuisRebonds } },
      }),
    ]);
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
 * Lève l'alerte sur les deux canaux hors bande, sans jamais laisser l'un
 * empêcher l'autre : Telegram peut être hors service sans que la console perde
 * sa trace, et réciproquement.
 */
async function leverAlerte(
  code: string,
  titre: string,
  message: string,
  compte: number,
): Promise<void> {
  console.error(`[email-sante] ⛔ ${titre} — ${message}`);

  try {
    await creerOuDedup({
      code,
      niveau: "critique",
      titre,
      message,
      metadata: { compte, detecteLe: new Date().toISOString() },
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
