/**
 * Qualiopi — Server Actions du référentiel offres_site (T1).
 *
 * RBAC (guards knowledge réutilisés) + Zod + audit ActivityLog. Pas de REST.
 * Le prix n'est jamais écrit ici (dérivé pricing.ts). La vérification de
 * cohérence offre ↔ pricing.ts horodate `derniereVerifCoherenceAt` (preuve de
 * la veille catalogue ; alerte si > 30 j gérée en T12/T15).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAdminRead,
  requireAdminWrite,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import { verifyOffreCoherence } from "@/server/qualiopi/offres/pricing-resolver";

type ActionResult<T> = { data: T } | { error: string };

const MODALITES = ["presentiel", "distanciel", "hybride"] as const;

const updateOffreSchema = z.object({
  id: z.string().uuid(),
  titreFr: z.string().min(3).max(200),
  publicViseFr: z.string().min(3),
  promessePrincipaleFr: z.string().min(3),
  anglePedagogiqueFr: z.string().min(2).max(300),
  dureeHeuresMin: z.number().int().min(1).max(200),
  dureeHeuresMax: z.number().int().min(1).max(200),
  modalites: z.array(z.enum(MODALITES)).min(1),
  nbModulesMin: z.number().int().min(1).max(20),
  nbModulesMax: z.number().int().min(1).max(20),
});

/** Met à jour les champs éditoriaux d'une offre (jamais le prix). */
export async function updateOffreAction(
  input: z.infer<typeof updateOffreSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateOffreSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;
  if (v.dureeHeuresMax < v.dureeHeuresMin) return { error: "Durée max < durée min" };
  if (v.nbModulesMax < v.nbModulesMin) return { error: "Nb modules max < min" };

  await prisma.offreSite.update({
    where: { id: v.id },
    data: {
      titreFr: v.titreFr,
      publicViseFr: v.publicViseFr,
      promessePrincipaleFr: v.promessePrincipaleFr,
      anglePedagogiqueFr: v.anglePedagogiqueFr,
      dureeHeuresMin: v.dureeHeuresMin,
      dureeHeuresMax: v.dureeHeuresMax,
      modalites: v.modalites,
      nbModulesMin: v.nbModulesMin,
      nbModulesMax: v.nbModulesMax,
    },
  });
  await logQualiopiActivity({
    action: "qualiopi.offre.update",
    targetType: "OffreSite",
    targetId: v.id,
    changes: v,
    session,
  });
  return { data: { id: v.id } };
}

const toggleSchema = z.object({ id: z.string().uuid(), actif: z.boolean() });

/** Active / désactive une offre (gate publication). */
export async function toggleOffreActifAction(
  input: z.infer<typeof toggleSchema>,
): Promise<ActionResult<{ id: string; actif: boolean }>> {
  const session = await requireAdminWrite();
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  await prisma.offreSite.update({
    where: { id: parsed.data.id },
    data: { actif: parsed.data.actif },
  });
  await logQualiopiActivity({
    action: "qualiopi.offre.toggle_actif",
    targetType: "OffreSite",
    targetId: parsed.data.id,
    changes: { actif: parsed.data.actif },
    session,
  });
  return { data: parsed.data };
}

export interface CoherenceReport {
  checked: number;
  incoherentes: Array<{ id: string; code: string; tierId: string; ecarts: string[] }>;
}

/**
 * Vérifie la cohérence de toutes les offres avec pricing.ts et horodate la
 * vérification. Renvoie les offres incohérentes (tier disparu / tarifType
 * divergent) pour correction.
 */
export async function verifyAllOffresCoherenceAction(): Promise<ActionResult<CoherenceReport>> {
  const session = await requireAdminRead();
  const offres = await prisma.offreSite.findMany({
    select: { id: true, code: true, tierId: true, tarifType: true },
  });
  const incoherentes: CoherenceReport["incoherentes"] = [];
  for (const o of offres) {
    const { ok, ecarts } = verifyOffreCoherence({ tierId: o.tierId, tarifType: o.tarifType });
    if (!ok) incoherentes.push({ id: o.id, code: o.code, tierId: o.tierId, ecarts });
  }
  await prisma.offreSite.updateMany({ data: { derniereVerifCoherenceAt: new Date() } });
  await logQualiopiActivity({
    action: "qualiopi.offre.verify_coherence",
    targetType: "OffreSite",
    changes: { checked: offres.length, incoherentes: incoherentes.length },
    session,
  });
  return { data: { checked: offres.length, incoherentes } };
}
