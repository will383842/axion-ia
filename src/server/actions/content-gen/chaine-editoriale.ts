"use server";

/** Chaîne éditoriale IA : lecture seule pour l'écran de console (C14). Aucune écriture. */

import { requireAdmin } from "./_auth";
import { lireVueChaine } from "@/server/content-gen/chaine/vue-console-io";
import type { VueChaine } from "@/server/content-gen/chaine/vue-console";

export async function getVueChaineEditoriale(periodeJours: number): Promise<VueChaine> {
  await requireAdmin();
  const p = Number.isFinite(periodeJours)
    ? Math.min(Math.max(Math.trunc(periodeJours), 7), 180)
    : 30;
  return lireVueChaine(p);
}
