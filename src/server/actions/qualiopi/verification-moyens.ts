/**
 * Qualiopi — Server Action « Vérification des moyens » d'une session (chantier QNC, lot L07, O11).
 *
 * N'agit que si `qualiopi.moyens.actif` l'autorise pour CETTE session
 * (`actif`, ou `essai` sur une session du banc d'essai). Éteint : refus net,
 * aucune écriture.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import { enregistrerVerificationMoyens } from "@/server/qualiopi/moyens/verification-moyens";
import { estActifPour, lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";

type ActionResult<T> = { data: T } | { error: string };

const schema = z.object({
  sessionId: z.string().uuid(),
  salle: z.boolean(),
  wifi: z.boolean(),
  projection: z.boolean(),
  postes: z.boolean(),
  comptes: z.boolean(),
  materielStagiaire: z.boolean(),
  fourniParEntreprise: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  confirmationEntreprise: z
    .object({ par: z.string().trim().min(1).max(200), le: z.string().trim().min(1).max(40) })
    .optional(),
});

const MESSAGES = {
  point_manquant: "Renseignez les six points de la vérification.",
  apres_debut: "La vérification doit être enregistrée AVANT le début de la session.",
  fourniture_entreprise_manquante: "Formation chez l'entreprise : indiquez ce qu'elle fournit.",
  confirmation_entreprise_manquante:
    "Formation chez l'entreprise : indiquez la fonction de la personne qui a confirmé, et quand.",
  session_introuvable: "Session introuvable.",
} as const;

export async function enregistrerVerificationMoyensAction(
  input: z.input<typeof schema>,
): Promise<ActionResult<{ sessionId: string }>> {
  const session = await requireAdminWrite();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, ...bloc } = parsed.data;

  const cible = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { estTestInterne: true },
  });
  if (cible === null) return { error: MESSAGES.session_introuvable };
  if (!estActifPour(await lireInterrupteurQualiopi("moyens"), cible)) {
    return { error: "La vérification des moyens n'est pas activée." };
  }

  try {
    const r = await enregistrerVerificationMoyens(
      prisma as never,
      sessionId,
      bloc as never,
      session.userId,
      new Date(),
    );
    if (!r.ok) return { error: MESSAGES[r.raison] };
  } catch {
    return { error: "Erreur lors de l'enregistrement de la vérification" };
  }
  return { data: { sessionId } };
}
