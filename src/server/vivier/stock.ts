/**
 * REPRISE DU STOCK DE CANDIDATURES — information puis intégration (lot L4).
 *
 * Contexte (plan §2.3, décision actée option (b)) : les candidatures déjà
 * reçues l'ont été sous un texte v1 qui ne couvrait QUE l'étude de la
 * candidature en cours. Les intégrer telles quelles à un vivier de 2 ans serait
 * un détournement de finalité. La CNIL admet, pour une CVthèque, l'information
 * loyale + opposition simple : on informe, on laisse 30 jours pleins, puis on
 * intègre ceux qui ne se sont pas opposés.
 *
 * Deux temps, deux fonctions, deux drapeaux :
 *   1. `sendVivierInformationBatch()` — envoie l'email d'information et
 *      horodate `vivierInfoSentAt`. Gaté par `VIVIER_STOCK_ENABLED`.
 *   2. `integrateVivierStock()` — 30 jours plus tard, intègre au vivier CRM
 *      ceux qui n'ont pas dit non. Gaté par `CRM_SYNC_CANDIDATES_ENABLED`
 *      (via l'outbox, qui refuse tout flux `vivier` sans lui).
 *
 * 🔴 L'horloge des 30 jours n'est JAMAIS raccourcie en dur. Les tests passent un
 * `windowDays` explicite en paramètre — la règle reste intacte, l'écart se voit
 * dans l'appel de test.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { normalizeEmail } from "@/lib/security/email-hash";
import { candidateFamilyForOffer } from "@/lib/careers/candidate-family";
import { syncCandidateToCrm } from "@/server/crm-sync";
import { isCrmSyncCandidatesEnabled } from "@/server/crm-sync/config";
import { enqueueEmail } from "@/server/queue/queues";

import {
  isVivierStockEnabled,
  vivierIntegrationCutoff,
  VIVIER_OPPOSITION_WINDOW_DAYS,
  VIVIER_STOCK_CONSENT_VERSION,
} from "./config";
import { signVivierOppositionToken } from "./token";

/** Plafond par passage : on n'envoie pas 71 emails en rafale sans respirer. */
const BATCH_LIMIT = 100;

export interface VivierInformationReport {
  /** Candidatures examinées (sans `vivierInfoSentAt`). */
  candidates: number;
  /** Emails réellement mis en file. */
  sent: number;
  /** Écartées : doublon d'adresse, opposition connue, adresse illisible. */
  skipped: number;
  /** Refus du drapeau — aucune lecture de base n'a eu lieu. */
  refused?: boolean;
}

/**
 * Envoie l'email d'information au stock, une seule fois par ADRESSE.
 *
 * La déduplication est par email et non par candidature : une personne ayant
 * postulé à trois offres ne doit pas recevoir trois fois le même message. Mais
 * l'horodatage est posé sur TOUTES ses candidatures — sinon les deux autres
 * repartiraient au prochain passage, et elle recevrait bien trois emails.
 */
