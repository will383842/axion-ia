// Tool `qualifier_prospect` (T-13, REQ-030, ADR-CB-09) — capte sans interrogatoire
// le profil du prospect (type de structure, secteur, besoin, maturité IA, urgence)
// et le MERGE dans `chat_conversations.prospect_profile`.
//
// Non-intrusif : tous les champs sont optionnels (on enregistre ce qui est connu,
// au fil de la conversation). Le merge préserve les champs déjà captés aux tours
// précédents. `tenant_id` injecté serveur (non requis ici : la conversation est
// déjà résolue par tenant en amont).

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ToolContext } from "@/server/chatbot/tools/rechercher-offres";

export const QualifierProspectInputSchema = z
  .object({
    type_structure: z.enum(["tpe", "pme", "eti", "ecole", "association", "autre"]).optional(),
    secteur: z.string().min(1).max(120).optional(),
    besoin: z.string().min(1).max(500).optional(),
    maturite_ia: z.enum(["debutant", "intermediaire", "avance"]).optional(),
    urgence: z.enum(["faible", "moyenne", "forte"]).optional(),
  })
  .strict();

export type QualifierProspectInput = z.infer<typeof QualifierProspectInputSchema>;

/** Profil prospect accumulé (forme persistée dans `prospect_profile`). */
export type ProspectProfile = QualifierProspectInput;

/**
 * Fusionne les champs fournis dans le profil prospect de la conversation et
 * retourne le profil consolidé. Exige un `conversationId` (sinon rien à mettre
 * à jour).
 */
export async function qualifierProspect(
  rawInput: unknown,
  ctx: ToolContext,
): Promise<ProspectProfile> {
  const input = QualifierProspectInputSchema.parse(rawInput);
  if (!ctx.conversationId) {
    throw new Error("[qualifier_prospect] conversationId requis.");
  }

  const convo = await prisma.chatConversation.findUnique({
    where: { id: ctx.conversationId },
    select: { prospectProfile: true },
  });
  const previous = (convo?.prospectProfile as ProspectProfile | null) ?? {};

  // `input` ne contient que les clés réellement fournies (Zod optional) → le
  // spread n'écrase jamais un champ déjà connu par une valeur absente.
  const merged: ProspectProfile = { ...previous, ...input };

  await prisma.chatConversation.update({
    where: { id: ctx.conversationId },
    data: { prospectProfile: merged },
  });

  return merged;
}
