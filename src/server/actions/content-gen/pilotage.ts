/**
 * Pilotage SEO & IA — lectures SEULES pour l'écran de la console (P8).
 * Aucune écriture, aucun appel à un fournisseur. Réservé aux rôles admin.
 */
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { peutConsulter } from "@/server/auth/habilitations";
import type { ModelePilotage } from "@/server/seo-pilotage/ecran/modele";
import { lireModelePilotage } from "@/server/seo-pilotage/ecran/lecture";

export async function chargerPilotageSeo(
  options: { type?: string | undefined } = {},
): Promise<ModelePilotage> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  if (!peutConsulter((session.user as { role?: string }).role)) throw new Error("forbidden");
  return lireModelePilotage({
    prisma,
    type: typeof options.type === "string" ? options.type.slice(0, 40) : undefined,
    aujourdhui: new Date().toISOString().slice(0, 10),
  });
}
