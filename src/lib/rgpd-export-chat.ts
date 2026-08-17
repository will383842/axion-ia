/**
 * RGPD art. 15 (droit d'accès) — export des données chatbot (chat_*). T-23.
 *
 * Rassemble, pour un email donné :
 *  - les conversations rattachées aux leads (Submissions) de la personne, avec
 *    leurs messages (contenu), le profil prospect et le résumé ;
 *  - les escalades portant l'email en contact.
 *
 * Symétrique de `eraseChatDataForEmail` (`@/lib/rgpd-erase`).
 */

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";

export interface ChatExportMessage {
  readonly role: string;
  readonly contenu: string;
  readonly createdAt: Date;
}

export interface ChatExportConversation {
  readonly id: string;
  readonly sessionUuid: string;
  readonly statut: string;
  readonly pageContext: string | null;
  readonly prospectProfile: unknown;
  readonly resume: string | null;
  readonly createdAt: Date;
  readonly messages: ReadonlyArray<ChatExportMessage>;
}

export interface ChatExportEscalation {
  readonly id: string;
  readonly question: string;
  readonly contexte: string | null;
  readonly statut: string;
  readonly createdAt: Date;
}

export interface ChatExport {
  readonly conversations: ReadonlyArray<ChatExportConversation>;
  readonly escalations: ReadonlyArray<ChatExportEscalation>;
}

export async function exportChatDataForEmail(email: string): Promise<ChatExport> {
  // Ancres : leads (Submission → conversation via submissionId) + escalades
  // (conversation référencée). Symétrique de eraseChatDataForEmail.
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

  const escConvs = await prisma.chatEscalation.findMany({
    where: { contactEmail: email, conversationId: { not: null } },
    select: { conversationId: true },
  });
  const escConvIds = escConvs
    .map((e) => e.conversationId)
    .filter((id): id is string => id !== null);

  const orClauses: Array<Record<string, unknown>> = [];
  if (subIds.length > 0) orClauses.push({ submissionId: { in: subIds } });
  if (escConvIds.length > 0) orClauses.push({ id: { in: escConvIds } });

  const conversations =
    orClauses.length > 0
      ? await prisma.chatConversation.findMany({
          where: { OR: orClauses },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            sessionUuid: true,
            statut: true,
            pageContext: true,
            prospectProfile: true,
            resume: true,
            createdAt: true,
            messages: {
              orderBy: { createdAt: "asc" },
              select: { role: true, contenu: true, createdAt: true },
            },
          },
        })
      : [];

  const escalations = await prisma.chatEscalation.findMany({
    where: { contactEmail: email },
    orderBy: { createdAt: "desc" },
    select: { id: true, question: true, contexte: true, statut: true, createdAt: true },
  });

  return { conversations, escalations };
}
