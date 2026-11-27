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

import { DelayedError, UnrecoverableError, Worker } from "bullmq";
import type { Job } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "../lib/sentry-worker";
import { redactEmailValue, sansAdresse } from "../lib/sanitize-job-data";
import { sendEmail, verifyTransport } from "@/lib/email/client";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import * as gabarits from "@/lib/email/templates";
import { renderEmailTemplate } from "@/lib/email/templates";
import {
  GABARITS_A_PHRASE_PIECES_JOINTES,
  payloadSansAnnexesOmises,
} from "@/lib/email/templates/_annexes-jointes";
import {
  estJetonOpposition,
  jetonOpposition,
  lireJetonOpposition,
  normaliserAdresse,
} from "@/server/email/opposition-jeton";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { cloturerJournal, marquerAnnule, noterTentativeEchouee } from "@/server/email/email-log";
import { enregistrerCopieEnvoi } from "@/server/email/copie-envoi";
import { GABARITS_A_CODE_UNIQUE } from "@/lib/email/gabarits-a-code";
import { codeDuPayload, erreurSansCode, payloadPourRendu } from "@/server/email/code-en-file";
// Base seule : sûr sur le trajet du worker (cf. l'en-tête de `journal.ts`).
import { marquerGuideEnvoye } from "@/server/guide-ia/journal";
import { ENTITE_GUIDE } from "@/server/guide-ia/config";
// 🔴 `verdict-envoi`, JAMAIS `suppression` : ce dernier importe paresseusement
// un service qui tire `next-auth` et `next/headers`. Sous `tsx`, hors de Next,
// tous les e-mails du site mourraient au premier départ. Gardé par
// `__tests__/email-worker.opposition.graphe-worker.spec.ts`.
import {
  dateDeMiseAEcart,
  estSollicitationSoumiseAOpposition,
  verdictAvantEnvoi,
} from "@/server/email/verdict-envoi";
// Base + déchiffrement + règle pure seulement : sûr sur le trajet du worker
// (même garde de graphe que `verdict-envoi`).
// Le registre des relectures au départ (CAMP-1) : base, déchiffrement, règles pures
// seulement — même garde de graphe que `verdict-envoi`.
import { gabaritEnSommeil } from "@/server/qualiopi/financements/sommeil";
import { RELECTURES_AU_DEPART } from "@/server/email/relecture-au-depart";
import {
  MOTIF_ECHEC_SANS_ENVOI,
  MOTIF_ISSUE_INCONNUE,
  MOTIF_REDIS_INDISPONIBLE,
  PREFIXE_ISSUE_INCONNUE,
  TTL_MARQUEUR_ENVOYE_SEC,
  cleMarqueurEnvoiReponse,
  cleVerrouEnvoiReponse,
} from "@/lib/email/reponse-manuelle-etat";
import type { GabaritReponse } from "@/lib/email/reponse-manuelle-etat";
import { EmailLogStatus } from "../../../../prisma/generated/client";
import type { EmailJobData, EmailJobName } from "../types";

/**
 * La fiche liée au job a-t-elle disparu depuis l'enfilage ? Absente, en
 * corbeille, ou effacée au titre de l'art. 17 (adresse synthétique
 * `…@erased.local`) : écrire serait écrire à une personne qui a demandé
 * l'oubli, ou à une adresse qui n'existe pas.
 *
 * Base injoignable : `null` — on ne SAIT pas, et l'appelant laisse partir
 * (échec ouvert, assumé comme pour le verdict, et bruyant).
 */
