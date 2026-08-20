// Worker BullMQ — purge RGPD quotidienne (Sprint 24 / D3 + audit B5 2026-05-15).
//
// Cron 03:00 UTC. Pour chaque table cible :
//   - activity_logs : suppression hard si created_at > N mois (default 12).
//   - submissions   : suppression hard si status='archived' ET updated_at > N mois (default 24).
//   - newsletter_subscribers : suppression hard si status='unsubscribed' ET unsubscribed_at > N mois (default 36).
//                              On ne conserve que email_hash dans activity_log
//                              (handle propre RGPD art. 17 droit à l'oubli +
//                              audit trail nominatif).
//   - bookings      : suppression hard si status='cancelled' ET updated_at > N mois (default 12).
//   - generation_logs (audit B5 P0-7) : logs techniques content-gen — purge à N mois
//                              (default 12). Ces logs sont append-only et lient les
//                              prompts content-gen à un job_id non-PII. Pas d'export
//                              RGPD utilisateur (cf. politique-confidentialite §
//                              IA générative — logs techniques exclus art. 23 RGPD).
//   - cost_ledger (audit B5 P0-7) : ledger atomique provider IA — purge à N mois
//                              (default 24, alignée obligation comptable française).
//                              Aucun PII (provider key + montant USD seulement).
//   - web_vital_samples (audit B5 P0-7) : RUM agrégé Web Vitals — purge à N mois
//                              (default 6). Pas de PII (sessionId anonyme client).
//
// Variables env :
//   RETENTION_LOGS_MONTHS=12
//   RETENTION_SUBS_ARCHIVE_MONTHS=24
//   RETENTION_NEWSLETTER_UNSUB_MONTHS=36
//   RETENTION_BOOKINGS_CANCELLED_MONTHS=12
//   RETENTION_GENERATION_LOGS_MONTHS=12   (audit B5)
//   RETENTION_COST_LEDGER_MONTHS=24       (audit B5 — obligation comptable française)
//   RETENTION_WEB_VITALS_MONTHS=6         (audit B5)
//   RETENTION_EMAIL_LOGS_MONTHS=36        (audit e-mail 2026-08-16 — cycle Qualiopi)
//   RETENTION_EMAIL_LOGS_MARKETING_MONTHS=13 (audit e-mail — norme CNIL prospection)
//   RETENTION_EMAIL_OUTBOX_MONTHS=36      (audit e-mail — etats terminaux seuls)
//   RETENTION_CHAT_MONTHS=12              (chatbot — conversations/messages/escalades + cache/idempotence)
//
// Sécurité : aucune action si valeur < 1 (anti-misconfig accidentel).

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { deleteCv } from "@/server/careers/cv-storage";
import { creerOuDedup } from "@/server/qualiopi/alertes/alertes-service";
import type { RetentionPurgeJobData } from "../types";

const DEFAULTS = {
  logs: 12,
  submissionsArchived: 24,
  newsletterUnsub: 36,
  bookingsCancelled: 12,
  generationLogs: 12,
  costLedger: 24,
  webVitals: 6,
  imageLogs: 12,
  chat: 12,
  funnelEvents: 12,
  candidatures: 24,
  // Chaine d'envoi (audit 2026-08-16). 36 mois = cycle de certification
  // Qualiopi ; 13 mois = norme CNIL de prospection. Voir le bloc commente
  // dans le handler pour le raisonnement.
  emailLogsTransac: 36,
  emailLogsMarketing: 13,
  emailOutbox: 36,
} as const;

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

