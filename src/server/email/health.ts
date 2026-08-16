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

export interface SanteEmails {
  echecsRecents: number;
  bloquesEnFile: number;
  alertesLevees: string[];
}

/**
 * Balaie le journal et lève les alertes qui s'imposent.
 *
 * Fail-soft de bout en bout : une surveillance qui casse le cron qui la porte
 * ferait taire, en plus d'elle-même, tout ce que ce cron surveille par ailleurs.
 */
export async function verifierSanteEmails(maintenant: Date = new Date()): Promise<SanteEmails> {
  const resultat: SanteEmails = { echecsRecents: 0, bloquesEnFile: 0, alertesLevees: [] };
  if (estStub()) return resultat;

  const depuis = new Date(maintenant.getTime() - FENETRE_ECHECS_H * 3600_000);
  const avant = new Date(maintenant.getTime() - AGE_BLOCAGE_MIN * 60_000);

  try {
    [resultat.echecsRecents, resultat.bloquesEnFile] = await Promise.all([
      prisma.emailLog.count({
        where: { status: EmailLogStatus.failed, failedAt: { gte: depuis } },
      }),
      prisma.emailLog.count({
        where: { status: EmailLogStatus.pending, createdAt: { lt: avant } },
      }),
    ]);
  } catch (e) {
    console.error(
      "[email-sante] lecture du journal impossible :",
      e instanceof Error ? e.message : String(e),
    );
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
