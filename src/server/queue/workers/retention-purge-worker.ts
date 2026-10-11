// Worker BullMQ — purge quotidienne (Sprint 24 / D3 + audit B5 2026-05-15).
//
// Cron 03:00 UTC.
//
// 🛑 DÉCISION DE WILL, 2026-10-07 : « coupe tous les effacements ». Ce worker
// ne supprime PLUS AUCUNE donnée concernant une personne ou un échange — à UNE
// exception près, décidée par lui le 2026-10-11 : les CANDIDATURES AUX OFFRES
// D'EMPLOI (`jobApplication`, avec CV, photo et vidéos), effacées 24 mois
// après le dernier échange. Voir le bloc 6 du handler.
//
// Pour le reste, il ne garde que des purges purement TECHNIQUES, où ne figure
// ni personne ni échange :
//
//   - generation_logs   : journaux techniques de la génération de contenus
//                         (prompts éditoriaux, job_id) — 12 mois ;
//   - web_vital_samples : mesures de performance du site (sessionId anonyme)
//                         — 6 mois ;
//   - funnel_events     : mesure d'audience des tunnels, collectée sans
//                         bannière sous l'exemption CNIL, qui EXIGE une
//                         rétention bornée — 12 mois ;
//   - chat_semantic_cache, chat_action_idempotency : cache et clés
//                         d'idempotence du chatbot — 12 mois ;
//   - crm_sync_outbox   : lignes déjà acquittées (`sent`) par le CRM — 30 jours.
//                         La donnée, elle, vit dans le CRM.
//
// Variables env (purges restantes) :
//   RETENTION_GENERATION_LOGS_MONTHS=12
//   RETENTION_WEB_VITALS_MONTHS=6
//   RETENTION_FUNNEL_EVENTS_MONTHS=12
//   RETENTION_CHAT_MONTHS=12              (cache sémantique et idempotence SEULEMENT)
//   RETENTION_CRM_OUTBOX_SENT_DAYS=30
//
// La durée des candidatures (24 mois) n'est PAS une variable d'environnement :
// elle est écrite dans la notice et sous le formulaire, et une variable
// permettrait de les faire mentir sans toucher au code.
//
// Ce qui n'est PLUS supprimé automatiquement (code retiré, pas un drapeau) :
// fiches et dossiers (`submissions`, apporteurs compris), journal d'activité
// (`activity_logs`, traces RGPD comprises), rendez-vous Calendly, lettre
// d'information et guide (désinscrits, inscriptions non confirmées, abonnés
// inactifs, rebonds, demandes du guide, preuves), conversations et escalades
// du chatbot, journal, copies et corbeille des e-mails, journal d'accès de la
// prospection, brouillons de vente, registre des coûts, journaux de la banque
// d'images, et le dossier client des visios (segments, versions, faits
// rejetés, dossiers échus, preuves d'accord). Voir le bloc dédié du handler.
//
// L'effacement reste possible, mais comme un GESTE : console, droit à
// l'effacement (`api/gdpr-erase`), suppression anticipée d'une candidature.
// Rien de cela ne vit ici, et rien de cela n'est touché.
//
// Sécurité : aucune action si valeur < 1 (anti-misconfig accidentel).

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { purgerOutboxCrm } from "@/server/newsletter/retention";
import { deleteCv } from "@/server/careers/cv-storage";
import { supprimerVideosCandidature } from "@/server/careers/videos-candidat";
import type { RetentionPurgeJobData } from "../types";

const DEFAULTS = {
  generationLogs: 12,
  webVitals: 6,
  chat: 12,
  funnelEvents: 12,
} as const;

/**
 * Durée de conservation d'une candidature à une offre d'emploi, comptée depuis
 * le DERNIER ÉCHANGE. Décision de Will du 2026-10-11 (recommandation CNIL :
 * deux ans après le dernier contact). Annoncée telle quelle par la notice
 * (`legal.ts`, « Conservation des candidatures ») et sous le formulaire.
 */
export const CANDIDATURES_MOIS = 24;

/** Plafond d'effacements par passe : une passe quotidienne n'a pas à tout vider d'un coup. */
export const CANDIDATURES_PAR_PASSE = 200;

/**
 * Les candidatures dont le DERNIER ÉCHANGE est antérieur à `limite`.
 *
 * 🔑 « Dernier échange », pas « date de dépôt » : une candidature de 2024 à
 * laquelle on a répondu le mois dernier repart pour deux ans. Chaque signal
 * d'échange est donc exigé ANCIEN — le dépôt, le journal (`lastActivityAt`),
 * nos réponses, les réponses reçues du candidat, les entretiens.
 *
 * 🛑 `hired` est exclu (décision `D4` du 2026-09-03) : le dossier d'une
 * personne recrutée est une pièce de son dossier du personnel.
 */
export function candidaturesEchuesWhere(limite: Date) {
  return {
    status: { notIn: ["hired" as const] },
    submittedAt: { lt: limite },
    OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: limite } }],
    replies: { none: { repliedAt: { gte: limite } } },
    reponsesRecues: { none: { receivedAt: { gte: limite } } },
    interviews: { none: { scheduledAt: { gte: limite } } },
  };
}

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

