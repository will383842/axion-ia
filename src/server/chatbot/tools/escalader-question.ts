// Tool `escalader_question` (T-14, REQ-034, ADR-CB-09) — escalade une question
// que le bot ne sait pas traiter (info manquante / score de confiance trop bas).
//
// Effets : (1) crée une `ChatEscalation` durable (statut "ouverte") = le « trou de
// KB » que la console admin surfacera (REQ-034) ; (2) ping l'équipe sur Telegram
// (best-effort, fail-soft : aucun crash si Telegram non configuré). L'email équipe
// + le rapprochement KB sont traités en aval (worker d'escalade / console, MVP3).
//
// RÈGLE : ne JAMAIS inventer de réponse — escalader est la sortie sûre.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import type { ToolContext } from "@/server/chatbot/tools/rechercher-offres";

export const EscaladerQuestionInputSchema = z
  .object({
    question: z.string().min(1).max(2000),
    contexte_conversation: z.string().max(4000).optional(),
    contact_email: z.string().email().optional(),
  })
  .strict();

export type EscaladerQuestionInput = z.infer<typeof EscaladerQuestionInputSchema>;

export interface EscalationResult {
  readonly escalationId: string;
  readonly statut: string;
  /** true si l'équipe a été notifiée (Telegram) ; false si non configuré. */
  readonly notified: boolean;
}

export async function escaladerQuestion(
  rawInput: unknown,
  ctx: ToolContext,
): Promise<EscalationResult> {
  const input = EscaladerQuestionInputSchema.parse(rawInput);

  const escalation = await prisma.chatEscalation.create({
    data: {
      tenantId: ctx.tenantId,
      ...(ctx.conversationId ? { conversationId: ctx.conversationId } : {}),
      question: input.question,
      ...(input.contexte_conversation ? { contexte: input.contexte_conversation } : {}),
      ...(input.contact_email ? { contactEmail: input.contact_email } : {}),
      statut: "ouverte",
    },
    select: { id: true, statut: true },
  });

  // Ping équipe best-effort. Fail-soft AUTOPORTANT : on n'échoue jamais la
  // création d'escalade (déjà persistée) à cause d'un souci de notification.
  const body = [
    "❓ Escalade chatbot — question sans réponse",
    `Question : ${input.question}`,
    input.contact_email ? `Contact : ${input.contact_email}` : "Contact : non fourni",
    `Escalade #${escalation.id}`,
  ].join("\n");
  let notified = false;
  try {
    notified = await sendTelegram({ tag: "CONTACT", body, silent: false });
  } catch (err) {
    console.warn("[escalader_question] notification Telegram échouée:", err);
  }

  // Confirmation au visiteur (2026-08-13). C'est le pire endroit pour un
  // silence : la personne vient d'écrire dans une fenêtre de discussion
  // qu'elle va fermer. Sans cet e-mail il ne lui reste AUCUNE trace de son
  // geste — ni preuve, ni rappel, ni moyen de relancer.
  // Meilleur effort, comme la notification : l'escalade est déjà persistée.
  if (input.contact_email) {
    try {
      await enqueueEmail("chatbot-demande-transmise", input.contact_email, "fr", {
        contexte: "question",
        extrait: input.question.slice(0, 200),
      });
    } catch (err) {
      console.warn("[escalader_question] confirmation e-mail échouée:", err);
    }
  }

  return { escalationId: escalation.id, statut: escalation.statut, notified };
}