export async function sendVivierInformationBatch(
  options: { limit?: number; baseUrl?: string } = {},
): Promise<VivierInformationReport> {
  // ── VERROU ────────────────────────────────────────────────────────────────
  // Refus AVANT toute lecture de base : l'inertie est totale, et vérifiable.
  if (!isVivierStockEnabled()) {
    return { candidates: 0, sent: 0, skipped: 0, refused: true };
  }

  const limit = options.limit ?? BATCH_LIMIT;
  const baseUrl = options.baseUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

  const rows = await prisma.jobApplication.findMany({
    where: { vivierInfoSentAt: null, vivierOpposedAt: null },
    orderBy: { submittedAt: "asc" },
    take: limit,
    select: {
      id: true,
      email: true,
      firstName: true,
      offerTitleSnap: true,
      submittedAt: true,
      locale: true,
    },
  });

  // Adresses déjà opposées : elles ne doivent pas recevoir l'information (on
  // leur redemanderait un accord qu'elles ont déjà refusé).
  const opposed = await opposedEmailSet();

  const report: VivierInformationReport = { candidates: rows.length, sent: 0, skipped: 0 };
  const seen = new Set<string>();

  for (const row of rows) {
    const email = safeDecrypt(row.email);
    const normalized = email ? normalizeEmail(email) : null;

    if (normalized && opposed.has(normalized)) {
      // 🔴 Cette personne s'est DÉJÀ opposée, sur une autre de ses candidatures
      // (typiquement : elle s'oppose, puis repostule plus tard — la nouvelle
      // ligne naît alors avec `vivierOpposedAt` à NULL).
      //
      // Il ne suffit PAS de l'écarter de l'envoi. Si on se contentait de poser
      // la date d'information, cette ligne resterait « informée, non opposée »
      // et le passage J+30 l'intégrerait au vivier — en dépit d'une opposition
      // connue, et sans que personne ne le voie. On propage donc l'opposition à
      // la ligne elle-même : c'est ce marquage qui ferme le trou.
      //
      // On ne pose PAS `vivierInfoSentAt` : nous ne l'avons jamais informée, et
      // la base ne doit pas prétendre le contraire.
      report.skipped += 1;
      await markOpposed(row.id);
      continue;
    }

    if (!normalized) {
      report.skipped += 1;
      // Adresse illisible : on l'horodate quand même, sinon elle reviendrait à
      // chaque passage et bloquerait la file indéfiniment. Elle ne risque rien
      // au J+30 : le déchiffrement y échouera de la même façon, et la ligne
      // sera écartée.
      await markInformed(row.id);
      continue;
    }

    if (seen.has(normalized)) {
      report.skipped += 1;
      await markInformed(row.id);
      continue;
    }
    seen.add(normalized);

    const token = await signVivierOppositionToken(row.id);
    const oppositionUrl = `${baseUrl.replace(/\/+$/, "")}/api/vivier-opposition?token=${encodeURIComponent(token)}`;

    const queued = await enqueueEmail(
      "vivier-information",
      email as string,
      row.locale === "en" ? "en" : "fr",
      {
        prenom: safeDecrypt(row.firstName) ?? "",
        offre: row.offerTitleSnap,
        dateCandidature: row.submittedAt.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
        oppositionUrl,
        joursOpposition: VIVIER_OPPOSITION_WINDOW_DAYS,
      },
      // Transactionnel : c'est une information RGPD obligatoire, pas une
      // sollicitation commerciale. Elle ne passe donc pas par la corbeille de
      // validation et ne part pas de l'adresse marketing.
      { bypassValidation: true, jobId: `vivier-info-${row.id}` },
    );

    if (queued.enqueued) {
      report.sent += 1;
      await markInformed(row.id);
    } else {
      // Mise en file impossible (BullMQ coupé) : on NE POSE PAS l'horodatage.
      // Poser la date sans avoir envoyé l'email ferait courir la fenêtre
      // d'opposition contre une personne jamais informée — exactement le
      // contraire de ce que cette mécanique garantit.
      report.skipped += 1;
      console.error(`[vivier] email d'information non mis en file pour ${row.id}`);
    }
  }

  console.warn(
    `[vivier] information du stock : ${report.sent} envoyé(s), ${report.skipped} écarté(s) sur ${report.candidates} examinée(s)`,
  );

  return report;
}

export interface VivierIntegrationReport {
  /** Candidatures dues (fenêtre échue, non opposées, pas encore intégrées). */
  due: number;
  integrated: number;
  skipped: number;
}

/**
 * Intègre au vivier CRM les candidatures dont la fenêtre d'opposition est
 * ÉCHUE et qui n'ont pas fait l'objet d'une opposition.
 *
 * @param options.windowDays OVERRIDE DE TEST UNIQUEMENT. La règle métier est
 *   `VIVIER_OPPOSITION_WINDOW_DAYS` (30 jours) et ne se modifie pas ; un test
 *   qui a besoin d'une autre fenêtre la passe ici, explicitement, et cela se
 *   voit dans le test.
 */
