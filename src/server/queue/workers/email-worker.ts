// Worker BullMQ — envoi des emails (Sprint 15 / M8 step 4).
//
// Consume la queue `emails` : pour chaque job, render le template React Email
// (via @react-email/render) puis envoie via Nodemailer.
//
// En dev  → Mailhog UI (http://localhost:8025) intercepte tout.
// En prod → SMTP **ZeptoMail** (`smtp.zeptomail.eu:587`), depuis le 2026-08-16.
//           Avant : Zoho Mail (`smtp.zoho.eu`) depuis le 2026-05-13, et avant
//           encore, un en-tête qui annonçait « PowerMTA local sur Hetzner »
//           jamais déployé. Détail et pièges dans `client.ts`.
//
// 🔴 Ce worker tourne dans l'application Coolify `axion-ia-worker`, DISTINCTE
// de l'app web et dotée de son PROPRE environnement. Les variables SMTP s'y
// posent, et il faut REDEPLOY (pas Restart) pour qu'elles soient relues.

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "../lib/sentry-worker";
import { redactEmailValue } from "../lib/sanitize-job-data";
import { sendEmail, verifyTransport } from "@/lib/email/client";
import type { SendEmailParams } from "@/lib/email/client";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import { renderEmailTemplate } from "@/lib/email/templates";
import { jetonOpposition } from "@/server/email/opposition-jeton";
import { prisma } from "@/lib/prisma";
import { isR2Configured, getObjectBufferR2 } from "@/lib/r2-storage";
import { cloturerJournal } from "@/server/email/email-log";
import { EmailLogStatus } from "../../../../prisma/generated/client";
import type { EmailJobData, EmailJobName } from "../types";

/**
 * Plafond cumulé des pièces jointes, en octets bruts (avant encodage base64).
 * Exporté pour que la garde soit testable — une borne qu'aucun test ne lit se
 * fait relever d'un facteur dix le jour où un envoi coince.
 */
export const TAILLE_MAX_PJ_OCTETS = 10 * 1_048_576;

/**
 * Hub facturation — résout les pièces jointes d'un job (clé R2 → Buffer).
 * FAIL-HARD (revue M8) : les templates affirment « le document est joint » —
 * envoyer sans la PJ serait un mensonge au client. PJ irrécupérable → throw
 * → retry BullMQ (backoff), puis job `failed` visible (Sentry + logs).
 */
export async function resolveAttachments(
  attachments: EmailJobData["attachments"],
): Promise<SendEmailParams["attachments"]> {
  if (!attachments || attachments.length === 0) return undefined;
  if (!isR2Configured()) {
    throw new Error(
      "[email-worker] pièces jointes demandées mais R2 non configuré — envoi refusé (le template promet un document joint)",
    );
  }
  const resolved: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
  let octetsTotal = 0;
  for (const att of attachments) {
    const buffer = await getObjectBufferR2(att.r2Key).catch(() => null);
    if (buffer === null) {
      throw new Error(
        `[email-worker] PJ introuvable sur R2 (${att.r2Key}) — envoi refusé, retry BullMQ`,
      );
    }
    octetsTotal += buffer.byteLength;
    resolved.push({
      filename: att.filename,
      content: buffer,
      contentType: att.contentType ?? "application/pdf",
    });
  }

  // 🔴 Audit du 2026-08-16 — AUCUNE garde de taille n'existait.
  //
  // On tirait de R2 des tampons de taille arbitraire et on les confiait au
  // relais. Le refus arrivait donc de Zoho, après transfert, sous la forme d'un
  // rejet SMTP opaque — puis cinq fois de suite, le temps que BullMQ épuise ses
  // tentatives à repousser les mêmes mégaoctets.
  //
  // Le seuil porte sur les octets BRUTS alors que le plafond des relais porte
  // sur le message encodé : le base64 gonfle d'environ un tiers, et s'ajoutent
  // le corps HTML et les en-têtes. 10 Mo bruts ≈ 13,7 Mo transmis, ce qui reste
  // sous les plafonds usuels (~15 Mo ZeptoMail, ~20 Mo Zoho Mail) avec de la
  // marge. Repère : le catalogue imprimable, la plus grosse PJ du dépôt, pèse
  // 7,8 Mo — rien d'existant ne bute sur ce seuil aujourd'hui.
  if (octetsTotal > TAILLE_MAX_PJ_OCTETS) {
    const mo = (n: number): string => (n / 1_048_576).toFixed(1);
    throw new Error(
      `[email-worker] pièces jointes trop lourdes : ${mo(octetsTotal)} Mo bruts pour ` +
        `${resolved.length} fichier(s), plafond ${mo(TAILLE_MAX_PJ_OCTETS)} Mo. Le relais ` +
        `rejetterait le message après transfert — on refuse ici, avec un motif lisible. ` +
        `Alléger le document ou le remplacer par un lien de téléchargement.`,
    );
  }
  return resolved;
}

