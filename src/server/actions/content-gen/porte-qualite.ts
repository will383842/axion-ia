"use server";

/** Porte qualité : lecture seule pour l'écran de console (Q8). Aucune écriture. */

import { requireAdmin } from "./_auth";
import { lireVuePorte } from "@/server/content-gen/porte-qualite-io";
import type { VuePorte } from "@/server/content-gen/porte-qualite";

export async function getVuePorteQualite(): Promise<VuePorte> {
  await requireAdmin();
  return lireVuePorte();
}
