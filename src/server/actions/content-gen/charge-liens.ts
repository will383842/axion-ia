"use server";

/**
 * Chargé de liens (PR 18) : lecture et décision humaine sur les occasions proposées.
 * Réservé à l'administration (super_admin / admin ; l'éditeur est refusé). « Valider » ne fait que
 * marquer l'occasion validée : AUCUN e-mail n'est envoyé. Interrupteur éteint : liste vide, refus.
 */

import { z } from "zod";
import { requireAdmin } from "./_auth";
import { equipeEditorialeActive } from "@/server/content-gen/fact-check/equipe-editoriale-drapeau";
import {
  ChargeLiensError,
  changerEtatOccasion,
  roleAutoriseChargeLiens,
} from "@/server/content-gen/equipe/charge-de-liens";
import {
  ecrireOccasions,
  lireOccasions,
  listerArticlesAvecOccasions,
  type ArticleAvecOccasions,
} from "@/server/content-gen/equipe/charge-de-liens-donnees";

async function requireAdminStrict() {
  const s = await requireAdmin();
  if (!roleAutoriseChargeLiens(s.role)) throw new Error("forbidden");
  return s;
}

export async function listerOccasionsLiens(): Promise<ArticleAvecOccasions[]> {
  await requireAdminStrict();
  if (!equipeEditorialeActive()) return [];
  return listerArticlesAvecOccasions();
}

const entree = z
  .object({ jobId: z.string().min(1).max(64), occasionId: z.string().min(1).max(200) })
  .strict();

export type ResultatDecision = { ok: true; message: string } | { ok: false; message: string };

async function decider(brut: unknown, etat: "validee" | "ecartee"): Promise<ResultatDecision> {
  const s = await requireAdminStrict();
  if (!equipeEditorialeActive()) return { ok: false, message: "Fonction désactivée." };
  const p = entree.safeParse(brut);
  if (!p.success) return { ok: false, message: "Entrée invalide." };
  const courant = await lireOccasions(p.data.jobId);
  if (!courant) return { ok: false, message: "Aucune occasion pour cet article." };
  try {
    const occasions = changerEtatOccasion(
      courant.occasions,
      p.data.occasionId,
      etat,
      s.userId,
      new Date(),
    );
    await ecrireOccasions(p.data.jobId, { ...courant, occasions });
  } catch (e) {
    if (e instanceof ChargeLiensError) return { ok: false, message: e.message };
    throw e;
  }
  const message = occasionsMessage(courant.occasions, p.data.occasionId);
  return { ok: true, message: etat === "validee" ? message : "Occasion écartée." };
}

const occasionsMessage = (occ: ReadonlyArray<{ id: string; message: string }>, id: string) =>
  occ.find((o) => o.id === id)?.message ?? "";

/** Marque l'occasion validée et rend le message à copier. N'envoie rien. */
export async function validerOccasionLien(brut: unknown): Promise<ResultatDecision> {
  return decider(brut, "validee");
}

export async function ecarterOccasionLien(brut: unknown): Promise<ResultatDecision> {
  return decider(brut, "ecartee");
}