export async function integrateVivierStock(
  options: { now?: Date; windowDays?: number; limit?: number } = {},
): Promise<VivierIntegrationReport> {
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? VIVIER_OPPOSITION_WINDOW_DAYS;
  const cutoff = vivierIntegrationCutoff(now, windowDays);

  // ── GARDE D'ETAT MIXTE (defaut BLOQUANT trouve en revue adversariale) ────
  // La sequence d'exploitation PREVUE informe le stock AVANT d'ouvrir le
  // canal candidats. Dans cet etat, `enqueueCrmSyncEvent` refuse EN SILENCE
  // (drapeau OFF => null) : sans cette garde, on posait quand meme
  // `vivierSyncedAt`, et les 71 fiches du stock etaient exclues A JAMAIS du
  // rattrapage (`where vivierSyncedAt: null`) sans qu'une seule ligne
  // d'outbox existe. On ne consomme l'echeance QUE si le canal peut ecrire.
  if (!isCrmSyncCandidatesEnabled()) {
    console.warn(
      "[vivier] integration J+30 differee : CRM_SYNC_CANDIDATES_ENABLED est ferme — rien n'est consomme, le passage suivant rattrapera.",
    );
    return { due: 0, integrated: 0, skipped: 0 };
  }

  const rows = await prisma.jobApplication.findMany({
    where: {
      // Informée…
      vivierInfoSentAt: { not: null, lte: cutoff },
      // …sans opposition…
      vivierOpposedAt: null,
      // …et pas déjà intégrée (idempotence : rejouer ne crée pas de doublon).
      vivierSyncedAt: null,
    },
    orderBy: { vivierInfoSentAt: "asc" },
    take: options.limit ?? BATCH_LIMIT,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      offerTitleSnap: true,
      submittedAt: true,
      vivierInfoSentAt: true,
      consentVersion: true,
      cvStoragePath: true,
      experienceBand: true,
      offer: { select: { slug: true, category: true } },
    },
  });

  const report: VivierIntegrationReport = { due: rows.length, integrated: 0, skipped: 0 };

  for (const row of rows) {
    const email = safeDecrypt(row.email);
    if (!email) {
      report.skipped += 1;
      continue;
    }

    const outboxId = await syncCandidateToCrm({
      subjectRef: `site:job_application:${row.id}`,
      family: candidateFamilyForOffer(row.offer?.slug, row.offer?.category),
      offerSlug: row.offer?.slug ?? null,
      sourceSlug: "site-candidature-offre",
      occurredAt: row.submittedAt,
      person: {
        email,
        firstName: safeDecrypt(row.firstName),
        lastName: safeDecrypt(row.lastName),
        phone: safeDecrypt(row.phone),
      },
      consent: {
        // PAS `row.consentVersion` (v1 : etude de la candidature seulement,
        // le CRM la rejette a raison). L'acte juridique qui fonde l'entree en
        // vivier du STOCK est l'email d'information + 30 j sans opposition —
        // il a sa propre version FERME, enumeree cote CRM.
        version: VIVIER_STOCK_CONSENT_VERSION,
        at: row.vivierInfoSentAt ?? row.submittedAt,
        textRef: "vivier-information-email",
        // La base légale de la conservation en vivier n'est PAS un accord
        // exprès ici : c'est l'information loyale + absence d'opposition
        // pendant 30 jours. On horodate donc l'accord réputé acquis à la date
        // d'échéance de la fenêtre, pas à la date de candidature — cette date
        // est celle à partir de laquelle la conservation devient licite.
        vivierAt: row.vivierInfoSentAt
          ? new Date(row.vivierInfoSentAt.getTime() + windowDays * 24 * 60 * 60 * 1000)
          : null,
      },
      cvRef: row.cvStoragePath ? `site:cv:${row.id}` : null,
      attributes: {
        ...(row.experienceBand ? { experienceBand: row.experienceBand } : {}),
        vivierEntryMode: "stock-information-sans-opposition",
      },
      payload: { offerTitle: row.offerTitleSnap },
    });

    if (outboxId === null) {
      // Aucune ligne d'outbox posee (drapeau retombe entre-temps, echec
      // d'ecriture « evenement perdu ») : on NE consomme PAS l'echeance —
      // le passage suivant reessaiera. Marquer « integre » sans ecriture
      // confirmee serait une perte silencieuse.
      report.skipped += 1;
      continue;
    }

    await prisma.jobApplication.update({
      where: { id: row.id },
      data: { vivierSyncedAt: now },
    });
    report.integrated += 1;
  }

  // Doctrine de log : on ne journalise QUE ce qui s'est passé. Un « rien à
  // faire » quotidien noierait les logs sans rien apprendre.
  if (report.due > 0) {
    console.warn(
      `[vivier] intégration J+${windowDays} : ${report.integrated}/${report.due} intégrée(s), ${report.skipped} écartée(s)`,
    );
  }

  return report;
}

/** Horodate l'envoi de l'information sur une candidature. */
async function markInformed(applicationId: string): Promise<void> {
  await prisma.jobApplication.update({
    where: { id: applicationId },
    data: { vivierInfoSentAt: new Date() },
  });
}

/**
 * Propage une opposition CONNUE (portée par une autre candidature de la même
 * personne) à cette ligne-ci. Sans elle, la ligne serait éligible au J+30.
 */
async function markOpposed(applicationId: string): Promise<void> {
  await prisma.jobApplication.update({
    where: { id: applicationId },
    data: { vivierOpposedAt: new Date() },
  });
}

/**
 * Adresses déjà opposées, normalisées. Le volume reste petit (le vivier est
 * une reprise ponctuelle) ; le jour où il ne le sera plus, cette lecture
 * deviendra une jointure sur empreinte plutôt qu'un ensemble en mémoire.
 */
async function opposedEmailSet(): Promise<Set<string>> {
  const rows = await prisma.jobApplication.findMany({
    where: { vivierOpposedAt: { not: null } },
    select: { email: true },
  });

  const set = new Set<string>();
  for (const row of rows) {
    const email = safeDecrypt(row.email);
    if (email) set.add(normalizeEmail(email));
  }
  return set;
}

/**
 * Le déchiffrement PII lève si la clé manque ou si la valeur est corrompue.
 * Une ligne illisible ne doit pas faire tomber tout le lot.
 */
function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decryptPii(value) ?? null;
  } catch {
    return null;
  }
}
