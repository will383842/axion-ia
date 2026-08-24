/**
 * RGPD art. 17 (droit à l'effacement) — Helpers d'anonymisation par email.
 *
 * Sprint Correctif S+1 (2026-05-16) — P0-S1-2.
 *
 * Doctrine :
 * - Submission : anonymisation in-place (PII → vide / hash) pour préserver
 *   l'audit trail business (compta, RGPD art. 30) sans données identifiantes.
 *   Les lignes ne sont PAS supprimées (legal hold pour la facturation +
 *   l'historique anti-fraude).
 * - NewsletterSubscriber : suppression hard (consent retiré, pas d'historique
 *   à conserver).
 * - Bookings : pas d'erase direct — les bookings référencent une Submission
 *   via FK ; anonymiser la Submission suffit (le booking row reste pour
 *   l'audit comptable mais ne contient déjà aucune PII propre).
 * - KB bookmarks : géré par `src/lib/knowledge/rgpd-export.ts` → `eraseKbDataForEmail`.
 * - Journaux d'e-mail (`email_logs`) : PSEUDONYMISATION de l'adresse, la ligne
 *   est conservée. C'est la preuve que le bénéficiaire a été informé — pièce
 *   exigée par Qualiopi (critère 2) et couverte par l'art. 17(3)(b) et (e).
 *   Ce qui compte pour un auditeur est « CE DOSSIER a reçu sa convocation le
 *   JJ/MM », pas l'adresse : la preuve survit, l'identifiant disparaît.
 * - Corbeille d'envoi (`email_outbox`) : SUPPRESSION. Un message NON ENVOYÉ ne
 *   prouve rien, et rien ne justifie de conserver sa charge utile — laquelle
 *   porte le nom, la formation, les dates et les liens personnels.
 *
 * Tous les appels génèrent un ActivityLog `gdpr.erase.<table>` (forensique).
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";

const ERASED_PLACEHOLDER = "[erased-rgpd-art17]";

function hashEmail(email: string): string {
  const salt = process.env.IP_HASH_SALT ?? "axion-ia-rgpd-erase";
  return createHash("sha256").update(`${salt}::${email}`).digest("hex").slice(0, 16);
}

export interface EraseSubmissionsResult {
  readonly anonymized: number;
}

export interface EraseNewsletterResult {
  readonly deleted: number;
}

/**
 * Anonymise toutes les Submission ayant `contactEmail = email`.
 *
 * Remplace : contactName, contactRole, contactPhone, address, internalNotes,
 * ipAddress, userAgent, referer, details. Conserve : id, type, status,
 * companyName (data business non personnelle), sector, employeesCount,
 * submittedAt + relations bookings/contracts pour l'audit comptable.
 *
 * `contactEmail` est remplacé par un hash déterministe pour permettre la
 * dédup et empêcher un nouveau profilage croisé.
 */
export async function eraseSubmissionsForEmail(email: string): Promise<EraseSubmissionsResult> {
  const hashedEmail = `erased:${hashEmail(email)}@erased.local`;
  // 🔴 On interroge l'EMPREINTE, jamais `contactEmail`. Cette colonne est
  // chiffrée avec un IV aléatoire : l'égalité SQL qui se trouvait ici
  // n'anonymisait JAMAIS aucune ligne, tout en renvoyant « succès ».
  // Le repli sur `contactEmail` couvre les lignes en clair (chatbot,
  // candidatures, podcast) et celles antérieures au remplissage rétroactif.
  const lookupHash = hashEmailForLookup(email);
  const result = await prisma.submission.updateMany({
    where: {
      OR: [...(lookupHash ? [{ contactEmailHash: lookupHash }] : []), { contactEmail: email }],
    },
    data: {
      contactName: ERASED_PLACEHOLDER,
      contactRole: null,
      contactEmail: hashedEmail,
      // Remise à NULL : sans cela, une seconde demande d'effacement — ou un
      // export ultérieur — retrouverait encore la ligne anonymisée.
      contactEmailHash: null,
      contactPhone: null,
      address: null,
      internalNotes: null,
      ipAddress: null,
      userAgent: null,
      referer: null,
      details: {},
    },
  });
  return { anonymized: result.count };
}

/**
 * Supprime hard le NewsletterSubscriber ayant `email`. Si consent retiré,
 * aucune raison de conserver la ligne (pas d'audit business).
 */
export async function eraseNewsletterForEmail(email: string): Promise<EraseNewsletterResult> {
  const result = await prisma.newsletterSubscriber.deleteMany({ where: { email } });
  return { deleted: result.count };
}

export interface EraseEmailTracesResult {
  /** Lignes de `email_logs` dont l'adresse a été pseudonymisée. */
  readonly logsPseudonymises: number;
  /** Lignes de `email_outbox` supprimées (messages non envoyés). */
  readonly outboxSupprimes: number;
}

