// Tool `capturer_lead` (T-17, ADR-CB-09) — crée un Submission, IDEMPOTENT.
//
// Consentement RGPD explicite REQUIS. Idempotence via chat_action_idempotency
// (cle = sha256(conversationId + "capturer_lead" + payload)) → un retry ne crée
// jamais de doublon. Le lead porte `source = "chatbot"` (D-LEAD-SOURCE, T-01) →
// filtrable en console admin.

import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { syncFormSubmissionToCrm } from "@/server/crm-sync";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import { Prisma } from "../../../../prisma/generated/client";
import type { ToolContext } from "@/server/chatbot/tools/rechercher-offres";
import { hashEmailForLookup } from "@/lib/security/email-hash";

/**
 * Notifie l'équipe d'un NOUVEAU lead chatbot (best-effort, fail-soft — ne fait
 * jamais échouer la capture). Même canal que l'escalade (Telegram via le hub
 * notify()). No-op silencieux si Telegram non configuré (pas de token).
 */
async function notifyNewLead(input: CapturerLeadInput, submissionId: string): Promise<void> {
  const body = [
    "🟢 Nouveau lead chatbot",
    `Nom : ${input.nom}`,
    `Email : ${input.email}`,
    input.telephone ? `Tél : ${input.telephone}` : null,
    input.structure ? `Structure : ${input.structure}` : null,
    `Besoin : ${input.besoin_resume}`,
    `Submission #${submissionId}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
  try {
    await sendTelegram({ tag: "CONTACT", body, silent: false });
  } catch (err) {
    console.warn("[capturer_lead] notification Telegram échouée:", err);
  }
}

export const CapturerLeadInputSchema = z
  .object({
    nom: z.string().min(1).max(255),
    email: z.string().email(),
    telephone: z.string().max(30).optional(),
    structure: z.string().max(255).optional(),
    besoin_resume: z.string().min(1).max(2000),
    /** Consentement RGPD explicite — DOIT être true. */
    consentement_rgpd: z.literal(true),
  })
  .strict();

export type CapturerLeadInput = z.infer<typeof CapturerLeadInputSchema>;

export interface CapturerLeadResult {
  readonly submissionId: string;
  /** true si le lead existait déjà (retry idempotent, pas de doublon créé). */
  readonly idempotent: boolean;
}

/** Clé d'idempotence déterministe pour une action de capture de lead. */
function idempotencyKey(conversationId: string, input: CapturerLeadInput): string {
  const payload = JSON.stringify({
    nom: input.nom,
    email: input.email.toLowerCase(),
    besoin: input.besoin_resume,
  });
  return createHash("sha256")
    .update(`${conversationId}:capturer_lead:${payload}`)
    .digest("hex")
    .slice(0, 64);
}

/**
 * Crée (ou retrouve) un lead. Idempotent par conversation+payload. Le tool
 * requiert un `conversationId` dans le contexte (sinon l'idempotence est
 * impossible → on refuse pour éviter les doublons).
 */
export async function capturerLead(
  rawInput: unknown,
  ctx: ToolContext,
): Promise<CapturerLeadResult> {
  const input = CapturerLeadInputSchema.parse(rawInput);
  if (!ctx.conversationId) {
    throw new Error("[capturer_lead] conversationId requis (idempotence).");
  }
  const conversationId = ctx.conversationId;
  const key = idempotencyKey(conversationId, input);

  // Idempotence rapide : si la clé est déjà mémorisée (appel antérieur terminé),
  // on renvoie le résultat sans rien créer.
  const memoized = await readMemoizedSubmission(key);
  if (memoized) return { submissionId: memoized, idempotent: true };

  // Création RÉELLEMENT atomique : Submission + clé d'idempotence dans UNE
  // transaction. La clé `chat_action_idempotency.cle` (PK) sert de verrou de
  // concurrence — un `create` (pas `upsert`) sur cle conflicte (P2002) si une
  // requête concurrente same-key a déjà committé. Conséquences :
  //  - crash partiel → la transaction rollback → jamais de Submission orpheline ;
  //  - course concurrente → le perdant rollback (Submission incluse) → 0 doublon,
  //    puis relit le résultat du gagnant ci-dessous.
  let result: CapturerLeadResult;
  try {
    result = await prisma.$transaction(async (tx) => {
      const submission = await tx.submission.create({
        data: {
          type: "contact",
          locale: "fr",
          companyName: input.structure ?? "Via chatbot",
          contactName: input.nom,
          contactEmail: input.email,
          contactEmailHash: hashEmailForLookup(input.email),
          ...(input.telephone ? { contactPhone: input.telephone } : {}),
          details: { besoin: input.besoin_resume, canal: "chatbot", consentementRgpd: true },
          source: "chatbot",
          ...(ctx.ipHash ? { ipHash: ctx.ipHash } : {}),
        },
        select: { id: true },
      });

      await tx.chatActionIdempotency.create({
        data: { cle: key, resultat: { submissionId: submission.id } },
      });

      // Backlink conversation → lead : indispensable pour rattacher la conversation
      // à la personne (RGPD export/erase art. 15/17 retrouvent les conversations
      // via ce submissionId).
      await tx.chatConversation.update({
        where: { id: conversationId },
        data: { submissionId: submission.id },
      });

      // Synchro CRM (lot L2) — ici, et ICI SEULEMENT, l'outbox est écrite DANS
      // la transaction métier : c'est le seul point de capture du site qui en
      // ouvre déjà une. On y gagne la garantie « si le lead existe, l'événement
      // existe » sans rien changer au risque. Ailleurs, l'écriture est
      // post-commit pour qu'un échec de synchro ne puisse jamais faire
      // rollback un lead.
      await syncFormSubmissionToCrm({
        tx,
        subjectRef: `site:submission:${submission.id}`,
        formType: "autre",
        sourceSlug: "chatbot",
        person: { email: input.email, fullName: input.nom, phone: input.telephone ?? null },
        ...(input.structure ? { company: { name: input.structure } } : {}),
        payload: { canal: "chatbot" },
      });

      return { submissionId: submission.id, idempotent: false };
    });
  } catch (err) {
    // Conflit unique sur la clé d'idempotence = un appel concurrent a gagné la
    // course et committé. Notre transaction (Submission comprise) a rollback :
    // aucun doublon. On renvoie le résultat mémorisé par le gagnant.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await readMemoizedSubmission(key);
      if (winner) return { submissionId: winner, idempotent: true };
    }
    throw err;
  }

  // Notification équipe sur NOUVEAU lead uniquement (jamais sur un retry
  // idempotent → pas de double-ping). Fail-soft : n'impacte pas le résultat.
  if (!result.idempotent) {
    await notifyNewLead(input, result.submissionId);

    // Confirmation au visiteur (2026-08-13). Il laissait son adresse dans une
    // fenêtre de discussion qu'il allait fermer, et ne recevait rien : aucune
    // trace de son geste, ni preuve ni moyen de relancer.
    //
    // 🔴 Sous la même garde `!result.idempotent` que la notification interne :
    // un rejeu ne doit PAS renvoyer un second e-mail à la même personne.
    try {
      await enqueueEmail("chatbot-demande-transmise", input.email, "fr", {
        contexte: "rappel",
        ...(input.besoin_resume ? { extrait: input.besoin_resume.slice(0, 200) } : {}),
      });
    } catch (err) {
      console.warn("[capturer_lead] confirmation e-mail échouée:", err);
    }
  }
  return result;
}

/** Relit l'id de Submission mémorisé pour une clé d'idempotence, ou null. */
async function readMemoizedSubmission(key: string): Promise<string | null> {
  const existing = await prisma.chatActionIdempotency.findUnique({ where: { cle: key } });
  const memo = existing?.resultat as { submissionId?: string } | null;
  return memo?.submissionId ?? null;
}
