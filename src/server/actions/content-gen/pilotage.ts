/**
 * Pilotage SEO & IA — lectures SEULES pour l'écran de la console (P8).
 * Aucune écriture, aucun appel à un fournisseur. Réservé à super_admin, admin et editor (`requireAdmin`) : l'écran montre le texte brut des requêtes.
 */
"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./_auth";
import type { ModelePilotage } from "@/server/seo-pilotage/ecran/modele";
import { lireModelePilotage } from "@/server/seo-pilotage/ecran/lecture";

export async function chargerPilotageSeo(
  options: { type?: string | undefined } = {},
): Promise<ModelePilotage> {
  await requireAdmin();
  return lireModelePilotage({
    prisma,
    type: typeof options.type === "string" ? options.type.slice(0, 40) : undefined,
    aujourdhui: new Date().toISOString().slice(0, 10),
  });
}
