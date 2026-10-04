/**
 * Lot OPCO A8 — Server Actions du suivi de l'entreprise, depuis `DepotOpcoPanel`.
 *
 *   · « Envoyer le dossier à l'entreprise » — le même envoi que le passage
 *     quotidien (`envoyerDossierEntreprise`), en mode manuel : il peut renvoyer ;
 *   · « Arrêter les relances » — plus aucune relance ni alerte « à appeler » ;
 *   · lecture du PDF d'accord déposé par l'entreprise (URL signée courte).
 *
 * Même habilitation que la saisie du dépôt et de l'accord
 * (`deposer_demande_financeur`). Journal sans adresse ni nom.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSignedUrlR2, isR2Configured, TTL_LECTURE_NOMINATIVE_S } from "@/lib/r2-storage";
import { requireHabilitation, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { envoyerDossierEntreprise } from "@/server/qualiopi/financements/suivi-entreprise/envoi";

const DossierSchema = z.object({ dossierId: z.string().uuid() });

const estStub = () => process.env["DATABASE_URL"]?.includes("stub.invalid") === true;

export async function envoyerDossierEntrepriseAction(
  rawInput: unknown,
): Promise<{ data: { garePourValidation: boolean } } | { error: string }> {
  if (estStub()) return { error: "Indisponible au build." };
  const session = await requireHabilitation("deposer_demande_financeur");
  const parsed = DossierSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  try {
    const r = await envoyerDossierEntreprise({
      dossierId: parsed.data.dossierId,
      mode: "manuel",
      adminUserId: session.userId,
    });
    if (!r.ok) return { error: r.message };
    return { data: { garePourValidation: r.garePourValidation } };
  } catch (err) {
    console.error("[envoyerDossierEntrepriseAction] envoi impossible", err);
    return { error: "Envoi impossible : réessayez plus tard." };
  }
}

export async function arreterRelancesEntrepriseAction(
  rawInput: unknown,
): Promise<{ data: { dossierId: string } } | { error: string }> {
  if (estStub()) return { error: "Indisponible au build." };
  const session = await requireHabilitation("deposer_demande_financeur");
  const parsed = DossierSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const { count } = await prisma.opcoSuiviEntreprise.updateMany({
    where: { dossierId: parsed.data.dossierId, relancesArreteesLe: null },
    data: { relancesArreteesLe: new Date() },
  });
  if (count === 0) return { error: "Aucune relance en cours pour ce dossier." };
  await logQualiopiActivity({
    action: "qualiopi.opco.suivi_entreprise.relances_arretees",
    targetType: "DossierFinancement",
    targetId: parsed.data.dossierId,
    changes: {},
    session,
  });
  return { data: { dossierId: parsed.data.dossierId } };
}

export async function lienAccordEntrepriseAction(
  rawInput: unknown,
): Promise<{ data: { url: string } } | { error: string }> {
  if (estStub()) return { error: "Indisponible au build." };
  await requireHabilitation("deposer_demande_financeur");
  const parsed = DossierSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const suivi = await prisma.opcoSuiviEntreprise.findUnique({
    where: { dossierId: parsed.data.dossierId },
    select: { accordFichierKey: true },
  });
  if (!suivi?.accordFichierKey || !isR2Configured()) return { error: "Aucun accord déposé." };
  const url = await getSignedUrlR2(suivi.accordFichierKey, TTL_LECTURE_NOMINATIVE_S, {
    fichier: { nom: "accord-opco.pdf", disposition: "inline" },
  });
  return { data: { url } };
}
