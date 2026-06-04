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
 *
 * Tous les appels génèrent un ActivityLog `gdpr.erase.<table>` (forensique).
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

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
  const result = await prisma.submission.updateMany({
    where: { contactEmail: email },
    data: {
      contactName: ERASED_PLACEHOLDER,
      contactRole: null,
      contactEmail: hashedEmail,
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

  const subs = await prisma.submission.findMany({
    where: { contactEmail: email },
    select: { id: true },
  });
  const subIds = subs.map((s) => s.id);

  let conversationsDeleted = 0;
  if (subIds.length > 0) {
    const del = await prisma.chatConversation.deleteMany({
      where: { submissionId: { in: subIds } },
    });
    conversationsDeleted = del.count;
  }

  const esc = await prisma.chatEscalation.updateMany({
    where: { contactEmail: email },
    data: { contactEmail: hashedEmail, contexte: null },
  });

  return { conversationsDeleted, escalationsAnonymized: esc.count };
}
