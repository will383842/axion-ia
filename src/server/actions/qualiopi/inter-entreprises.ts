/**
 * Qualiopi — Server Actions inter-entreprises (R-INTER, 3/3).
 *
 * setSessionInterEntreprisesAction : bascule une session en inter-entreprises.
 * setEnrollmentFinancementAction   : définit le financement PAR participant
 *   (override : financeur, payeur, n° dossier, EDOF, dispositif FT, prix de siège).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import type { FinancementType, FranceTravailDispositif } from "../../../../prisma/generated/client";

type ActionResult<T> = { data: T } | { error: string };

const FINANCEMENT_TYPES = ["direct", "opco", "cpf", "france_travail", "mixte"] as const;
const FT_DISPOSITIFS = ["aif", "poei", "csp"] as const;

const setInterSchema = z.object({
  sessionId: z.string().uuid(),
  interEntreprises: z.boolean(),
});

export async function setSessionInterEntreprisesAction(
  input: z.infer<typeof setInterSchema>,
): Promise<ActionResult<{ sessionId: string }>> {
  const session = await requireAdminWrite();
  const parsed = setInterSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, interEntreprises } = parsed.data;

  try {
    await prisma.trainingSession.update({ where: { id: sessionId }, data: { interEntreprises } });
  } catch {
    return { error: "Erreur lors de la mise à jour de la session" };
  }

  await logQualiopiActivity({
    action: "qualiopi.session.inter_entreprises",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { interEntreprises },
    session,
  });

  return { data: { sessionId } };
}

const setEnrollmentFinancementSchema = z.object({
  enrollmentId: z.string().uuid(),
  financementType: z.enum(FINANCEMENT_TYPES).nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  numeroDossierOpco: z.string().max(60).nullable().optional(),
  /** true → pose edofVerifieAt = now ; false → efface. */
  edofVerifie: z.boolean().optional(),
  ftDispositif: z.enum(FT_DISPOSITIFS).nullable().optional(),
  /** Prix HT du siège pour ce participant, en euros (converti en centimes). */
  montantHtEuros: z.number().min(0).nullable().optional(),
});

export async function setEnrollmentFinancementAction(
  input: z.infer<typeof setEnrollmentFinancementSchema>,
): Promise<ActionResult<{ enrollmentId: string }>> {
  const session = await requireAdminWrite();
  const parsed = setEnrollmentFinancementSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const data: {
    financementType?: FinancementType | null;
    clientId?: string | null;
    numeroDossierOpco?: string | null;
    edofVerifieAt?: Date | null;
    ftDispositif?: FranceTravailDispositif | null;
    montantHtCents?: number | null;
  } = {};
  if (v.financementType !== undefined) data.financementType = v.financementType;
  if (v.clientId !== undefined) data.clientId = v.clientId;
  if (v.numeroDossierOpco !== undefined) data.numeroDossierOpco = v.numeroDossierOpco;
  if (v.edofVerifie !== undefined) data.edofVerifieAt = v.edofVerifie ? new Date() : null;
  if (v.ftDispositif !== undefined) data.ftDispositif = v.ftDispositif;
  if (v.montantHtEuros !== undefined)
    data.montantHtCents = v.montantHtEuros === null ? null : Math.round(v.montantHtEuros * 100);

  if (Object.keys(data).length === 0) return { error: "Aucun champ à mettre à jour" };

  try {
    await prisma.enrollment.update({ where: { id: v.enrollmentId }, data });
  } catch {
    return { error: "Erreur lors de la mise à jour du financement de l'inscription" };
  }

  await logQualiopiActivity({
    action: "qualiopi.enrollment.financement",
    targetType: "Enrollment",
    targetId: v.enrollmentId,
    changes: { ...data, edofVerifieAt: data.edofVerifieAt ? "set" : data.edofVerifieAt },
    session,
  });

  return { data: { enrollmentId: v.enrollmentId } };
}
