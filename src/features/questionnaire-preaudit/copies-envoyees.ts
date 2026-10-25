/**
 * Les copies EXACTES des invitations parties (objet + corps), relues après coup (2026-10-25).
 *
 * Lecture seule de `email_logs` + `email_log_contents` (écrites par le worker à l'envoi, jamais
 * réécrites). Le lien personnel y est MASQUÉ (`masquerSecretsEmail`) : la console ne rejoue pas un
 * lien. Ne lève jamais : une copie manquante se dit, elle ne casse pas la page.
 */

import { prisma } from "@/lib/prisma";
import { EmailLogStatus } from "../../../prisma/generated/client";

export interface CopieInvitation {
  emailLogId: string;
  envoyeLe: Date | null;
  destinataire: string;
  /** NULL : la copie n'a pas été conservée (avant sa mise en place, ou échec d'écriture). */
  objet: string | null;
  html: string | null;
}

export async function lireCopiesInvitation(questionnaireId: string): Promise<CopieInvitation[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid") === true) return [];
  try {
    const lignes = await prisma.emailLog.findMany({
      where: {
        template: "questionnaire-avant-audit",
        entityType: "QuestionnaireAvantAudit",
        entityId: questionnaireId,
        status: EmailLogStatus.sent,
      },
      orderBy: { sentAt: "desc" },
      take: 10,
      select: {
        id: true,
        sentAt: true,
        recipient: true,
        contenu: { select: { subject: true, html: true } },
      },
    });
    return lignes.map((l) => ({
      emailLogId: l.id,
      envoyeLe: l.sentAt,
      destinataire: l.recipient,
      objet: l.contenu?.subject ?? null,
      html: l.contenu?.html ?? null,
    }));
  } catch {
    return [];
  }
}
