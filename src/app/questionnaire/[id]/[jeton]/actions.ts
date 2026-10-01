/**
 * L'ENVOI des réponses au questionnaire de cadrage en ligne (2026-10-01).
 *
 * Une seule action, appelée par les deux formulaires de la page (la version
 * pas à pas, avec JavaScript, et la version d'un seul tenant, sans) :
 *
 *   1. limite de débit par IP HACHÉE (`hashIp`, jamais l'IP en clair dans la
 *      clé) — le limiteur commun du site (`checkRateLimit`) ;
 *   2. l'écriture : `enregistrerReponsesEnLigne`, qui revérifie le jeton,
 *      refuse un questionnaire clos, dépassé ou déjà répondu, borne chaque
 *      réponse et n'écrit que les questions de CE questionnaire ;
 *   3. un e-mail INTERNE court à contact@axion-ia.com — client et projet, un
 *      lien vers la console, AUCUNE réponse ;
 *   4. retour sur la page (`?envoye=1` : « Merci, c'est reçu ») — un POST sans
 *      JavaScript reçoit ainsi une page, jamais un écran blanc.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";

import { adminPath } from "@/lib/admin-path";
import { getClientIp } from "@/lib/client-ip";
import { ADRESSE_INTERNE_PAR_DEFAUT } from "@/lib/destinataires-internes";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { SITE_URL } from "@/lib/site-url";
import { enqueueEmail } from "@/server/queue/queues";
import {
  MAX_CHAMPS_ENVOI,
  MAX_QUI_REPOND,
  MAX_REPONSE,
} from "@/server/visio/questionnaire-en-ligne/constantes";
import { enregistrerReponsesEnLigne } from "@/server/visio/questionnaire-en-ligne/reponses";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const JETON = /^[A-Za-z0-9_-]{43}$/;
const CHAMP_REPONSE = /^reponse_([0-9a-f-]{36})$/;

/**
 * 8 envois par quart d'heure et par IP : un client en envoie un seul.
 *
 * Panne de Redis : LAISSER PASSER, écrit ici à dessein (avis de l'architecte,
 * C2 ; écart à R78 consigné dans l'ADR). L'écriture est gardée par le jeton et
 * UNIQUE (un second envoi ne réécrit rien), un jeton forgé ne coûte aucune
 * requête, et un refus pendant une panne ferait perdre sa saisie au client sans
 * JavaScript.
 */
const LIMITE: RateLimitConfig = { limit: 8, windowSec: 900, surPanne: "laisser-passer" };

/** La clé du limiteur : l'empreinte de l'IP, jamais l'IP. */
async function cleDeDebit(): Promise<string> {
  try {
    return `questionnaire-en-ligne:${hashIp(await getClientIp()) ?? "sans-ip"}`;
  } catch {
    // Sel absent en production (`hashIp` lève) : un seul compteur commun plutôt
    // qu'une IP en clair dans Redis.
    return "questionnaire-en-ligne:sans-sel";
  }
}

/**
 * L'e-mail interne. Classé AUTOMATIQUE (`EMAILS_AUTOMATIQUES_PAR_DEFAUT`) et
 * enfilé SANS `clientId` : une règle « validation » posée pour ce client ne
 * doit pas garer une notification interne. Une panne de file ne fait pas
 * échouer un envoi déjà écrit : elle part chez Sentry.
 */
async function prevenirAxion(questionnaireId: string, clientId: string, projetId: string) {
  try {
    const projet = await prisma.projet.findUnique({
      where: { id: projetId },
      select: { titre: true, client: { select: { raisonSociale: true } } },
    });
    const cheminConsole = adminPath(
      "fr",
      `qualiopi/clients/${clientId}/projets/${projetId}?vue=questionnaire`,
    );
    await enqueueEmail(
      "questionnaire-reponses-recues",
      ADRESSE_INTERNE_PAR_DEFAUT,
      "fr",
      {
        client: projet?.client.raisonSociale ?? "",
        projet: projet?.titre ?? "",
        consoleUrl: `${SITE_URL.replace(/\/+$/, "")}${cheminConsole}`,
      },
      {
        jobId: `questionnaire-reponses-recues-${questionnaireId}`,
        entityType: "QuestionnaireCadrage",
        entityId: questionnaireId,
        clientId: null,
      },
    );
  } catch (e) {
    Sentry.captureException(e, { tags: { service: "questionnaire-en-ligne", etape: "e-mail" } });
  }
}

export async function envoyerReponsesAction(fd: FormData): Promise<never> {
  const id = String(fd.get("questionnaireId") ?? "").toLowerCase();
  const jeton = String(fd.get("jeton") ?? "");
  // Le chemin de retour ne reprend que des valeurs de forme vérifiée : jamais
  // une adresse fournie par la requête (redirection ouverte).
  const chemin =
    UUID.test(id) && JETON.test(jeton)
      ? `/questionnaire/${id}/${jeton}`
      : "/questionnaire/lien/invalide";

  const debit = await checkRateLimit(await cleDeDebit(), LIMITE);
  if (!debit.allowed) redirect(`${chemin}?erreur=trop`);

  const reponses = new Map<string, string>();
  for (const [cle, valeur] of fd.entries()) {
    const m = CHAMP_REPONSE.exec(cle);
    if (!m?.[1] || typeof valeur !== "string") continue;
    reponses.set(m[1], valeur.slice(0, MAX_REPONSE * 2));
    // Au-delà, le module refuse sans lire la base : inutile de tout parcourir.
    if (reponses.size > MAX_CHAMPS_ENVOI) break;
  }
  const brut = fd.get("repondant");
  const repondant = typeof brut === "string" ? brut.slice(0, MAX_QUI_REPOND * 4) : "";

  const issue = await enregistrerReponsesEnLigne(prisma, {
    questionnaireId: id,
    jeton,
    reponses,
    repondant,
  });

  if (issue.issue === "enregistre") {
    await prevenirAxion(id, issue.clientId, issue.projetId);
    redirect(`${chemin}?envoye=1`);
  }
  if (issue.issue === "vide") redirect(`${chemin}?erreur=vide`);
  // `deja_envoye`, `introuvable` et `questions_changees` : la page, rechargée,
  // dit d'elle-même ce qu'il en est (et montre les nouvelles questions, le
  // brouillon du client restant sur son appareil).
  redirect(chemin);
}