function readMonths(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

/**
 * Traitement d'une passe de purge — EXPORTÉ pour être testable.
 *
 * 🔴 2026-08-20. La fonction vivait en littéral inline dans `new Worker(...)`,
 * donc hors de portée de toute suite. Elle est extraite pour qu'une garde
 * puisse rejouer ce qu'elle demande à la base — c'est ce que font
 * `aucun-effacement-automatique-de-personnes.spec.ts` et
 * `les-candidatures-ne-sont-jamais-purgees.spec.ts`.
 */
export async function executerPurgeRetention(): Promise<void> {
  const counts = {
    generationLogs: 0,
    webVitals: 0,
    chatSemanticCache: 0,
    chatIdempotency: 0,
    funnelEvents: 0,
    crmOutbox: 0,
    candidatures: 0,
    candidaturesRecruteesEpargnees: 0,
  };

  // ── 🛑 AUCUN EFFACEMENT AUTOMATIQUE DE DONNÉES DE PERSONNES. DÉCISION DE WILL. ──
  // (Seule exception : les candidatures aux offres d'emploi, bloc 6 — décision
  // de Will du 2026-10-11.)
  //
  // **Ordres explicites de Will** : 2026-10-07 « non je ne veux surtout pas
  // d'effacement », puis « coupe tous les effacements » ; ils prolongent ceux
  // du 29/09 (« strictement interdit de purger quoi que ce soit et de perdre
  // des contacts ») et du 03/10 (« je veux tout qu'on garde et surtout pas
  // qu'on efface quoi que ce soit »), et la décision prospection du 2026-08-20.
  //
  // Les blocs qui vivaient ici ont été RETIRÉS — pas désactivés par un drapeau,
  // retirés : `submission` archivées,
  // `activityLog` (traces RGPD comprises), `calendlyEvent` (et le gel des
  // rencontres qui le précédait), lettre et guide (`purgerDesinscrits`,
  // `purgerLettreEtGuide`), `chatConversation`, `chatEscalation`, `emailLog`,
  // `emailLogContent`, `emailOutbox`, `prospectionAccessLog`, `venteBrouillon`,
  // `costLedger`, `imageUsageLog`, `imageDownloadLog`, et la purge du dossier
  // client des visios (`executerPurgeVisio` : segments, versions de comptes
  // rendus, faits rejetés, dossiers échus, preuves d'accord).
  //
  // Les fonctions de `newsletter/retention.ts`, `lib/rgpd-erase.ts` et
  // `visio/` qui faisaient ces purges ne sont pas supprimées : seul leur APPEL
  // planifié l'est. Elles ne sont plus appelées par aucune tâche.
  //
  // Prospection (fiches entreprises, personnes, praticiens) : AUCUNE
  // suppression automatique depuis le 2026-08-20 — garde
  // `prospection-aucune-purge-automatique.spec.ts`.
  //
  // ⚠️ Gardes : `aucun-effacement-automatique-de-personnes.spec.ts` et
  // `les-candidatures-ne-sont-jamais-purgees.spec.ts` échouent si l'une de ces
  // suppressions réapparaît dans ce worker. Ne pas « réparer » la rétention ici
  // sans un nouvel arbitrage explicite de Will. Le second garde aussi que le
  // bloc 6 reste borné aux candidatures, à 24 mois, hors personnes recrutées.

  // 1) crm_sync_outbox — lignes `sent` (acquittées par le CRM) à 30 jours ;
  // jamais `pending`, `failed` ni `gave_up`. La donnée vit dans le CRM : la
  // ligne n'est qu'une file d'envoi déjà vidée.
  try {
    counts.crmOutbox = await purgerOutboxCrm();
  } catch (err) {
    console.error("[retention-purge][crm-outbox] étape en échec, reprise demain.");
    captureWorkerError("retention-purge", "retention-purge", undefined, err);
  }

  // 2) generation_logs anciens (content-gen audit trail technique, audit B5 P0-7).
  // GenerationLog.timestamp = createdAt — pas de updatedAt (table append-only).
  const genLogsMonths = readMonths("RETENTION_GENERATION_LOGS_MONTHS", DEFAULTS.generationLogs);
  const genLogsResult = await prisma.generationLog.deleteMany({
    where: { timestamp: { lt: monthsAgo(genLogsMonths) } },
  });
  counts.generationLogs = genLogsResult.count;

  // 3) web_vital_samples anciens (RUM, audit B5 P0-7). sessionId généré client
  // (anonyme) — mesure de performance du site, aucune personne.
  const webVitalsMonths = readMonths("RETENTION_WEB_VITALS_MONTHS", DEFAULTS.webVitals);
  const webVitalsResult = await prisma.webVitalSample.deleteMany({
    where: { createdAt: { lt: monthsAgo(webVitalsMonths) } },
  });
  counts.webVitals = webVitalsResult.count;

  // 4) funnel_events (tunnels d'acquisition, 2026-08-12).
  // 🔴 Cette purge n'est PAS optionnelle. La table est collectée sans
  // bannière de consentement, sous l'exemption CNIL « mesure d'audience »,
  // et cette exemption exige une rétention bornée. La désactiver ne
  // produirait aucune erreur visible — seulement une collecte devenue
  // illégale. 12 mois : sous le plafond de 13 mois de la CNIL, et assez
  // long pour comparer une saison publicitaire à la précédente.
  const funnelMonths = readMonths("RETENTION_FUNNEL_EVENTS_MONTHS", DEFAULTS.funnelEvents);
  const funnelResult = await prisma.funnelEvent.deleteMany({
    where: { createdAt: { lt: monthsAgo(funnelMonths) } },
  });
  counts.funnelEvents = funnelResult.count;

  // 5) chatbot — cache sémantique et clés d'idempotence SEULEMENT (ménage
  // technique). Les conversations, messages et escalades ne sont plus purgés.
  const chatMonths = readMonths("RETENTION_CHAT_MONTHS", DEFAULTS.chat);
  const chatCacheResult = await prisma.chatSemanticCache.deleteMany({
    where: { createdAt: { lt: monthsAgo(chatMonths) } },
  });
  counts.chatSemanticCache = chatCacheResult.count;
  const chatIdemResult = await prisma.chatActionIdempotency.deleteMany({
    where: { createdAt: { lt: monthsAgo(chatMonths) } },
  });
  counts.chatIdempotency = chatIdemResult.count;

  // 6) CANDIDATURES AUX OFFRES D'EMPLOI — 24 mois après le dernier échange.
  //
  // **Décision de Will, 2026-10-11** : « on garde les CV et données 2 ans »,
  // puis effacement automatique. C'est le nouvel arbitrage explicite que
  // demandait la décision du 2026-10-07, et il ne porte QUE sur
  // `jobApplication`. Les apporteurs (`submission`), contacts, prospects et
  // rendez-vous restent sans effacement automatique.
  //
  // La suppression de la ligne emporte en cascade son journal, ses réponses,
  // ses entretiens, ses liens et ses vidéos en base ; les rendez-vous d'agenda
  // survivent (lien `SetNull`).
  try {
    const limite = monthsAgo(CANDIDATURES_MOIS);
    const echues = await prisma.jobApplication.findMany({
      where: candidaturesEchuesWhere(limite),
      select: { id: true, cvStoragePath: true, photoStoragePath: true },
      orderBy: { submittedAt: "asc" },
      take: CANDIDATURES_PAR_PASSE,
    });

    // OBSERVATION, jamais une purge : un `count`, donc aucune ligne rendue.
    counts.candidaturesRecruteesEpargnees = await prisma.jobApplication.count({
      where: { status: "hired", submittedAt: { lt: limite } },
    });

    for (const c of echues) {
      // Fichiers d'abord : si la suppression disque échoue, la ligne reste et
      // la passe de demain réessaie. L'inverse perdrait le chemin du fichier
      // et le rendrait introuvable — donc ineffaçable.
      try {
        await deleteCv(c.cvStoragePath);
        await deleteCv(c.photoStoragePath);
        await supprimerVideosCandidature(c.id);
      } catch (err) {
        console.error(`[retention-purge][candidatures] fichiers de ${c.id} : reprise demain.`);
        captureWorkerError("retention-purge", "retention-purge", undefined, err);
        continue;
      }
      await prisma.jobApplication.delete({ where: { id: c.id } });
      counts.candidatures += 1;
    }
  } catch (err) {
    console.error("[retention-purge][candidatures] étape en échec, reprise demain.");
    captureWorkerError("retention-purge", "retention-purge", undefined, err);
  }

  console.log(
    `[retention-purge] generationLogs=${counts.generationLogs} ` +
      `webVitals=${counts.webVitals} funnelEvents=${counts.funnelEvents} ` +
      `chatSemanticCache=${counts.chatSemanticCache} chatIdempotency=${counts.chatIdempotency} ` +
      `crmOutbox=${counts.crmOutbox} ` +
      `candidatures=${counts.candidatures} ` +
      `candidaturesRecruteesEpargnees=${counts.candidaturesRecruteesEpargnees} ` +
      `autresDonneesDePersonnes=CONSERVÉES (décision Will 2026-10-07)`,
  );
}

export function startRetentionPurgeWorker(): Worker<RetentionPurgeJobData> {
  const worker = new Worker<RetentionPurgeJobData>("retention-purge", executerPurgeRetention, {
    connection: getBullConnectionOrThrow(),
    concurrency: 1,
    lockDuration: 120_000,
    // P2-23 audit indexation 2026-05-18 — bornage retention Redis :
    // garde 1000 jobs completed + 5000 jobs failed max (BullMQ purge auto).
    // Évite saturation Redis long-terme sur high-volume workers.
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });

  worker.on("ready", () => console.log("[retention-purge-worker] ready"));
  worker.on("failed", (job, err) => {
    console.error(`[retention-purge-worker] failed: ${err.message}`);
    captureWorkerError("retention-purge", "retention-purge", job, err);
  });

  return worker;
}
