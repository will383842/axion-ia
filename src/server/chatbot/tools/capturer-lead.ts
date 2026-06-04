// Tool `capturer_lead` (T-17, ADR-CB-09) — crée un Submission, IDEMPOTENT.
//
// Consentement RGPD explicite REQUIS. Idempotence via chat_action_idempotency
// (cle = sha256(conversationId + "capturer_lead" + payload)) → un retry ne crée
// jamais de doublon. Le lead porte `source = "chatbot"` (D-LEAD-SOURCE, T-01) →
// filtrable en console admin.

import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ToolContext } from "@/server/chatbot/tools/rechercher-offres";

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
  const key = idempotencyKey(ctx.conversationId, input);

  // Pré-check idempotence.
  const existing = await prisma.chatActionIdempotency.findUnique({ where: { cle: key } });
  if (existing && existing.resultat) {
    const memo = existing.resultat as { submissionId?: string };
    if (memo.submissionId) return { submissionId: memo.submissionId, idempotent: true };
  }

  // Création atomique : Submission + clé d'idempotence.
  const submission = await prisma.submission.create({
    data: {
      type: "contact",
      locale: "fr",
      companyName: input.structure ?? "Via chatbot",
      contactName: input.nom,
      contactEmail: input.email,
      ...(input.telephone ? { contactPhone: input.telephone } : {}),
      details: { besoin: input.besoin_resume, canal: "chatbot", consentementRgpd: true },
      source: "chatbot",
      ...(ctx.ipHash ? { ipHash: ctx.ipHash } : {}),
    },
    select: { id: true },
  });

  await prisma.chatActionIdempotency.upsert({
    where: { cle: key },
    update: { resultat: { submissionId: submission.id } },
    create: { cle: key, resultat: { submissionId: submission.id } },
  });

  return { submissionId: submission.id, idempotent: false };
}