export function startEmailWorker(): Worker<EmailJobData, void, EmailJobName> {
  const worker = new Worker<EmailJobData, void, EmailJobName>(
    "emails",
    async (job) => {
      const { template, to, locale, payload, marketing, entityType, entityId } = job.data;

      // Sprint Notif Infra 2026-05-26 / Chantier 5 — branche dédiée
      // submission-reply : on synchronise SubmissionReply.deliveryStatus
      // + Submission.firstRepliedAt/lastRepliedAt après envoi MTA. Suivi propre
      // via SubmissionReply → pas de double journalisation dans EmailLog.
      if (template === "submission-reply") {
        await handleSubmissionReply(payload);
        return;
      }

      const jobId = job.id;
      const attempts = job.attemptsMade + 1;

      try {
        const { subject, html, text, famille } = await renderEmailTemplate(
          template,
          locale,
          payload,
          {
            destinataire: to,
          },
        );
        const attachments = await resolveAttachments(job.data.attachments);
        // RFC 8058 List-Unsubscribe (P0-RGPD-3 fix audit final 2026-05-09).
        // Marketing emails ET transactionnels qui contiennent un lien
        // unsubscribe DOIVENT exposer les headers `List-Unsubscribe` +
        // `List-Unsubscribe-Post` pour Gmail/Yahoo/Apple/Outlook 2024+.
        //
        // Lot 1b (2026-09-02) : hors famille A, l'en-tête porte le jeton
        // d'OPPOSITION du destinataire quand le gabarit n'apporte pas de jeton
        // newsletter. Le bouton natif « Se désabonner » de Gmail existe donc
        // sur le rapport ROI, la confirmation de contact, le rappel — et il
        // fait la même chose que le lien du pied de page. Jamais en famille A :
        // une facture ou un lien de connexion ne se « désabonne » pas.
        const jetonNewsletter =
          payload && typeof payload === "object" && "unsubscribeToken" in payload
            ? typeof (payload as { unsubscribeToken?: unknown }).unsubscribeToken === "string"
              ? (payload as { unsubscribeToken: string }).unsubscribeToken
              : undefined
            : undefined;
        const unsubscribeToken =
          jetonNewsletter ??
          (famille !== null && famille !== "A" ? jetonOpposition(to) : undefined);
        const result = await sendEmail({
          to,
          subject,
          html,
          text,
          marketing: marketing === true,
          ...(unsubscribeToken ? { unsubscribeToken } : {}),
          ...(attachments ? { attachments } : {}),
        });
        // Journalisation fail-soft : ne jamais rethrow après un envoi réussi
        // (sinon retry BullMQ → email renvoyé).
        await cloturerJournal({
          template,
          recipient: to,
          locale,
          marketing: marketing === true,
          attempts,
          status: EmailLogStatus.sent,
          providerMessageId: result.messageId,
          sentAt: new Date(),
          ...(entityType ? { entityType } : {}),
          ...(entityId ? { entityId } : {}),
          ...(jobId ? { jobId } : {}),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await cloturerJournal({
          template,
          recipient: to,
          locale,
          marketing: marketing === true,
          attempts,
          status: EmailLogStatus.failed,
          error: msg.slice(0, 2000),
          failedAt: new Date(),
          ...(entityType ? { entityType } : {}),
          ...(entityId ? { entityId } : {}),
          ...(jobId ? { jobId } : {}),
        });
        throw err; // rethrow : conserve le retry BullMQ + capture Sentry existante
      }
    },
    {
      connection: getBullConnectionOrThrow(),
      // 🔴 Audit du 2026-08-16 (F-01) — LE LIMITEUR QUI MANQUAIT.
      //
      // Douze workers de ce dépôt bornent leur débit ; celui qui parle au SEUL
      // tiers à quota n'en avait aucun. `concurrency: 8` et un transport sans
      // `pool` ouvraient huit connexions SMTP neuves en parallèle — le profil
      // exact qu'un relais lit comme une attaque.
      //
      // 40/h contre un plafond Zoho de 50 à 500/h. Le plancher est retenu, et
      // non la moyenne, parce que cette borne est DYNAMIQUE : Zoho l'ajuste sur
      // la réputation de l'expéditeur, et elle est IDENTIQUE en gratuit et en
      // payant — le compte est sur Mail Lite, monter de gamme ne la relèverait
      // pas. Seul un débit régulier l'élève. Se caler sous le plancher est donc
      // la seule position qui ne dépende pas d'une valeur qu'on ne peut ni lire
      // ni négocier.
      //
      // ⚠️ Ce bridage protège la BOÎTE, pas seulement les envois. Le site émet
      // depuis la messagerie métier : un throttle — ou pire, une suspension —
      // déclenché par une rafale ne coûterait pas des e-mails automatiques, il
      // coûterait `contact@axion-ia.com`. Il reste utile après la bascule vers
      // un relais transactionnel, à recalibrer alors sur SES limites.
      //
      // Ordre de grandeur : la prod envoie ~4 e-mails/jour, pic mesuré 5/h. On
      // est donc à un facteur 8 au-dessus du besoin actuel — le déclencheur est
      // `BATCH_LIMIT = 100` du vivier, qui part sans délai. À 40/h, ce lot
      // s'étale sur 2 h 30 au lieu de saturer en quelques minutes.
      //
      // 🔑 Le limiteur BullMQ DIFFÈRE la prise du job : il ne consomme pas de
      // tentative et ne déclenche aucun backoff. Un e-mail retardé par le
      // bridage n'est pas un e-mail en risque de perte.
      limiter: { max: 40, duration: 3_600_000 },
      // 8 → 2. Le débit est déjà borné au-dessus ; au-delà de 2 en parallèle on
      // ne gagne rien qu'un pic de connexions simultanées, et le transport est
      // désormais mis en pool sur 2 connexions (cf. `client.ts`) — garder les
      // deux chiffres alignés évite qu'un worker attende une connexion libre.
      concurrency: 2,
      lockDuration: 120_000,
      // P2-23 audit indexation 2026-05-18 — bornage retention Redis :
      // garde 1000 jobs completed + 5000 jobs failed max (BullMQ purge auto).
      // Évite saturation Redis long-terme sur high-volume workers.
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on("ready", () => {
    console.log("[email-worker] ready");
    // Vérification du relais AU DÉMARRAGE (audit 2026-08-16). Sans elle, la
    // première preuve qu'un identifiant Zoho a expiré est un e-mail qu'un
    // stagiaire n'a pas reçu — constat a posteriori, sans date exploitable.
    // Volontairement non bloquante : un relais injoignable ne doit pas empêcher
    // le worker de consommer (les jobs échoueront et seront journalisés), et
    // encore moins empêcher les quarante autres workers de démarrer.
    void verifyTransport().then((r) => {
      if (r.ok) {
        console.log("[email-worker] relais SMTP joignable et authentifié ✓");
      } else {
        console.error(
          `[email-worker] ⛔ RELAIS SMTP INUTILISABLE — aucun e-mail ne partira : ${r.error}`,
        );
      }
    });
  });
  // La TRACE masque l'adresse (`m****@exemple.fr`). Elle etait imprimee en clair
  // sur stdout a chaque envoi et a chaque echec — alors que `"to"` figure dans
  // `EMAIL_KEYS` de `sanitize-job-data.ts`, c'est-a-dire que le depot la classe
  // deja comme donnee personnelle et la masque avant Sentry. On ne protegeait
  // que le canal SaaS, jamais les journaux du conteneur. Le domaine reste
  // visible : c'est lui qui sert au diagnostic, et il n'identifie personne.
  worker.on("completed", (job) =>
    console.log(`[email-worker] sent: ${job.name} → ${redactEmailValue(String(job.data.to))}`),
  );
  worker.on("failed", (job, err) => {
    console.error(
      `[email-worker] failed: ${job?.name} → ` +
        `${redactEmailValue(String(job?.data?.to ?? ""))}: ${err.message}`,
    );
    // Sprint Final P1-2 (audit final 2026-05-22) — Sentry capture email-worker.
    captureWorkerError("email", "emails", job, err);
  });

  return worker;
}

// ============================================================
// submission-reply : delivery status sync (Sprint Notif Infra 2026-05-26)
// ============================================================
//
// Le payload `submission-reply` ne contient PAS le HTML — il référence le
// `SubmissionReply.id`. On lit le bodyHtml/bodyText pré-rendu depuis la DB
// (figé au moment du replyToSubmissionAction), on envoie, puis on update
// le `deliveryStatus` + `sentAt`/`failedAt` + `Submission.firstRepliedAt`/
// `lastRepliedAt`. Throw en cas d'échec SMTP → BullMQ retry avec backoff.

async function handleSubmissionReply(payload: Record<string, unknown>): Promise<void> {
  const replyId = typeof payload["replyId"] === "string" ? (payload["replyId"] as string) : null;
  if (!replyId) throw new Error("[email-worker] submission-reply: missing replyId");

  const reply = await prisma.submissionReply.findUnique({
    where: { id: replyId },
    include: { submission: { select: { id: true, firstRepliedAt: true } } },
  });
  if (!reply) throw new Error(`[email-worker] SubmissionReply ${replyId} not found`);

  const replyTo = process.env.ADMIN_REPLY_FROM ?? "contact@axion-ia.com";

  // `toEmail` est stocké CHIFFRÉ au repos (enc:v1, PII contact). On déchiffre au
  // seul moment de l'envoi. decryptPii = no-op sur une valeur déjà en clair.
  const to = decryptPii(reply.toEmail);

  // Garde : si l'adresse est illisible — clé `PII_ENCRYPTION_KEY` absente ou
  // désalignée sur le WORKER → decryptPii renvoie le placeholder — inutile de
  // consommer les 5 retries BullMQ sur un problème de CONFIG. On marque `failed`
  // avec un errorMsg distinctif (rejouable après alignement de la clé) et on NE
  // throw PAS. C'est la cause racine #1 du « Échec envoi » (cf. plan §0).
  if (!isDecryptedEmailUsable(to)) {
    await prisma.submissionReply.update({
      where: { id: reply.id },
      data: {
        deliveryStatus: "failed",
        failedAt: new Date(),
        errorMsg: "recipient: adresse illisible (PII_ENCRYPTION_KEY worker absente/désalignée ?)",
      },
    });
    return;
  }

  try {
    const result = await sendEmail({
      to,
      subject: reply.subject,
      html: reply.bodyHtml,
      text: reply.bodyText,
      replyTo,
    });
    const now = new Date();
    await prisma.$transaction([
      prisma.submissionReply.update({
        where: { id: reply.id },
        data: {
          deliveryStatus: "sent",
          sentAt: now,
          providerMessageId: result.messageId,
        },
      }),
      prisma.submission.update({
        where: { id: reply.submissionId },
        data: {
          firstRepliedAt: reply.submission.firstRepliedAt ?? now,
          lastRepliedAt: now,
        },
      }),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.submissionReply.update({
      where: { id: reply.id },
      data: {
        deliveryStatus: "failed",
        failedAt: new Date(),
        errorMsg: msg.slice(0, 2000),
        retryCount: { increment: 1 },
      },
    });
    throw e; // BullMQ retry avec backoff exponentiel
  }
}
