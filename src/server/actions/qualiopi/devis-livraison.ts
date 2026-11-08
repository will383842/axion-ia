"use server";

/**
 * Suivi de livraison d'un devis accepté (Lot 6) : deux boutons, deux jalons
 * (`livraison_debut_at`, `livre_at`). Aucun e-mail, aucune facture, aucune
 * énumération : l'étape est déduite par `etapeSuiviDevis`.
 *
 * Verrou ATOMIQUE par `updateMany` conditionnel : deux clics concurrents (ou
 * deux onglets) → un seul gagne, le second reçoit un refus explicite.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";

type ActionResult<T> = { data: T } | { error: string };

export async function demarrerLivraisonDevisAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  const { count } = await prisma.devis.updateMany({
    where: { id: idParsed.data, statut: "accepte", livraisonDebutAt: null },
    data: { livraisonDebutAt: new Date() },
  });
  if (count === 0) {
    return { error: "Livraison déjà démarrée, ou devis non accepté." };
  }
  await logQualiopiActivity({
    action: "qualiopi.devis.livraison_debut",
    targetType: "Devis",
    targetId: idParsed.data,
    changes: { livraisonDebut: true },
    session,
  });
  return { data: { id: idParsed.data } };
}

export async function marquerDevisLivreAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  const { count } = await prisma.devis.updateMany({
    where: {
      id: idParsed.data,
      statut: { in: ["accepte", "transforme_convention"] },
      livraisonDebutAt: { not: null },
      livreAt: null,
    },
    data: { livreAt: new Date() },
  });
  if (count === 0) {
    return { error: "Livraison non démarrée, ou devis déjà livré." };
  }
  await logQualiopiActivity({
    action: "qualiopi.devis.livre",
    targetType: "Devis",
    targetId: idParsed.data,
    changes: { livre: true },
    session,
  });
  return { data: { id: idParsed.data } };
}