async function ficheEffacee(submissionId: string): Promise<boolean | null> {
  try {
    const ligne = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { deletedAt: true, contactEmail: true },
    });
    if (ligne === null || ligne.deletedAt !== null) return true;
    let adresse: string | null = null;
    try {
      adresse = decryptPii(ligne.contactEmail);
    } catch {
      adresse = null;
    }
    return typeof adresse === "string" && adresse.endsWith("@erased.local");
  } catch (e) {
    console.error(
      `[email-worker] lecture de la fiche ${submissionId} impossible — envoi maintenu :`,
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

/**
 * 🔴 2026-09-19 — LE FILET DU DÉPART, pour les sollicitations du réseau
 * d'apporteurs (relances J+2 / J+7, invitation, kit du dossier commencé).
 *
 * Pour un job DÉJÀ en file, ce filet est la SEULE protection : `enqueueEmail`
 * vérifie à l'enfilage, et ne voit donc que l'état de cet instant. Les relances
 * J+2 / J+7 et le kit du dossier commencé sont RETARDÉS — ils dorment des heures
 * ou des jours dans Redis. L'invitation part tout de suite, mais peut séjourner
 * en file de validation. Dans les deux cas, une opposition cliquée ou une fiche
 * effacée entre-temps ne se lit qu'ici, au départ.
 *
 * Rend le motif de la retenue, ou `null` si l'envoi peut partir.
 */
async function motifDeRetenueAuDepart(data: EmailJobData): Promise<string | null> {
  const verdict = await verdictAvantEnvoi(data.to, {
    template: data.template,
    marketing: data.marketing === true,
    // CAMP-1 : seule une SOLLICITATION honore l'opposition ; un gabarit relu au
    // départ sans en être une (argent, pièce) ne s'arrête que sur rebond ou
    // désabonnement. Pour tout gabarit entré ici avant CAMP-1, c'était `true`.
    sollicitation: estSollicitationSoumiseAOpposition(data.template, data.payload),
    // Départ : une panne de lecture de la mise à l'écart fait réessayer le job (jamais d'envoi).
    auDepart: true,
  });
  if (verdict.retenu) {
    return verdict.motif === "oppose"
      ? "la personne s'est opposée aux sollicitations"
      : verdict.motif === "rebond_dur"
        ? "adresse en rebond définitif"
        : verdict.motif === "ecarte_effacement"
          ? "la personne a demandé l'effacement (mise à l'écart de tout envoi)"
          : "désabonnement";
  }
  if (data.entityType === "Submission" && data.entityId) {
    if ((await ficheEffacee(data.entityId)) === true) {
      return "la fiche a été supprimée ou effacée (RGPD)";
    }
  }
  // 2026-09-27 — les rappels de l'invitation à l'échange : une réservation,
  // une réponse, un classement arrivés depuis le passage qui les a posés les
  // retiennent ICI. Sans fiche liée, on ne peut rien vérifier : on retient.
  // CAMP-1 — chaque gabarit relu déclare son lecteur dans le registre
  // (`relecture-au-depart.ts`) ; celui des rappels apporteurs est inchangé.
  const lecteur = RELECTURES_AU_DEPART.get(data.template);
  if (lecteur) return lecteur(data);
  return null;
}

import { notePiecesFacultatives, resoudrePiecesJointes } from "@/server/email/pieces-jointes";
// Pièces jointes : extraites dans `@/server/email/pieces-jointes` (partagées avec l'aperçu de la console).
export {
  TAILLE_MAX_PJ_OCTETS,
  notePiecesFacultatives,
  resolveAttachments,
  resoudrePiecesJointes,
} from "@/server/email/pieces-jointes";
export type { PieceOmise, PiecesResolues } from "@/server/email/pieces-jointes";

/**
 * STOP-T1b — le guide a-t-il DÉJÀ été servi par un autre job, parti APRÈS la mise en file de
 * celui-ci ? C'est le cas d'un ancien job « guide » clos en échec : le rattrapage a remis la
 * demande en file (nouveau job, guide envoyé), puis « renvoyer les échecs » relance l'ancien
 * (`job.retry()`), et le guide partirait une seconde fois.
 *
 * Un renvoi VOULU n'est pas touché : la console, le formulaire et le rattrapage créent un
 * NOUVEAU job, mis en file après le premier envoi (`sent_at` est le PREMIER envoi, donc plus
 * ancien que ce job) — ce job-là porte une date de création postérieure à `sent_at`.
 * Seul un envoi parti après la création du job le rend superflu — vu dans `sent_at` de la demande
 * OU dans le journal d'envoi (un autre job, `sent`), au cas où `sent_at` n'aurait pas été écrit.
 *
 * Sans date de création lisible, on ne peut pas trancher : au moindre doute rien ne part, le job
 * est retenu (mieux vaut un guide non envoyé, rattrapable, qu'un second envoi).
 * Lecture en panne : l'erreur remonte (`echecAuDepart` : rien ne part, réessai).
 */
async function guideDejaServiApresCeJob(
  demandeId: string,
  creationDuJobMs: unknown,
): Promise<boolean> {
  if (typeof creationDuJobMs !== "number" || !Number.isFinite(creationDuJobMs)) return true;
  const demande = await prisma.guideRequest.findUnique({
    where: { id: demandeId },
    select: { sentAt: true },
  });
  if (demande?.sentAt && demande.sentAt.getTime() >= creationDuJobMs) return true;
  // Le journal d'envoi fait foi quand `sent_at` n'a pas pu être écrit après un envoi réel : un
  // job, `sent` après la mise en file de celui-ci — y compris ce même job relancé après une chute
  // du conteneur (ligne `sent` écrite, `sent_at` vide) : aucune exclusion sur `job_id`.
  const envoi = await prisma.emailLog.findFirst({
    where: {
      entityType: ENTITE_GUIDE,
      entityId: demandeId,
      status: EmailLogStatus.sent,
      sentAt: { gte: new Date(creationDuJobMs) },
    },
    select: { id: true },
  });
  return envoi !== null;
}

/** Reports d'un job au gabarit inconnu : 9 × 10 min = 90 min, au-delà de la fenêtre app/worker (D8b). */
export const REPORTS_GABARIT_INCONNU_MAX = 9;
export const DELAI_REPORT_GABARIT_INCONNU_MS = 10 * 60_000;

/**
 * Lot S3 — ce worker connaît-il ce gabarit ? Tolérant : si le contrôle lui-même est indisponible
 * (export absent), on rend « connu » et le chemin historique s'applique inchangé.
 */
function gabaritConnu(nom: string): boolean {
  try {
    const f = gabarits.estGabaritConnu;
    return typeof f === "function" ? f(nom) : true;
  } catch {
    return true;
  }
}

export function startEmailWorker(): Worker<EmailJobData, void, EmailJobName> {
  const worker = new Worker<EmailJobData, void, EmailJobName>(
    "emails",
    async (job, token) => {
      const { to, locale, payload, marketing, entityType, entityId } = job.data;
      let { template } = job.data;
      // Lot S3 — rempli seulement quand l'envoi part par le gabarit de repli (trace au journal).
      let noteRepli: string | undefined;
      // Contexte d'essai des réponses manuelles : même règle que `echecAuDepart` plus bas.
      const contexteEssai: ContexteEssai = {
        job,
        token,
        jobId: job.id,
        essai: job.attemptsMade + 1,
        essaisMax: job.opts.attempts ?? 1,
        demarrage: job.attemptsStarted,
      };

      // Sprint Notif Infra 2026-05-26 / Chantier 5 — branche dédiée
      // submission-reply : on synchronise SubmissionReply.deliveryStatus
      // + Submission.firstRepliedAt/lastRepliedAt après envoi MTA. Suivi propre
      // via SubmissionReply → pas de double journalisation dans EmailLog.
      if (template === "submission-reply") {
        await handleSubmissionReply(payload, contexteEssai);
        return;
      }

      // Lot 1 du chantier recrutement — même mécanique, autre table. Le payload
      // ne porte PAS le HTML : il référence `JobApplicationReply.id`, et
      // l'adresse est relue puis déchiffrée au seul moment de l'envoi. Aucune
      // donnée personnelle ne transite par la file.
      if (template === "candidature-reponse") {
        await handleCandidatureReponse(payload, contexteEssai);
        return;
      }

      // L9b — e-mail en sommeil (fiche L9) : un job déjà en file, rejoué ou réessayé ne part pas.
      // Journal clos « annulé » (jamais « échec »), pas de throw : BullMQ ne réessaie pas.
      if (gabaritEnSommeil(job.data.template)) {
        const trace = "Retenu à l'envoi : e-mail en sommeil";
        if (job.id) await marquerAnnule(job.id, trace);
        console.warn(`[email-worker] ${trace} (job ${job.id ?? "sans identifiant"})`);
        return;
      }

      const jobId = job.id;
      const attempts = job.attemptsMade + 1;

      // Lot S3 (D8b) — gabarit inconnu de CE worker (application mise en ligne avant lui) :
      // report (sans tentative comptée, journal « en attente »), puis repli `gabaritRepli`
      // s'il est connu, sinon échec franc. Jamais de rendu d'un nom inconnu, jamais de boucle.
      if (!gabaritConnu(template)) {
        // `types.ts` est hors périmètre S3 : le compteur se lit sans élargir `EmailJobData`.
        const donnees = job.data as EmailJobData & { reportsGabaritInconnu?: number };
        const reports = donnees.reportsGabaritInconnu ?? 0;
        if (reports < REPORTS_GABARIT_INCONNU_MAX) {
          await job.updateData({ ...donnees, reportsGabaritInconnu: reports + 1 } as EmailJobData);
          await job.moveToDelayed(Date.now() + DELAI_REPORT_GABARIT_INCONNU_MS, token);
          throw new DelayedError();
        }
        const repli = (payload as { gabaritRepli?: unknown } | null | undefined)?.gabaritRepli;
        if (typeof repli === "string" && gabaritConnu(repli)) {
          console.warn(
            `[email-worker] rendu par repli : ${repli} (gabarit « ${template} » inconnu)`,
          );
          template = repli as EmailJobName;
          noteRepli = `rendu par le gabarit de repli ${repli}`;
        } else {
          const motif = `gabarit inconnu de ce worker : « ${template} » (aucun gabarit de repli connu)`;
          await cloturerJournal({
            template,
            recipient: to,
            locale,
            marketing: marketing === true,
            attempts,
            status: EmailLogStatus.failed,
            error: motif,
            failedAt: new Date(),
            ...(entityType ? { entityType } : {}),
            ...(entityId ? { entityId } : {}),
            ...(jobId ? { jobId } : {}),
          });
          // Le gestionnaire `failed` du worker (plus bas) capture déjà dans Sentry.
          throw new UnrecoverableError(motif);
        }
      }

      // STOP-T1 — un contrôle du DÉPART qui lève (base en panne) ne doit jamais laisser la ligne
      // du journal « en attente » à vie : essai non final → tentative notée, erreur relancée
      // (BullMQ réessaie, rien ne part) ; essai final → journal clos en échec. Motif sans adresse.
      const echecAuDepart = async (err: unknown): Promise<never> => {
        const motifEchec = "contrôle du départ illisible : rien n'est parti";
        if (attempts < (job.opts.attempts ?? 1)) {
          await noterTentativeEchouee({
            template,
            recipient: to,
            locale,
            marketing: marketing === true,
            attempts,
            error: motifEchec,
            ...(jobId ? { jobId } : {}),
          });
        } else {
          await cloturerJournal({
            template,
            recipient: to,
            locale,
            marketing: marketing === true,
            attempts,
            status: EmailLogStatus.failed,
            error: motifEchec,
            failedAt: new Date(),
            ...(entityType ? { entityType } : {}),
            ...(entityId ? { entityId } : {}),
            ...(jobId ? { jobId } : {}),
          });
        }
        throw err;
      };

      let retenu = false;
      try {
        // 🔴 2026-09-19 — sollicitation du réseau d'apporteurs : l'opposition et
        // l'effacement se relisent AU DÉPART. Un envoi retenu se clôt en « annulé », JAMAIS en
        // « échec » : l'alarme des échecs (SEUIL_ECHECS) compterait une opposition
        // honorée comme une panne. Pas de `throw` — BullMQ rejouerait le job.
        // Pas d'alerte console non plus : une opposition respectée n'appelle
        // aucune action.
        if (
          estSollicitationSoumiseAOpposition(template, payload) ||
          RELECTURES_AU_DEPART.has(template) ||
          // STOP-T1b — un job marketing relit lui aussi l'opposition / le désabonnement au départ
          // (aujourd'hui aucun producteur n'en crée : filet pour le jour où il y en aura un).
          job.data.marketing === true
        ) {
          // Gabarit de repli : le contrôle relit le gabarit RÉELLEMENT rendu, pas le nom inconnu.
          const motif = await motifDeRetenueAuDepart({ ...job.data, template });
          if (motif !== null) {
            const trace = `Retenu à l'envoi : ${motif}`;
            if (job.id) {
              await marquerAnnule(job.id, trace);
            } else {
              console.warn(`[email-worker] « ${template} » ${trace} (job sans identifiant).`);
            }
            retenu = true;
          }
        } else if ((await dateDeMiseAEcart(to, template)) !== null) {
          // Décision du 11/11/2026 : une personne mise à l'écart (demande d'effacement) ne reçoit
          // plus rien, QUEL QUE SOIT le gabarit — y compris un job enfilé avant la demande, ou en
          // attente d'un réessai. Seule la réponse à un droit (`gdpr-export-link`) passe.
          // Les sollicitations et gabarits relus au départ passent déjà par `verdictAvantEnvoi`.
          const trace =
            "Retenu à l'envoi : la personne a demandé l'effacement (mise à l'écart de tout envoi)";
          if (job.id) {
            await marquerAnnule(job.id, trace);
          } else {
            console.warn(`[email-worker] « ${template} » ${trace} (job sans identifiant).`);
          }
          retenu = true;
        }
        // STOP-T1b — « Votre guide » : une demande déjà servie par un autre job, parti après la
        // mise en file de celui-ci, ne reçoit pas le guide une seconde fois. Clos en « annulé »,
        // sans `throw` (BullMQ ne réessaie pas), comme les autres retenues du départ.
        if (!retenu && entityType === ENTITE_GUIDE && entityId) {
          if (await guideDejaServiApresCeJob(entityId, job.timestamp)) {
            const trace = "Retenu à l'envoi : guide déjà envoyé pour cette demande";
            if (job.id) {
              await marquerAnnule(job.id, trace);
            } else {
              console.warn(`[email-worker] « ${template} » ${trace} (job sans identifiant).`);
            }
            retenu = true;
          }
        }
      } catch (err) {
        return echecAuDepart(err);
      }
      if (retenu) return;

      try {
        // Pièces résolues AVANT le rendu : la phrase « pièces jointes » de certains gabarits ne
        // cite que les annexes réellement parties (une facultative omise au GET n'est pas promise).
        const payloadRendu = payloadPourRendu(template, payload);
        const resolues = await resoudrePiecesJointes(job.data.attachments);
        const payloadDuRendu = GABARITS_A_PHRASE_PIECES_JOINTES.has(template)
          ? payloadSansAnnexesOmises(
              payloadRendu,
              resolues.omises.map((o) => o.filename),
            )
          : payloadRendu;
        const {
          subject: subjectRendu,
          html,
          text,
          famille,
        } = await renderEmailTemplate(template, locale, payloadDuRendu, {
          destinataire: to,
        });
        const attachments = resolues.pieces.length > 0 ? resolues.pieces : undefined;
        const notePieces = notePiecesFacultatives(resolues);
        const noteCloture = [noteRepli, notePieces].filter(Boolean).join(" ");
        // Lot 2 : l'objet forcé depuis la corbeille prime sur celui du gabarit.
        const subject = job.data.sujet?.trim() ? job.data.sujet.trim() : subjectRendu;
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
        // Guide de la page « Recevoir le guide » : le payload porte le jeton d'opposition de
        // l'adresse. Accepté seulement s'il est signé ET s'il désigne CE destinataire (jamais
        // un en-tête qui désinscrirait un tiers). Jamais journalisé.
        const jetonPage =
          payload && typeof payload === "object" && "oppositionToken" in payload
            ? (payload as { oppositionToken?: unknown }).oppositionToken
            : undefined;
        const jetonOppositionPage =
          typeof jetonPage === "string" &&
          estJetonOpposition(jetonPage) &&
          lireJetonOpposition(jetonPage) === normaliserAdresse(to)
            ? jetonPage
            : undefined;
        const unsubscribeToken =
          jetonNewsletter ??
          jetonOppositionPage ??
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
          // Seul champ de trace écrit à la clôture : on y note le repli et les pièces
          // facultatives, jointes (empreinte) ou non (sinon rien, inchangé).
          ...(noteCloture ? { error: noteCloture } : {}),
          ...(entityType ? { entityType } : {}),
          ...(entityId ? { entityId } : {}),
          ...(jobId ? { jobId } : {}),
        });
        // 2026-09-27 — la COPIE de ce qui vient de partir (objet, HTML, texte
        // rendus ci-dessus, liens personnels masqués), pour « voir l'e-mail »
        // depuis Emails › Envoyés. Best-effort : `enregistrerCopieEnvoi` ne
        // lève pas, et le `catch` local le garantit une seconde fois — une
        // exception ici tomberait dans le `catch` d'envoi, qui ferait rejouer
        // le job, donc RENVOYER un e-mail déjà parti.
        try {
          await enregistrerCopieEnvoi({
            jobId,
            subject,
            html,
            text,
            // Les pièces RÉELLEMENT parties : une facultative omise n'y figure pas.
            attachmentNames: job.data.attachments
              ? resolues.pieces.map((a) => a.filename)
              : undefined,
            // S6b : seul un e-mail à code à usage unique transmet son gabarit (code masqué).
            ...(GABARITS_A_CODE_UNIQUE.has(template)
              ? { template, codeAMasquer: codeDuPayload(template, payload) }
              : {}),
          });
        } catch (e) {
          console.error(
            "[email-worker] copie de l'envoi non conservée :",
            e instanceof Error ? e.message : String(e),
          );
        }
        // Lot L2 (2026-09-24) — « Votre guide » : la demande n'est « envoyée »
        // qu'ICI, après l'accord du relais. Le rattrapage lit ce champ.
        if (entityType === ENTITE_GUIDE && entityId) {
          await marquerGuideEnvoye(entityId);
        }
      } catch (errBrut) {
        // S6b (relecture sécurité) — un envoi à code n'expose jamais son code : le message
        // d'erreur (relais, rendu) est masqué AVANT d'aller au journal des envois, dans
        // Redis (raison d'échec du job) et chez Sentry (rethrow → `failed`).
        const err = GABARITS_A_CODE_UNIQUE.has(template)
          ? erreurSansCode(errBrut, codeDuPayload(template, payload))
          : errBrut;
        const msg = err instanceof Error ? err.message : String(err);
        // 🔴 Lot 2 (2026-09-02) — UNE ligne par job, et « échec » seulement quand
        // c'est fini. Avant : chaque tentative ratée clôturait la ligne en
        // « échec », et la tentative suivante, ne trouvant plus de ligne « en
        // attente », en CRÉAIT une autre. Un email livré au 2ᵉ essai laissait
        // un « échec » à vie dans la console ; un job mort en laissait cinq ; et
        // l'alarme « 3 e-mails en échec » comptait des lignes, pas des envois.
        const tentativesMax = job.opts.attempts ?? 1;
        const definitif = attempts >= tentativesMax;
        if (!definitif) {
          await noterTentativeEchouee({
            template,
            recipient: to,
            locale,
            marketing: marketing === true,
            attempts,
            error: msg.slice(0, 2000),
            ...(jobId ? { jobId } : {}),
          });
          throw err; // BullMQ rejoue ; la ligne reste « en attente », tentative comptée
        }
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
        throw err; // rethrow : conserve la capture Sentry existante
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
    // STOP-T1b — jamais `err.message` brut : un refus du relais y cite l'adresse. Nom et code
    // de l'erreur seulement ; le détail reste dans Sentry (message masqué) et dans le journal.
    const code = (err as { code?: unknown }).code;
    console.error(
      `[email-worker] failed: ${job?.name} → ` +
        `${redactEmailValue(String(job?.data?.to ?? ""))}: ${err.name}` +
        (typeof code === "string" || typeof code === "number" ? ` (${String(code)})` : ""),
    );
    // Sprint Final P1-2 (audit final 2026-05-22) — Sentry capture email-worker.
    captureWorkerError("email", "emails", job, err);
    // Échec FINAL d'une réponse (plus aucun essai) ou job tué deux fois : BullMQ ne rappelle pas
    // le processeur, la ligne resterait `pending`. `finishedOn` n'est posé que si le job ne sera
    // plus réessayé (bullmq `job.js` moveToFailed) ; le texte de BullMQ reste un second signal.
    if (
      job &&
      (typeof job.finishedOn === "number" || err.message === MESSAGE_BLOCAGE_BULLMQ) &&
      (job.data?.template === "submission-reply" || job.data?.template === "candidature-reponse")
    ) {
      cloreEchecFinal({
        id: job.id,
        data: { template: job.data.template, payload: job.data.payload },
        moveToDelayed: (ts, tk) => job.moveToDelayed(ts, tk),
      }).catch((e) => captureWorkerError("email", "emails", job, e));
    }
  });

  return worker;
}

// ============================================================
// Réponses manuelles (submission-reply, candidature-reponse) : UN SEUL ENVOI
// ============================================================
//
// 🔴 Correctif « un seul envoi » (PR-W). Avant, ces deux handlers posaient `failed`
// dès le PREMIER échec puis relevaient l'erreur, sans relire l'état de la ligne
// avant d'envoyer. Or BullMQ réessaie (`attempts: 5`, délai exponentiel dès 5 s)
// et la `concurrency` vaut 2 : deux jobs de la même réponse pouvaient tourner en
// même temps, et le bouton « Réessayer » (visible sur `failed`) en ajoutait un
// troisième. De plus l'écriture `sent` se trouvait dans le même `try` que l'envoi :
// envoi réussi + base en échec = `failed` + erreur relevée = e-mail renvoyé.
//
// Garanties, identiques pour les deux gabarits (`envoyerReponseUnSeulEnvoi`) :
//  1. rien ne part si l'e-mail est déjà parti (`sentAt`, `providerMessageId`, marqueur
//     `envoye:…`, statut `sent` ou `bounced`) ; seuls `pending` et `failed` peuvent partir
//     (`failed` reste accepté : l'ancienne application met en file AVANT de repasser
//     `pending`), sauf une ligne `failed` « issue inconnue » (garantie 6) ;
//  2. un seul envoi à la fois par réponse : verrou Redis `verrou:envoi-reponse:…`
//     (SET NX EX 24 h, jeton unique PAR DÉMARRAGE). Le verrou est aussi la TRACE « un
//     envoi a commencé et son issue n'est pas écrite » : il n'est libéré qu'une fois
//     l'issue connue (échec SMTP levé, `sent` écrit, sortie sans envoi, issue inconnue
//     écrite). On le juge d'après son âge, jamais d'après son existence seule ;
//  3. `failed` seulement au DERNIER essai, sauf erreur d'envoi ambiguë : issue inconnue tout
//     de suite, jamais de nouvel essai ; avant : la ligne reste `pending` ;
//  4. l'écriture `sent` est séparée de l'envoi, retentée 3 fois, précédée d'un marqueur
//     Redis `envoye:…` (30 j). Si elle échoue encore : verrou GARDÉ, report de 60 s
//     (`DelayedError`, aucun essai consommé) ; au retour le marqueur répare en `sent` ;
//  5. les contrôles d'adresse (illisible, mise à l'écart) se font sous le verrou ;
//  6. issue inconnue (détenteur du verrou mort ou job tué deux fois) → `failed` avec le
//     préfixe `[issue-inconnue]`, JAMAIS de renvoi automatique : seul un humain tranche.
//     Sonde de vie `bull:emails:<jobId>:lock`, contre-vérification du verrou juste avant
//     l'envoi, clôture à l'échec final des seules lignes `pending` (`cloreEchecFinal`).
// Toute écriture d'état passe par un `updateMany` conditionné à `sentAt: null` :
// elle n'écrase jamais `sent`. Aucune écriture automatique ne retire le préfixe, sauf
// l'écriture `sent` quand le marqueur prouve le départ.
//
// Le corps est LU en base (figé à la rédaction), jamais re-rendu ; l'adresse est
// déchiffrée au dernier moment ; aucun changement de forme de job, de nom de
// gabarit ou de `jobId`. 🔑 Ce worker ne doit RIEN importer de `next/*`,
// `server-only`, `next-auth` (garde : `email-worker.opposition.graphe-worker.spec.ts`).
//
// ⛔ Ordre de mise en ligne : ce commit en ligne SEUL, contenu du conteneur worker
// vérifié (marqueur `verrou:envoi-reponse`), AVANT toute PR qui rend « Réessayer »
// atomique côté application. Interdit de ramener le worker sous ce commit ; procédure : `AGENTS.md`,
// section « Worker d'e-mails : jamais de retour arrière ».

/** Ce que le handler utilise du job BullMQ (le vrai `Job` y satisfait). */
interface JobReponse {
  id?: string | undefined;
  moveToDelayed(timestamp: number, token?: string): Promise<void>;
}

/** Contexte d'essai calculé par le processeur (même règle que `echecAuDepart`). */
interface ContexteEssai {
  job: JobReponse;
  token: string | undefined;
  jobId: string | undefined;
  essai: number;
  essaisMax: number;
  /** `job.attemptsStarted` : +1 à CHAQUE mise en `active` (relance après blocage comprise). */
  demarrage: number;
}

/**
 * Le verrou est aussi la trace d'un envoi commencé dont l'issue n'est pas écrite : il vit
 * 24 h et se juge d'après son âge (`TTL × 1000 − PTTL`), pas d'après son TTL. Il ne peut
 * donc plus expirer pendant un envoi vivant. `SEUIL_ORPHELIN_MS` (30 min) dépasse le pire
 * envoi avec les délais nodemailer par défaut (~13 min) : au-delà, le détenteur est
 * considéré comme mort. Délais explicites dans `client.ts` (30 s, 30 s, 120 s d'inactivité, 30 s
 * DNS) ; `SEUIL_ORPHELIN_MS` inchangé, il reste au-dessus du pire envoi.
 * Voir `emails-site/PLAN-W1-ADDENDUM.md` et « Addendum 2 W1 ».
 *
 * Ne jamais changer cette valeur sans période de transition : l'âge se calcule par
 * `TTL × 1000 − PTTL` ; pendant le chevauchement de deux workers, une hausse ferait paraître
 * mort un détenteur vivant.
 */
const TTL_VERROU_ENVOI_SEC = 86_400;
const SEUIL_ORPHELIN_MS = 1_800_000;
const REPORT_MAX_MS = 300_000;
const REPORT_PLAFOND_MS = 1_800_000;
const REPORT_PAS_DE_VERROU_MS = 5_000;
const REPORT_MARGE_MS = 15_000;
const REPORT_ECRITURE_MS = 60_000;
const ESSAIS_ECRITURE_ENVOYE = 3;
const ATTENTES_ECRITURE_MS = [200, 1_000];
const MESSAGE_BLOCAGE_BULLMQ = "job stalled more than allowable limit";
export {
  PREFIXE_ISSUE_INCONNUE,
  MOTIF_ISSUE_INCONNUE,
  MOTIF_REDIS_INDISPONIBLE,
  MOTIF_ECHEC_SANS_ENVOI,
} from "@/lib/email/reponse-manuelle-etat";
// Jeton de verrou = `${jobId}-${essai}-${demarrage}` ; le jobId peut contenir des tirets (email-<uuid>).
const RE_JETON = /^(.+)-(\d+)-(\d+)$/;
// Clé du verrou BullMQ du job : préfixe `bull` par défaut (`bullmq/dist/cjs/classes/queue-base.js:30`),
// aucun `prefix` dans `connection.ts` ni `queues.ts`, file `emails`, suffixe `:lock`
// (`bullmq/dist/cjs/classes/scripts.js:436`). Elle n'existe que tant que le job est `active`.
const cleVerrouBullmq = (jobId: string) => `bull:emails:${jobId}:lock`;
const CODES_AVANT_TRANSMISSION = new Set([
  "EDNS",
  "EAUTH",
  "ENOAUTH",
  "ETLS",
  "EREQUIRETLS",
  "EENVELOPE",
  "EMESSAGE",
  "ECONFIG",
]);
const DEBUT_ERREUR_CONFIG_SMTP = "[email] configuration SMTP incomplète"; // client.ts:109
const SCRIPT_LIBERER =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/** Ligne de réponse, vue minimale commune aux deux tables. */
interface LigneReponse {
  id: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  deliveryStatus: string;
  sentAt: Date | null;
  providerMessageId: string | null;
  errorMsg?: string | null;
}

interface AdaptateurReponse<L extends LigneReponse> {
  gabarit: GabaritReponse;
  /** Relit la ligne (null si absente). */
  lire(replyId: string): Promise<L | null>;
  /** Pose un état sur la ligne, jamais si `sentAt` est rempli. */
  ecrireSiNonEnvoye(id: string, data: Record<string, unknown>): Promise<unknown>;
  /** Comme `ecrireSiNonEnvoye`, mais jamais sur une ligne dont `errorMsg` porte le préfixe « issue inconnue ». */
  ecrireSiNiEnvoyeNiIssueInconnue(id: string, data: Record<string, unknown>): Promise<unknown>;
  /** Comme `ecrireSiNiEnvoyeNiIssueInconnue`, et seulement si la ligne est encore `pending`. */
  ecrireSiEncorePendingSansIssueInconnue(
    id: string,
    data: Record<string, unknown>,
  ): Promise<unknown>;
  /** Repasse `sent` une ligne `pending`/`failed` dont `sentAt` est rempli. */
  reparerEnvoye(id: string): Promise<unknown>;
  /** Écrit l'envoi réussi (et ce qui va avec). */
  marquerEnvoye(ligne: L, messageId: string, maintenant: Date): Promise<unknown>;
}

const attendre = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// Clés Redis `verrou:envoi-reponse:<gabarit>:<replyId>` et `envoye:envoi-reponse:…` : construites
// par le module pur (AGENTS.md s'appuie sur ce littéral comme marqueur de contenu du conteneur).
const cleVerrou = (gabarit: GabaritReponse, replyId: string) =>
  cleVerrouEnvoiReponse(gabarit, replyId);
const cleMarqueur = (gabarit: GabaritReponse, replyId: string) =>
  cleMarqueurEnvoiReponse(gabarit, replyId);

export type IssueEchecEnvoi = "rien_parti" | "ambigu";

/**
 * Un nouvel essai automatique n'est permis que si l'erreur PROUVE que le relais n'a pas pris le
 * message ; tout le reste est ambigu (champs d'erreur de nodemailer 9.0.5 : `code`, `responseCode`,
 * `syscall`). Si un texte de nodemailer change, l'erreur tombe en « ambigu » : jamais de doublon.
 */
export function classerEchecEnvoi(e: unknown): IssueEchecEnvoi {
  if (!(e instanceof Error)) return "ambigu";
  const x = e as Error & { code?: unknown; responseCode?: unknown; syscall?: unknown };
  // 1. Le relais a répondu un refus 4xx/5xx : il n'a pas pris le message (RFC 5321).
  if (typeof x.responseCode === "number" && x.responseCode >= 400 && x.responseCode <= 599) {
    return "rien_parti";
  }
  // 2. Codes qui ne naissent qu'avant la transmission.
  if (typeof x.code === "string" && CODES_AVANT_TRANSMISSION.has(x.code)) return "rien_parti";
  // 3. Connexion TCP jamais établie.
  if (x.syscall === "connect" || x.syscall === "getaddrinfo") return "rien_parti";
  // 4. Délais de la phase de connexion.
  if (
    x.code === "ETIMEDOUT" &&
    (x.message.startsWith("Connection timeout") || x.message.startsWith("Greeting never received"))
  ) {
    return "rien_parti";
  }
  // 5. Garde de configuration de client.ts : levée avant tout transport.
  if (x.message.startsWith(DEBUT_ERREUR_CONFIG_SMTP)) return "rien_parti";
  // 6. Connexion déjà détruite : nodemailer refuse AVANT d'écrire quoi que ce soit
  //    (smtp-connection `_isDestroyedMessage`).
  if (
    x.code === "ECONNECTION" &&
    /^Cannot (connect|login|send message) - smtp connection /.test(x.message)
  ) {
    return "rien_parti";
  }
  // Restent « ambigu » volontairement : « Unexpected socket close » (sans pool, elle peut survenir
  // après l'acceptation du message), `ECONNECTION` « Connection closed unexpectedly »,
  // `ETIMEDOUT` « Timeout », `ESOCKET` sans `syscall: "connect"` (certificats TLS compris),
  // « Reached maximum number of retries after connection was closed ».
  return "ambigu";
}

/** Report croissant (2^k, k ≤ 5) plafonné : borne le nombre d'activations d'un job qui ne peut pas écrire. */
function delaiReportCroissant(ctx: ContexteEssai, baseMs: number): number {
  const k = Math.min(Math.max(0, ctx.demarrage - ctx.essai), 5);
  return Math.min(baseMs * 2 ** k, REPORT_PLAFOND_MS);
}

/** Lecture Redis d'avant l'envoi : si elle échoue, la ligne le dit, rien ne part, BullMQ réessaie. */
async function redisAvantEnvoi<L extends LigneReponse, T>(
  a: AdaptateurReponse<L>,
  id: string,
  ctx: ContexteEssai,
  op: () => Promise<T>,
): Promise<T> {
  try {
    return await op();
  } catch (e) {
    await noterVerrouIndisponible(a, id, ctx);
    throw e;
  }
}

/** Le détenteur du verrou d'envoi est-il encore un passage BullMQ vivant ? */
async function sondeDetenteur(
  valeurVerrou: string,
  tokenCourant: string | undefined,
): Promise<"vivant" | "mort"> {
  const m = RE_JETON.exec(valeurVerrou);
  if (!m || m[1] === "sans-id") return "mort"; // illisible : règle de l'âge seule
  const tokenBull = await redis.get(cleVerrouBullmq(m[1] as string));
  if (tokenBull === null) return "mort"; // job non actif : aucun passage vivant ne le traite
  if (tokenCourant !== undefined && tokenBull === tokenCourant) return "mort"; // NOTRE passage (relance après blocage)
  return "vivant";
}

/** Reporte le job SANS consommer d'essai (`skipAttempt`) ni émettre `failed`. */
async function reporter(ctx: ContexteEssai, delaiMs: number): Promise<never> {
  await ctx.job.moveToDelayed(Date.now() + delaiMs, ctx.token);
  throw new DelayedError();
}

/** Écrit `sent` (et efface un éventuel « issue inconnue »), 3 essais, 200 ms puis 1 s d'attente. */
async function ecrireEnvoyeRetente<L extends LigneReponse>(
  a: AdaptateurReponse<L>,
  ligne: L,
  messageId: string,
  maintenant: Date,
): Promise<unknown> {
  let derniere: unknown = null;
  for (let i = 0; i < ESSAIS_ECRITURE_ENVOYE; i++) {
    try {
      await a.marquerEnvoye(ligne, messageId, maintenant);
      return null;
    } catch (err) {
      derniere = err;
      const pause = ATTENTES_ECRITURE_MS[i];
      if (pause !== undefined) await attendre(pause);
    }
  }
  return derniere;
}

/**
 * Vrai si rien ne doit partir. Répare au passage : `sentAt` rempli → `sent` ; marqueur
 * `envoye:…` présent (l'e-mail est parti, l'écriture a échoué) → `sent` avec son messageId.
 */
async function dejaParti<L extends LigneReponse>(
  a: AdaptateurReponse<L>,
  l: L,
  replyId: string,
  ctx: ContexteEssai,
): Promise<boolean> {
  if (l.sentAt !== null || l.providerMessageId !== null) {
    if (l.sentAt !== null && l.deliveryStatus !== "sent") await a.reparerEnvoye(l.id);
    return true;
  }
  if (l.deliveryStatus !== "pending" && l.deliveryStatus !== "failed") return true;
  const issueInconnue =
    l.deliveryStatus === "failed" && (l.errorMsg ?? "").startsWith(PREFIXE_ISSUE_INCONNUE);
  let marqueur: string | null;
  if (issueInconnue) {
    // Ligne « issue inconnue » : aucune écriture automatique ne doit retirer le préfixe.
    try {
      marqueur = await redis.get(cleMarqueur(a.gabarit, replyId));
    } catch (e) {
      captureWorkerError("email", "emails", ctx.job as Job, e);
      return true; // ni envoi, ni écriture, ni erreur relevée
    }
  } else {
    marqueur = await redisAvantEnvoi(a, l.id, ctx, () =>
      redis.get(cleMarqueur(a.gabarit, replyId)),
    );
  }
  if (marqueur) {
    const echec = await ecrireEnvoyeRetente(a, l, marqueur, new Date());
    if (echec !== null) {
      captureWorkerError("email", "emails", ctx.job as Job, echec);
      await reporter(ctx, delaiReportCroissant(ctx, REPORT_ECRITURE_MS));
    }
    return true;
  }
  // Issue inconnue : seul un humain la débloque (« Réessayer » remet `errorMsg: null`).
  return issueInconnue;
}

async function libererVerrou(cle: string, valeur: string): Promise<boolean> {
  try {
    await redis.eval(SCRIPT_LIBERER, 1, cle, valeur);
    return true;
  } catch {
    // Le TTL finira le travail ; une libération ratée ne doit pas masquer le résultat.
    return false;
  }
}

/**
 * Détenteur du verrou mort (âge ≥ seuil) ou job tué deux fois : on ne sait pas si l'e-mail
 * est parti. Marqueur présent → `sent`. Sinon → `failed` + `MOTIF_ISSUE_INCONNUE`, écrit AVANT
 * la suppression du verrou. Ne lève jamais d'erreur d'envoi (un nouvel essai pourrait renvoyer).
 * `ctx` absent (job tué deux fois : hors processeur) → pas de report possible, on trace.
 */
async function cloreIssueInconnue<L extends LigneReponse>(
  a: AdaptateurReponse<L>,
  replyId: string,
  job: JobReponse | undefined,
  ctx: ContexteEssai | undefined,
  verrouLu: string | null,
  peutSupprimer: (valeur: string) => boolean,
): Promise<void> {
  const cle = cleVerrou(a.gabarit, replyId);
  const echecEcriture = async (err: unknown): Promise<void> => {
    captureWorkerError("email", "emails", job as Job | undefined, err);
    if (ctx) await reporter(ctx, delaiReportCroissant(ctx, REPORT_ECRITURE_MS)); // verrou gardé, on retentera plus tard
  };
  const ligne = await a.lire(replyId);
  if (ligne) {
    const maintenant = new Date();
    const marqueur = await redis.get(cleMarqueur(a.gabarit, replyId));
    const dejaClos = ligne.sentAt !== null || ligne.providerMessageId !== null;
    if (marqueur && !dejaClos) {
      const echec = await ecrireEnvoyeRetente(a, ligne, marqueur, maintenant);
      if (echec !== null) return echecEcriture(echec);
    } else if (dejaClos) {
      if (ligne.deliveryStatus !== "sent") await a.reparerEnvoye(ligne.id);
    } else if (ligne.deliveryStatus === "pending" || ligne.deliveryStatus === "failed") {
      try {
        await a.ecrireSiNonEnvoye(ligne.id, {
          deliveryStatus: "failed",
          failedAt: maintenant,
          errorMsg: MOTIF_ISSUE_INCONNUE,
        });
      } catch (err) {
        return echecEcriture(err);
      }
      captureWorkerError(
        "email",
        "emails",
        job as Job | undefined,
        new Error(`envoi interrompu, issue inconnue (${a.gabarit}, réponse ${replyId})`),
      );
    }
  }
  if (verrouLu !== null && peutSupprimer(verrouLu)) {
    // Pas de report si la suppression échoue : la ligne est déjà `failed` avec le motif, et un
    // report ne retenterait pas (`dejaParti` sort avant). Le prochain « Réessayer » rejuge le verrou.
    if (!(await libererVerrou(cle, verrouLu))) {
      captureWorkerError(
        "email",
        "emails",
        job as Job | undefined,
        new Error(
          `verrou d'envoi non supprimé (${a.gabarit}, réponse ${replyId}) : il expirera sous 24 h`,
        ),
      );
    }
  }
}

/** D4 : Redis indisponible à la prise du verrou : rien n'est envoyé, la ligne le dit. */
async function noterVerrouIndisponible<L extends LigneReponse>(
  a: AdaptateurReponse<L>,
  id: string,
  ctx: ContexteEssai,
): Promise<void> {
  const dernier = ctx.essai >= ctx.essaisMax;
  try {
    await a.ecrireSiNiEnvoyeNiIssueInconnue(
      id,
      dernier
        ? {
            deliveryStatus: "failed",
            failedAt: new Date(),
            errorMsg: MOTIF_REDIS_INDISPONIBLE,
          }
        : {
            deliveryStatus: "pending",
            errorMsg: `Essai ${ctx.essai}/${ctx.essaisMax} : verrou d'envoi indisponible, nouvel essai automatique`,
          },
    );
  } catch (ecriture) {
    captureWorkerError("email", "emails", ctx.job as Job, ecriture);
  }
}

async function envoyerReponseUnSeulEnvoi<L extends LigneReponse>(
  payload: Record<string, unknown>,
  ctx: ContexteEssai,
  a: AdaptateurReponse<L>,
): Promise<void> {
  const replyId = typeof payload["replyId"] === "string" ? (payload["replyId"] as string) : null;
  if (!replyId) throw new Error(`[email-worker] ${a.gabarit}: replyId manquant`);

  // Garantie 1, avant le verrou : si c'est déjà parti, sortir sans rien envoyer.
  const initiale = await a.lire(replyId);
  if (!initiale) throw new Error(`[email-worker] réponse ${replyId} introuvable (${a.gabarit})`);
  if (await dejaParti(a, initiale, replyId, ctx)) return;

  // Garantie 2 : un seul envoi à la fois. Jeton unique PAR DÉMARRAGE (relance après blocage comprise).
  const cle = cleVerrou(a.gabarit, replyId);
  const jeton = `${ctx.jobId ?? "sans-id"}-${ctx.essai}-${ctx.demarrage}`;
  let pris: string | null;
  try {
    pris = await redis.set(cle, jeton, "EX", TTL_VERROU_ENVOI_SEC, "NX");
  } catch (e) {
    await noterVerrouIndisponible(a, initiale.id, ctx);
    throw e; // rien n'a été envoyé : BullMQ réessaie
  }
  if (pris !== "OK") {
    // Le verrou est tenu : on lit l'âge, jamais le jeton.
    const valeur = await redisAvantEnvoi(a, initiale.id, ctx, () => redis.get(cle));
    const pttl = await redisAvantEnvoi(a, initiale.id, ctx, () => redis.pttl(cle));
    if (valeur === null || pttl === -2) return reporter(ctx, REPORT_PAS_DE_VERROU_MS);
    const age = pttl === -1 ? Number.POSITIVE_INFINITY : TTL_VERROU_ENVOI_SEC * 1000 - pttl;
    if (age < SEUIL_ORPHELIN_MS) {
      // Le détenteur est peut-être vivant : ni envoi, ni écriture, aucun essai consommé.
      await reporter(ctx, Math.min(SEUIL_ORPHELIN_MS - age + REPORT_MARGE_MS, REPORT_MAX_MS));
    }
    // Âge dépassé : le détenteur est-il pourtant vivant (verrou BullMQ d'un AUTRE passage) ?
    const detenteur = await redisAvantEnvoi(a, initiale.id, ctx, () =>
      sondeDetenteur(valeur, ctx.token),
    );
    if (detenteur === "vivant") await reporter(ctx, delaiReportCroissant(ctx, REPORT_MAX_MS));
    await cloreIssueInconnue(a, replyId, ctx.job, ctx, valeur, () => true);
    return;
  }

  // Le verrou n'est libéré que si l'issue est connue : un envoi tenté dont l'issue n'est pas
  // écrite le garde. Une sortie AVANT l'envoi (erreur de lecture, etc.) le libère.
  let envoiTente = false;
  let issueConnue = false;
  try {
    // Sous le verrou : relire, puis refaire le contrôle 1.
    const ligne = await a.lire(replyId);
    if (!ligne) throw new Error(`[email-worker] réponse ${replyId} introuvable (${a.gabarit})`);
    if (await dejaParti(a, ligne, replyId, ctx)) return;

    const replyTo = process.env.ADMIN_REPLY_FROM ?? "contact@axion-ia.com";
    // `toEmail` est chiffré au repos (enc:v1) : déchiffré au seul moment de l'envoi.
    const to = decryptPii(ligne.toEmail);

    // Garantie 5 : contrôles d'adresse sous le verrou. Adresse illisible = problème de
    // CONFIG (clé PII du worker) : on ne consomme pas les essais, on marque `failed`.
    if (!isDecryptedEmailUsable(to)) {
      await a.ecrireSiNiEnvoyeNiIssueInconnue(ligne.id, {
        deliveryStatus: "failed",
        failedAt: new Date(),
        errorMsg: "recipient: adresse illisible (PII_ENCRYPTION_KEY worker absente/désalignée ?)",
      });
      return;
    }
    // Mis en file avec `to = ""` : la mise à l'écart se relit ICI, sur l'adresse déchiffrée.
    if ((await dateDeMiseAEcart(to, a.gabarit)) !== null) {
      await a.ecrireSiNiEnvoyeNiIssueInconnue(ligne.id, {
        deliveryStatus: "failed",
        failedAt: new Date(),
        errorMsg: "retenu : la personne a demandé l'effacement (mise à l'écart de tout envoi)",
      });
      return;
    }

    // Contre-vérification : le verrou est-il encore le nôtre ? Sinon un autre passage a pris la
    // main (verrou perdu) : rien ne part. Le `finally` ne libère rien (le script compare la valeur).
    const verrouActuel = await redisAvantEnvoi(a, ligne.id, ctx, () => redis.get(cle));
    if (verrouActuel === null) {
      // Verrou disparu (expiré, purgé) : rien n'est parti, on réessaie ; `dejaParti` rejouera les gardes.
      const disparu = new Error(
        `verrou d'envoi disparu avant l'envoi (${a.gabarit}, réponse ${replyId}) : rien n'est parti, nouvel essai`,
      );
      captureWorkerError("email", "emails", ctx.job as Job, disparu);
      throw disparu;
    }
    if (verrouActuel !== jeton) {
      captureWorkerError(
        "email",
        "emails",
        ctx.job as Job,
        new Error(
          `verrou perdu avant l'envoi (${a.gabarit}, réponse ${replyId}) : rien n'est parti`,
        ),
      );
      return;
    }

    let messageId: string;
    envoiTente = true;
    try {
      const resultat = await sendEmail({
        to,
        subject: ligne.subject,
        html: ligne.bodyHtml,
        text: ligne.bodyText,
        replyTo,
      });
      messageId = resultat.messageId;
    } catch (e) {
      if (classerEchecEnvoi(e) === "ambigu") {
        // Le relais a pu prendre le message : issue inconnue tout de suite, aucun nouvel essai,
        // aucune erreur relevée (`retryCount` inchangé). Si l'écriture échoue, `cloreIssueInconnue`
        // reporte (DelayedError) : `issueConnue` reste faux, le verrou reste la trace.
        captureWorkerError("email", "emails", ctx.job as Job, e);
        await cloreIssueInconnue(a, replyId, ctx.job, ctx, jeton, (v) => v === jeton);
        issueConnue = true;
        return;
      }
      issueConnue = true; // le relais n'a pas pris le message : rien n'est parti
      const msg = sansAdresse(e instanceof Error ? e.message : String(e));
      // Garantie 3 : `failed` seulement au dernier essai ; avant, `pending` (D5) : plus de
      // « Réessayer » pendant les essais automatiques.
      const dernier = ctx.essai >= ctx.essaisMax;
      try {
        await a.ecrireSiNiEnvoyeNiIssueInconnue(
          ligne.id,
          dernier
            ? {
                deliveryStatus: "failed",
                failedAt: new Date(),
                errorMsg: msg.slice(0, 2000),
                retryCount: { increment: 1 },
              }
            : {
                deliveryStatus: "pending",
                errorMsg:
                  `Essai ${ctx.essai}/${ctx.essaisMax} échoué, nouvel essai automatique : ${msg}`.slice(
                    0,
                    2000,
                  ),
                retryCount: { increment: 1 },
              },
        );
      } catch (ecriture) {
        captureWorkerError("email", "emails", ctx.job as Job, ecriture);
      }
      throw e; // BullMQ réessaie avec un délai exponentiel
    }

    // Garantie 4 : marqueur « l'e-mail est parti » AVANT l'écriture en base (3 essais, jamais levé).
    for (let i = 0; i < ESSAIS_ECRITURE_ENVOYE; i++) {
      try {
        await redis.set(cleMarqueur(a.gabarit, replyId), messageId, "EX", TTL_MARQUEUR_ENVOYE_SEC);
        break;
      } catch (err) {
        if (i === ESSAIS_ECRITURE_ENVOYE - 1) {
          captureWorkerError("email", "emails", ctx.job as Job, err);
        }
      }
    }
    const echec = await ecrireEnvoyeRetente(a, ligne, messageId, new Date());
    if (echec !== null) {
      // L'e-mail est parti, la base ne le dit pas : verrou GARDÉ, report sans essai consommé.
      captureWorkerError("email", "emails", ctx.job as Job, echec);
      await reporter(ctx, delaiReportCroissant(ctx, REPORT_ECRITURE_MS));
    }
    issueConnue = true;
  } finally {
    // Sortie sans envoi tenté (contrôle, erreur de lecture) = issue connue.
    if (issueConnue || !envoiTente) await libererVerrou(cle, jeton);
  }
}

/**
 * Échec FINAL d'un job de réponse (plus aucun essai, ou job tué deux fois : le processeur n'est
 * PAS rappelé). On n'agit que sur une ligne `pending` : un `failed` portant le vrai message SMTP
 * n'est jamais écrasé. Verrou ou marqueur présent → issue inconnue (le verrou n'est supprimé que
 * s'il porte le jeton de CE job ET qu'il est vieux) ; sinon rien n'est parti.
 */
async function cloreEchecFinal(job: {
  id?: string | undefined;
  data: { template: string; payload: Record<string, unknown> };
  moveToDelayed(timestamp: number, token?: string): Promise<void>;
}): Promise<void> {
  const replyId = job.data.payload["replyId"];
  if (typeof replyId !== "string") return;
  const a: AdaptateurReponse<LigneSubmissionReply> | AdaptateurReponse<LigneCandidature> | null =
    job.data.template === "submission-reply"
      ? adaptateurSubmissionReply()
      : job.data.template === "candidature-reponse"
        ? adaptateurCandidature()
        : null;
  if (!a) return;
  const ar = a as AdaptateurReponse<LigneReponse>;
  const ligne = await ar.lire(replyId);
  if (!ligne || ligne.deliveryStatus !== "pending") return;
  if (ligne.sentAt !== null || ligne.providerMessageId !== null) return;

  let marqueur: string | null;
  let valeur: string | null;
  let pttl: number;
  try {
    marqueur = await redis.get(cleMarqueur(ar.gabarit, replyId));
    valeur = await redis.get(cleVerrou(ar.gabarit, replyId));
    pttl = valeur === null ? -2 : await redis.pttl(cleVerrou(ar.gabarit, replyId));
  } catch (e) {
    captureWorkerError("email", "emails", job as Job, e);
    await ar.ecrireSiNonEnvoye(ligne.id, {
      deliveryStatus: "failed",
      failedAt: new Date(),
      errorMsg: MOTIF_ISSUE_INCONNUE,
    });
    return;
  }
  if (marqueur !== null || valeur !== null) {
    const age = pttl === -1 ? Number.POSITIVE_INFINITY : TTL_VERROU_ENVOI_SEC * 1000 - pttl;
    await cloreIssueInconnue(
      ar,
      replyId,
      job,
      undefined,
      valeur,
      (v) => v.startsWith(`${job.id ?? "sans-id"}-`) && age >= SEUIL_ORPHELIN_MS,
    );
    return;
  }
  await ar.ecrireSiEncorePendingSansIssueInconnue(ligne.id, {
    deliveryStatus: "failed",
    failedAt: new Date(),
    errorMsg: MOTIF_ECHEC_SANS_ENVOI,
  });
}

// submission-reply : le payload ne contient PAS le HTML — il référence le
// `SubmissionReply.id`. On envoie le bodyHtml/bodyText figé en base, puis on
// synchronise `deliveryStatus` + `sentAt` + `Submission.firstRepliedAt/lastRepliedAt`.
const lireSubmissionReply = (id: string) =>
  prisma.submissionReply.findUnique({
    where: { id },
    include: { submission: { select: { id: true, firstRepliedAt: true } } },
  });
type LigneSubmissionReply = NonNullable<Awaited<ReturnType<typeof lireSubmissionReply>>>;

function adaptateurSubmissionReply(): AdaptateurReponse<LigneSubmissionReply> {
  return {
    gabarit: "submission-reply" as const,
    lire: lireSubmissionReply,
    ecrireSiNonEnvoye: (id: string, data: Record<string, unknown>) =>
      prisma.submissionReply.updateMany({ where: { id, sentAt: null }, data }),
    ecrireSiNiEnvoyeNiIssueInconnue: (id: string, data: Record<string, unknown>) =>
      prisma.submissionReply.updateMany({
        where: {
          id,
          sentAt: null,
          OR: [{ errorMsg: null }, { NOT: { errorMsg: { startsWith: PREFIXE_ISSUE_INCONNUE } } }],
        },
        data,
      }),
    ecrireSiEncorePendingSansIssueInconnue: (id: string, data: Record<string, unknown>) =>
      prisma.submissionReply.updateMany({
        where: {
          id,
          sentAt: null,
          deliveryStatus: "pending",
          OR: [{ errorMsg: null }, { NOT: { errorMsg: { startsWith: PREFIXE_ISSUE_INCONNUE } } }],
        },
        data,
      }),
    reparerEnvoye: (id: string) =>
      prisma.submissionReply.updateMany({
        where: { id, deliveryStatus: { in: ["pending", "failed"] }, sentAt: { not: null } },
        data: { deliveryStatus: "sent" },
      }),
    // `failedAt`/`errorMsg` remis à null : un `sent` tardif efface un « issue inconnue ».
    marquerEnvoye: (ligne, messageId, now) =>
      prisma.$transaction([
        prisma.submissionReply.updateMany({
          where: { id: ligne.id },
          data: {
            deliveryStatus: "sent",
            sentAt: now,
            providerMessageId: messageId,
            failedAt: null,
            errorMsg: null,
          },
        }),
        prisma.submission.update({
          where: { id: ligne.submissionId },
          data: {
            firstRepliedAt: ligne.submission.firstRepliedAt ?? now,
            lastRepliedAt: now,
          },
        }),
      ]),
  };
}

async function handleSubmissionReply(
  payload: Record<string, unknown>,
  ctx: ContexteEssai,
): Promise<void> {
  await envoyerReponseUnSeulEnvoi(payload, ctx, adaptateurSubmissionReply());
}

// candidature-reponse : jumeau de `handleSubmissionReply`, sur `JobApplicationReply`.
// 🔑 N'écrit RIEN au journal de la candidature : la trace « réponse envoyée » est
// posée par l'action, dans la même transaction que la réponse ; le journal dit ce
// qu'un humain a FAIT, l'état de livraison ce que la chaîne d'envoi en a fait.
const lireCandidature = (id: string) => prisma.jobApplicationReply.findUnique({ where: { id } });
type LigneCandidature = NonNullable<Awaited<ReturnType<typeof lireCandidature>>>;

function adaptateurCandidature(): AdaptateurReponse<LigneCandidature> {
  return {
    gabarit: "candidature-reponse" as const,
    lire: lireCandidature,
    ecrireSiNonEnvoye: (id: string, data: Record<string, unknown>) =>
      prisma.jobApplicationReply.updateMany({ where: { id, sentAt: null }, data }),
    ecrireSiNiEnvoyeNiIssueInconnue: (id: string, data: Record<string, unknown>) =>
      prisma.jobApplicationReply.updateMany({
        where: {
          id,
          sentAt: null,
          OR: [{ errorMsg: null }, { NOT: { errorMsg: { startsWith: PREFIXE_ISSUE_INCONNUE } } }],
        },
        data,
      }),
    ecrireSiEncorePendingSansIssueInconnue: (id: string, data: Record<string, unknown>) =>
      prisma.jobApplicationReply.updateMany({
        where: {
          id,
          sentAt: null,
          deliveryStatus: "pending",
          OR: [{ errorMsg: null }, { NOT: { errorMsg: { startsWith: PREFIXE_ISSUE_INCONNUE } } }],
        },
        data,
      }),
    reparerEnvoye: (id: string) =>
      prisma.jobApplicationReply.updateMany({
        where: { id, deliveryStatus: { in: ["pending", "failed"] }, sentAt: { not: null } },
        data: { deliveryStatus: "sent" },
      }),
    marquerEnvoye: (ligne, messageId, now) =>
      prisma.jobApplicationReply.updateMany({
        where: { id: ligne.id },
        data: {
          deliveryStatus: "sent",
          sentAt: now,
          providerMessageId: messageId,
          failedAt: null,
          errorMsg: null,
        },
      }),
  };
}

async function handleCandidatureReponse(
  payload: Record<string, unknown>,
  ctx: ContexteEssai,
): Promise<void> {
  await envoyerReponseUnSeulEnvoi(payload, ctx, adaptateurCandidature());
}