async function hashEmail(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.toLowerCase().trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Traitement d'une passe de purge — EXPORTÉ pour être testable.
 *
 * 🔴 2026-08-20. Ce worker supprime dans **vingt et une** tables de production
 * et n'était couvert par **aucun test** : la fonction vivait en littéral inline
 * dans `new Worker(...)`, donc hors de portée de toute suite. Un effacement de
 * masse dont personne ne peut rejouer la logique est la dernière chose qu'on
 * devrait laisser sans garde.
 *
 * L'extraction ne change RIEN au comportement : c'est le même corps, appelé au
 * même endroit.
 */
export async function executerPurgeRetention(): Promise<void> {
  const counts = {
    logs: 0,
    submissions: 0,
    newsletter: 0,
    bookings: 0,
    generationLogs: 0,
    costLedger: 0,
    webVitals: 0,
    imageUsageLogs: 0,
    imageDownloadLogs: 0,
    chatConversations: 0,
    chatEscalations: 0,
    chatSemanticCache: 0,
    chatIdempotency: 0,
    funnelEvents: 0,
    candidatures: 0,
    candidaturesFichiers: 0,
    emailLogs: 0,
    emailOutbox: 0,
  };

  // 1) activity_logs ancients
  const logsMonths = readMonths("RETENTION_LOGS_MONTHS", DEFAULTS.logs);
  const logsResult = await prisma.activityLog.deleteMany({
    where: { createdAt: { lt: monthsAgo(logsMonths) } },
  });
  counts.logs = logsResult.count;

  // 2) submissions archivées anciennes
  const subsMonths = readMonths("RETENTION_SUBS_ARCHIVE_MONTHS", DEFAULTS.submissionsArchived);
  const archivedSubs = await prisma.submission.findMany({
    where: { status: "archived", updatedAt: { lt: monthsAgo(subsMonths) } },
    select: { id: true, contactEmail: true, type: true },
  });
  for (const s of archivedSubs) {
    await prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: { submissionId: s.id },
        data: { submissionId: null },
      });
      await tx.submission.delete({ where: { id: s.id } });
      await tx.activityLog.create({
        data: {
          adminUserId: null,
          action: "submission.purged",
          targetType: "submission",
          targetId: s.id,
          changes: {
            emailHash: await hashEmail(s.contactEmail),
            type: s.type,
            policy: "retention",
            ageMonths: subsMonths,
          },
        },
      });
    });
    counts.submissions++;
  }

  // 3) newsletter_subscribers unsubscribed anciens
  const newsMonths = readMonths("RETENTION_NEWSLETTER_UNSUB_MONTHS", DEFAULTS.newsletterUnsub);
  const oldUnsub = await prisma.newsletterSubscriber.findMany({
    where: {
      status: "unsubscribed",
      unsubscribedAt: { lt: monthsAgo(newsMonths) },
    },
    select: { id: true, email: true },
  });
  for (const sub of oldUnsub) {
    await prisma.$transaction(async (tx) => {
      await tx.newsletterSubscriber.delete({ where: { id: sub.id } });
      await tx.activityLog.create({
        data: {
          adminUserId: null,
          action: "newsletter.purged",
          targetType: "newsletter_subscriber",
          targetId: sub.id,
          changes: {
            emailHash: await hashEmail(sub.email),
            policy: "retention",
            ageMonths: newsMonths,
          },
        },
      });
    });
    counts.newsletter++;
  }

  // 4) bookings cancelled anciens
  const bookingsMonths = readMonths(
    "RETENTION_BOOKINGS_CANCELLED_MONTHS",
    DEFAULTS.bookingsCancelled,
  );
  const cancelledBookings = await prisma.booking.deleteMany({
    where: { status: "cancelled", updatedAt: { lt: monthsAgo(bookingsMonths) } },
  });
  counts.bookings = cancelledBookings.count;

  // 5) generation_logs anciens (content-gen audit trail technique, audit B5 P0-7).
  // GenerationLog.timestamp = createdAt — pas de updatedAt (table append-only).
  const genLogsMonths = readMonths("RETENTION_GENERATION_LOGS_MONTHS", DEFAULTS.generationLogs);
  const genLogsResult = await prisma.generationLog.deleteMany({
    where: { timestamp: { lt: monthsAgo(genLogsMonths) } },
  });
  counts.generationLogs = genLogsResult.count;

  // 6) cost_ledger ancien (atomique provider IA, audit B5 P0-7).
  // Aucune PII, juste provider + model + tokens + costUsd. 24 mois alignés
  // obligation comptable française (la table comptable principale reste
  // les invoices Stripe — ce ledger est observabilité interne).
  const costLedgerMonths = readMonths("RETENTION_COST_LEDGER_MONTHS", DEFAULTS.costLedger);
  const costLedgerResult = await prisma.costLedger.deleteMany({
    where: { timestamp: { lt: monthsAgo(costLedgerMonths) } },
  });
  counts.costLedger = costLedgerResult.count;

  // 7) web_vital_samples anciens (RUM, audit B5 P0-7).
  // sessionId est généré client (anonyme). userAgent peut être quasi-identifiant
  // → purge agressive 6 mois par défaut (alignée pratique RUM industrielle).
  const webVitalsMonths = readMonths("RETENTION_WEB_VITALS_MONTHS", DEFAULTS.webVitals);
  const webVitalsResult = await prisma.webVitalSample.deleteMany({
    where: { createdAt: { lt: monthsAgo(webVitalsMonths) } },
  });
  counts.webVitals = webVitalsResult.count;

  // 7 bis) funnel_events (tunnels d'acquisition, 2026-08-12).
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

  // 7 ter) job_applications (candidatures, 2026-08-13).
  // 🔴 SEULE table à données personnelles qui n'avait AUCUNE purge, alors
  // qu'elle en porte le plus : nom, e-mail, téléphone, ville, CV et photo.
  // Les fichiers vivent hors base (volume disque) : supprimer la ligne sans
  // eux laisserait les CV et les photos sur le disque indéfiniment — le
  // pire des deux mondes, une base propre et un disque qui ne l'est pas.
  // 24 mois : recommandation CNIL pour un candidat non retenu.
  const candidaturesMois = readMonths("RETENTION_CANDIDATURES_MONTHS", DEFAULTS.candidatures);
  const candidaturesPerimees = await prisma.jobApplication.findMany({
    where: { submittedAt: { lt: monthsAgo(candidaturesMois) } },
    select: { id: true, cvStoragePath: true, photoStoragePath: true },
  });

  for (const c of candidaturesPerimees) {
    // Fichiers d'abord : si la suppression disque échoue, la ligne reste et
    // la purge repassera demain. L'inverse perdrait le chemin du fichier et
    // le rendrait introuvable — donc ineffaçable.
    try {
      await deleteCv(c.cvStoragePath);
      await deleteCv(c.photoStoragePath);
      if (c.cvStoragePath) counts.candidaturesFichiers += 1;
      if (c.photoStoragePath) counts.candidaturesFichiers += 1;
    } catch (err) {
      console.error(`[retention-purge] fichiers de la candidature ${c.id} :`, err);
      continue;
    }
    await prisma.jobApplication.delete({ where: { id: c.id } });
    counts.candidatures += 1;
  }

  // 8) image_usage_logs + image_download_logs (image-bank Sprint 7 V1).
  // ip_hash SHA-256 + IP_HASH_SALT — non réversible mais quasi-identifiant
  // longue durée. Purge 12 mois par défaut (RGPD art. 5.1.e minimisation).
  const imageLogsMonths = readMonths("RETENTION_IMAGE_LOGS_MONTHS", DEFAULTS.imageLogs);
  const imageUsageResult = await prisma.imageUsageLog.deleteMany({
    where: { createdAt: { lt: monthsAgo(imageLogsMonths) } },
  });
  const imageDownloadResult = await prisma.imageDownloadLog.deleteMany({
    where: { downloadedAt: { lt: monthsAgo(imageLogsMonths) } },
  });
  counts.imageUsageLogs = imageUsageResult.count;
  counts.imageDownloadLogs = imageDownloadResult.count;

  // 9) chat_* anciens (RGPD — chatbot). Le contenu (chat_messages.contenu,
  // chat_conversations.{prospect_profile, resume, ip_hash}, chat_escalations.
  // contact_email) est de la PII. Les chat_messages partent en CASCADE avec
  // la conversation (FK ON DELETE CASCADE). Cache sémantique + clés
  // d'idempotence = housekeeping non-PII.
  const chatMonths = readMonths("RETENTION_CHAT_MONTHS", DEFAULTS.chat);
  const chatConvResult = await prisma.chatConversation.deleteMany({
    where: { updatedAt: { lt: monthsAgo(chatMonths) } },
  });
  counts.chatConversations = chatConvResult.count;
  const chatEscResult = await prisma.chatEscalation.deleteMany({
    where: { createdAt: { lt: monthsAgo(chatMonths) } },
  });
  counts.chatEscalations = chatEscResult.count;
  const chatCacheResult = await prisma.chatSemanticCache.deleteMany({
    where: { createdAt: { lt: monthsAgo(chatMonths) } },
  });
  counts.chatSemanticCache = chatCacheResult.count;
  const chatIdemResult = await prisma.chatActionIdempotency.deleteMany({
    where: { createdAt: { lt: monthsAgo(chatMonths) } },
  });
  counts.chatIdempotency = chatIdemResult.count;

  // Prospection & Base Entreprises — purge par `retentionUntil` (3 ans après
  // dernière action, entreprise ET personne) + journal d'accès ancien (RGPD).
  const now = new Date();
  const prospCompanies = await prisma.prospectionCompany.deleteMany({
    where: { retentionUntil: { not: null, lt: now } },
  });
  const prospPersons = await prisma.prospectionPerson.deleteMany({
    where: { retentionUntil: { not: null, lt: now } },
  });
  // Prospection Santé V2 — praticiens (données NOMINATIVES de pro de santé) :
  // même horizon de conservation, sinon rétention illimitée (art. 5.1.e).
  const prospPractitioners = await prisma.prospectionHealthPractitioner.deleteMany({
    where: { retentionUntil: { not: null, lt: now } },
  });
  const accessLogMonths = readMonths("RETENTION_PROSPECTION_ACCESS_MONTHS", 12);
  const prospAccess = await prisma.prospectionAccessLog.deleteMany({
    where: { createdAt: { lt: monthsAgo(accessLogMonths) } },
  });

  // Parcours vente — brouillons du wizard « Nouvelle vente » : le payload
  // contient des PII (contact saisi avant création du Client). Même pattern
  // `retentionUntil` que la prospection ci-dessus. Les brouillons convertis
  // sont supprimés dès la création de la SESSION (côté wizard) ; ici on
  // ramasse les abandonnés. Jamais de purge des pièces émises (Devis,
  // factures, DocumentGenere : obligation comptable).
  const venteBrouillons = await prisma.venteBrouillon.deleteMany({
    where: { retentionUntil: { not: null, lt: now } },
  });
  console.log(`[retention-purge][vente] brouillons=${venteBrouillons.count}`);
  console.log(
    `[retention-purge][prospection] companies=${prospCompanies.count} ` +
      `persons=${prospPersons.count} practitioners=${prospPractitioners.count} ` +
      `accessLogs=${prospAccess.count}`,
  );

  // ── 🔴 `D5-5-01` — LA PURGE CI-DESSUS NE SUPPRIME RIEN ─────────────
  //
  // Les trois `deleteMany` de prospection filtrent sur
  // `retentionUntil: { not: null }`. Or **aucune ligne de ce dépôt n'écrit
  // cette colonne** pour ces trois modèles : recherche exhaustive sur `src/`
  // le 2026-08-20, le SEUL code qui touche ces tables est le `deleteMany`
  // ci-dessus. Ni lecteur, ni écrivain — elles sont alimentées par Axion CRM
  // Pro, un dépôt séparé.
  //
  // Conséquence : le prédicat ne peut matcher aucune ligne, la purge
  // supprime zéro enregistrement, pour toujours. **Rétention illimitée de
  // données nominatives** (RGPD art. 5.1.e) sur les tables qui portent les
  // millions de fiches entreprises et personnes.
  //
  // 🔑 C'est la famille de défaut la plus coûteuse de cet audit : une
  // garde qui a l'air de garder. Le worker tourne, journalise
  // « companies=0 persons=0 », et ce zéro se lit comme « rien à purger »
  // alors qu'il signifie « la requête ne peut rien trouver ».
  //
  // ## Pourquoi on MESURE au lieu de supprimer
  //
  // Réparer, ici, consiste à faire supprimer des lignes à un `deleteMany`
  // qui n'en a jamais supprimé aucune, sur des millions d'enregistrements,
  // sans qu'aucun code de ce dépôt ne connaisse la distribution des dates.
  // Une erreur d'horizon efface l'actif principal du CRM, et c'est
  // irréversible. Supprimer des données de production est une décision
  // humaine, pas une conséquence d'audit.
  //
  // On rend donc le problème MESURABLE d'abord : aujourd'hui, personne ne
  // peut savoir combien de fiches sont sur-conservées. L'alerte porte le
  // nombre ; la suppression reste derrière un drapeau explicitement posé.
  //
  // ⚠️ Le comptage retient `retentionUntil: null` ET une inactivité
  // supérieure à l'horizon. Il ne double donc JAMAIS la purge nominale
  // ci-dessus, qui ne voit que les lignes où `retentionUntil` est renseigné.
  const moisProspection = readMonths("RETENTION_PROSPECTION_MONTHS", 36);
  const seuilProspection = monthsAgo(moisProspection);
  const sansHorizon = {
    retentionUntil: null,
    updatedAt: { lt: seuilProspection },
  } as const;

  const [compSans, persSans, pratSans] = await Promise.all([
    prisma.prospectionCompany.count({ where: sansHorizon }),
    prisma.prospectionPerson.count({ where: sansHorizon }),
    prisma.prospectionHealthPractitioner.count({ where: sansHorizon }),
  ]);
  const totalSansHorizon = compSans + persSans + pratSans;

  console.log(
    `[retention-purge][prospection] SANS retentionUntil et inactives depuis ` +
      `>${moisProspection} mois : companies=${compSans} persons=${persSans} ` +
      `practitioners=${pratSans}`,
  );

  if (totalSansHorizon > 0) {
    // Le message porte le NOMBRE : une alerte qui dirait seulement « des
    // fiches sont sur-conservées » n'aiderait pas à décider. Il dit aussi
    // le geste exact, parce que l'activation est une décision et qu'une
    // décision sans son geste se reporte indéfiniment.
    await creerOuDedup({
      code: "retention_prospection_sans_horizon",
      niveau: "important",
      titre: "Fiches de prospection sans horizon de conservation",
      message:
        `${totalSansHorizon} fiches (${compSans} entreprises, ${persSans} personnes, ` +
        `${pratSans} praticiens) n'ont AUCUN horizon de conservation et sont inactives ` +
        `depuis plus de ${moisProspection} mois. La purge automatique ne peut pas les ` +
        `voir : elle ne filtre que sur une colonne qu'aucun code n'écrit. ` +
        `Pour autoriser leur suppression : poser RETENTION_PROSPECTION_PURGE_ENABLED=true ` +
        `(scope RUN) après avoir vérifié ce nombre.`,
    }).catch(() => {});
  }

  // Suppression effective — DÉSACTIVÉE PAR DÉFAUT, et c'est le point.
  // Le drapeau n'est pas une précaution rituelle : il matérialise le fait
  // qu'un humain a lu le nombre ci-dessus avant d'autoriser l'effacement.
  let purgeSansHorizon = 0;
  if (process.env["RETENTION_PROSPECTION_PURGE_ENABLED"] === "true" && totalSansHorizon > 0) {
    // Les personnes et praticiens d'abord : ce sont les données NOMINATIVES,
    // et `onDelete: Cascade` depuis l'entreprise les emporterait de toute
    // façon — les compter séparément garde le journal lisible.
    const p = await prisma.prospectionPerson.deleteMany({ where: sansHorizon });
    const h = await prisma.prospectionHealthPractitioner.deleteMany({ where: sansHorizon });
    const c = await prisma.prospectionCompany.deleteMany({ where: sansHorizon });
    purgeSansHorizon = p.count + h.count + c.count;
    console.log(
      `[retention-purge][prospection] purge SANS horizon ACTIVÉE : ` +
        `persons=${p.count} practitioners=${h.count} companies=${c.count}`,
    );
  }
  void purgeSansHorizon;

  // ── Chaîne d'envoi d'e-mails (audit du 2026-08-16) ────────────────────
  //
  // `email_logs` et `email_outbox` n'étaient dans AUCUNE purge, alors que
  // ce worker en couvre vingt et une. Deux conséquences : une croissance
  // non bornée de la table la plus écrite de la chaîne, et un `recipient`
  // conservé en clair indéfiniment — alors que `SubmissionReply.toEmail`,
  // qui porte la même donnée, est chiffré au repos. `email_outbox` est
  // pire encore : son `payload` fige la charge utile complète, PII incluse.
  //
  // 🔴 DEUX DURÉES, ET L'ÉCART EST LE POINT ENTIER.
  //
  // Purger ce journal, c'est effacer la preuve qu'une convocation est
  // partie — les indicateurs Qualiopi 4, 9, 11, 30 et 32 en dépendent. Une
  // durée unique et courte détruirait la conformité ; une durée unique et
  // longue laisserait des adresses de prospects en clair bien au-delà de
  // ce que la CNIL admet. On sépare donc sur le seul axe qui compte :
  //
  //   - TRANSACTIONNEL (36 mois) — convocations, attestations, devis,
  //     factures. Aligné sur le cycle de certification Qualiopi de 3 ans :
  //     un audit de surveillance doit pouvoir remonter à l'origine du
  //     cycle en cours.
  //   - MARKETING (13 mois) — double opt-in newsletter. Aligné sur la
  //     norme CNIL de conservation des données de prospection.
  //
  // ⚠️ `readMonths` refuse toute valeur < 1 : une variable d'environnement
  // vidée par accident retombe sur la valeur par défaut au lieu de purger
  // tout le journal. C'est la garde anti-misconfig déjà en place au-dessus.
  const emailTransacMonths = readMonths("RETENTION_EMAIL_LOGS_MONTHS", DEFAULTS.emailLogsTransac);
  const emailMarketingMonths = readMonths(
    "RETENTION_EMAIL_LOGS_MARKETING_MONTHS",
    DEFAULTS.emailLogsMarketing,
  );
  const emailLogsTransac = await prisma.emailLog.deleteMany({
    where: { marketing: false, createdAt: { lt: monthsAgo(emailTransacMonths) } },
  });
  const emailLogsMarketing = await prisma.emailLog.deleteMany({
    where: { marketing: true, createdAt: { lt: monthsAgo(emailMarketingMonths) } },
  });
  counts.emailLogs = emailLogsTransac.count + emailLogsMarketing.count;

  // Corbeille de validation : on ne purge QUE les états terminaux.
  //
  // 🔴 `a_valider` et `approuve` sont volontairement exclus, et ce n'est
  // pas une précaution de confort : ce sont des e-mails qui attendent
  // encore un geste humain. Les purger sur l'âge ferait disparaître en
  // silence un message que quelqu'un doit approuver — le destinataire ne
  // recevrait jamais rien, et personne ne saurait pourquoi. Une entrée qui
  // moisit en `a_valider` est un problème d'exploitation à voir, pas un
  // déchet à ramasser.
  const outboxMonths = readMonths("RETENTION_EMAIL_OUTBOX_MONTHS", DEFAULTS.emailOutbox);
  const outboxPurge = await prisma.emailOutbox.deleteMany({
    where: {
      statut: { in: ["envoye", "refuse"] },
      createdAt: { lt: monthsAgo(outboxMonths) },
    },
  });
  counts.emailOutbox = outboxPurge.count;

  console.log(
    `[retention-purge][email] logs=${counts.emailLogs} ` +
      `(transac ${emailLogsTransac.count}/${emailTransacMonths}m + ` +
      `marketing ${emailLogsMarketing.count}/${emailMarketingMonths}m) ` +
      `outbox=${counts.emailOutbox}/${outboxMonths}m`,
  );

  console.log(
    `[retention-purge] logs=${counts.logs} submissions=${counts.submissions} ` +
      `newsletter=${counts.newsletter} bookings=${counts.bookings} ` +
      `generationLogs=${counts.generationLogs} costLedger=${counts.costLedger} ` +
      `webVitals=${counts.webVitals} ` +
      `imageUsageLogs=${counts.imageUsageLogs} imageDownloadLogs=${counts.imageDownloadLogs} ` +
      `chatConversations=${counts.chatConversations} chatEscalations=${counts.chatEscalations} ` +
      `chatSemanticCache=${counts.chatSemanticCache} chatIdempotency=${counts.chatIdempotency} ` +
      `funnelEvents=${counts.funnelEvents} ` +
      `candidatures=${counts.candidatures} (${counts.candidaturesFichiers} fichiers)`,
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