/**
 * 🔴 `D5-5-01` (2026-08-24) — LES DEUX TABLES D'E-MAIL ÉCHAPPAIENT À L'EFFACEMENT.
 *
 * `email_logs.recipient` et `email_outbox.recipient` portent l'adresse **en
 * clair** (`@db.Citext`), et `email_outbox.payload` porte la charge utile
 * complète du message : nom, intitulé de formation, dates, liens personnels.
 * Ni l'une ni l'autre n'était touchée par la route d'effacement — et elles ne
 * figuraient pas davantage parmi les exceptions de rétention déclarées.
 *
 * 🔑 C'est le défaut exact de `D5-5-03`, une table plus loin : les candidatures
 * étaient hors de portée, et le courriel de confirmation ÉNUMÉRAIT ce qui avait
 * été effacé. Le commentaire écrit alors vaut mot pour mot ici — « une liste qui
 * se donne pour exhaustive et qui omet le CV est pire qu'une absence de liste ».
 * La personne recevait « vos données identifiantes ont été effacées » pendant
 * que son adresse et le contenu de ses messages survivaient.
 *
 * ## Pourquoi les deux tables ne se traitent PAS pareil
 *
 * `email_logs` est une PREUVE. Qualiopi exige de démontrer que le bénéficiaire a
 * été informé (convocation, convention, attestation) ; l'art. 17(3)(b) et (e) du
 * RGPD couvre cette conservation. Mais la preuve utile est « ce DOSSIER a reçu
 * sa convocation le JJ/MM » — le rattachement se fait par `entityType`/`entityId`,
 * pas par l'adresse. On pseudonymise donc l'adresse et on garde la ligne : un
 * auditeur peut toujours vérifier qu'un envoi a eu lieu, plus à qui.
 *
 * `email_outbox` ne prouve RIEN : ce sont des messages en attente ou garés en
 * corbeille de validation, jamais partis. Aucune base légale ne justifie de
 * conserver la charge utile d'un courrier qu'on n'a pas envoyé. Suppression.
 *
 * ⚠️ `bounceReason` est vidé au passage : c'est du texte libre renvoyé par le
 * transporteur, qui contient l'adresse et parfois davantage.
 */
export async function eraseEmailTracesForEmail(email: string): Promise<EraseEmailTracesResult> {
  // Même forme que `eraseSubmissionsForEmail` : `erased:<empreinte>@erased.local`.
  // Une SEULE écriture de ce format dans le module — un format recopié diverge.
  const pseudonyme = `erased:${hashEmail(email)}@erased.local`;

  const [logs, outbox] = await Promise.all([
    prisma.emailLog.updateMany({
      where: { recipient: email },
      data: { recipient: pseudonyme, bounceReason: null },
    }),
    prisma.emailOutbox.deleteMany({ where: { recipient: email } }),
  ]);

  return { logsPseudonymises: logs.count, outboxSupprimes: outbox.count };
}

export interface EraseChatResult {
  /** Conversations chatbot supprimées (messages cascade). */
  readonly conversationsDeleted: number;
  /** Escalades dont l'email a été anonymisé. */
  readonly escalationsAnonymized: number;
}

/**
 * Efface les données chatbot (`chat_*`) liées à une personne (RGPD art. 17).
 *
 * Doctrine chatbot (≠ Submission) : pas de legal-hold business sur le contenu
 * conversationnel → **hard-delete** des conversations rattachées aux leads
 * (Submissions) de cette personne ; `chat_messages` (contenu = PII) part en
 * cascade via la FK `ON DELETE CASCADE`. Le lead lui-même reste dans Submission
 * (anonymisé par `eraseSubmissionsForEmail`) pour l'audit comptable.
 *
 * Les `chat_escalations` portant l'email en clair sont anonymisées (email hashé,
 * contexte libre vidé) — l'escalade reste pour l'analyse des trous de KB.
 *
 * ⚠️ À appeler AVANT `eraseSubmissionsForEmail` (qui hashe le `contactEmail`),
 * sinon le rattachement conversation↔lead par email serait déjà rompu.
 */
export async function eraseChatDataForEmail(email: string): Promise<EraseChatResult> {
  const hashedEmail = `erased:${hashEmail(email)}@erased.local`;

  // Ancres pour rattacher une conversation à la personne :
  //  - leads (Submission) de cet email → conversations via submissionId (backlink) ;
  //  - escalades de cet email → conversation référencée (conversation_id).
  // Empreinte : `contactEmail` est chiffré avec un IV aléatoire, l'égalité SQL
  // ne peut jamais correspondre (cf. `lib/security/email-hash.ts`).
  const lookupHash = hashEmailForLookup(email);
  const subs = await prisma.submission.findMany({
    where: {
      OR: [...(lookupHash ? [{ contactEmailHash: lookupHash }] : []), { contactEmail: email }],
    },
    select: { id: true },
  });
  const subIds = subs.map((s) => s.id);

  const escs = await prisma.chatEscalation.findMany({
    where: { contactEmail: email, conversationId: { not: null } },
    select: { conversationId: true },
  });
  const escConvIds = escs.map((e) => e.conversationId).filter((id): id is string => id !== null);

  const orClauses: Array<Record<string, unknown>> = [];
  if (subIds.length > 0) orClauses.push({ submissionId: { in: subIds } });
  if (escConvIds.length > 0) orClauses.push({ id: { in: escConvIds } });

  let conversationsDeleted = 0;
  if (orClauses.length > 0) {
    const del = await prisma.chatConversation.deleteMany({ where: { OR: orClauses } });
    conversationsDeleted = del.count;
  }

  const esc = await prisma.chatEscalation.updateMany({
    where: { contactEmail: email },
    data: { contactEmail: hashedEmail, contexte: null },
  });

  return { conversationsDeleted, escalationsAnonymized: esc.count };
}
