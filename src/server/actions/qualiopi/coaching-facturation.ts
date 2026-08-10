"use server";

/**
 * Coaching 1-to-1 — Server Action de facturation (console admin).
 *
 * 2026-08-10 (décision Will) : issue de la scission de l'ancien
 * `coaching-afest.ts`. Le 1-to-1 est une prestation de CONSEIL hors Qualiopi :
 * les actions de cadrage AFEST, protocole, attestation, émargement, kits
 * financeurs (OPCO / CPF / France Travail), financement tiers et certification
 * France Compétences ont été supprimées avec le module. Ne reste que la
 * facturation directe au client. RBAC admin (requireAdminWrite).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import { genererFactureCoaching } from "@/server/qualiopi/coaching-1to1/facturation-1to1";

export interface CoachingActionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly documentId?: string | null;
  readonly numero?: string;
}

const factureSchema = z.object({
  coachingContractId: z.string().uuid(),
  revalidate: z.string().optional(),
});

export async function genererFactureCoachingAction(
  input: z.input<typeof factureSchema>,
): Promise<CoachingActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = factureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  try {
    const res = await genererFactureCoaching(parsed.data.coachingContractId);
    await logQualiopiActivity({
      action: "qualiopi.coaching.facture.generate",
      targetType: "CoachingContract",
      targetId: parsed.data.coachingContractId,
      changes: { factureId: res.factureId, numero: res.numero },
      session,
    });
    if (parsed.data.revalidate) revalidatePath(parsed.data.revalidate);
    return { ok: true, documentId: res.documentId, numero: res.numero };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de facturation." };
  }
}
