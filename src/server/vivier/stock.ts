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
 *   2. `integrateVivierStock()` — intégrait au vivier CRM, 30 jours plus tard,
 *      ceux qui n'avaient pas dit non. COUPÉE (ADR 0047, révision § 4 ter) :
 *      aucune candidature ne part plus au CRM ; voir la fonction.
 *
 * 🔴 L'horloge des 30 jours n'est JAMAIS raccourcie en dur. Les tests passent un
 * `windowDays` explicite en paramètre — la règle reste intacte, l'écart se voit
 * dans l'appel de test.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { normalizeEmail } from "@/lib/security/email-hash";
import { enqueueEmail } from "@/server/queue/queues";

import { isVivierStockEnabled, VIVIER_OPPOSITION_WINDOW_DAYS } from "./config";
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
 * Intégration J+30 au vivier CRM — COUPÉE (ADR 0047, révision § 4 ter).
 *
 * Décision de Will : aucune candidature ne franchit la frontière vers le CRM,
 * et le vivier est tenu par la console du site. Cette fonction émettait une
 * ligne `application_submitted` par candidature du stock ; elle ne lit plus la
 * base et n'écrit plus rien. Le couvercle est dans le CODE, pas dans un
 * drapeau : `CRM_SYNC_CANDIDATES_ENABLED` reste ouvert (il porte l'opposition
 * des fiches déjà parties), et c'est lui seul qui fermait ce chemin avant.
 *
 * Ce que devient le stock informé (entrée au vivier du SITE, marquage de
 * `vivierSyncedAt` côté site ou non) n'est pas tranché ici : c'est une
 * décision de Will, à prendre avec le sort des fiches déjà parties. Tant
 * qu'elle ne l'est pas, rien n'est consommé : `vivierSyncedAt` reste nul, et
 * l'échéance survit à la décision, quelle qu'elle soit.
 *
 * Signature conservée : le worker `vivier-crons` l'appelle chaque jour.
 */
export async function integrateVivierStock(
  _options: { now?: Date; windowDays?: number; limit?: number } = {},
): Promise<VivierIntegrationReport> {
  return { due: 0, integrated: 0, skipped: 0 };
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
