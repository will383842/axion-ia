"use server";

/**
 * Actions de la page « Enregistreur » (PR 5) : créer, renouveler, révoquer le
 * jeton de l'appareil. Chaque action vérifie ELLE-MÊME la session et le rôle
 * (une action s'appelle directement : masquer un bouton n'est pas interdire).
 *
 * Le jeton en clair n'est rendu qu'une fois, dans la réponse de l'action ; il
 * n'est écrit nulle part (la base n'en garde que l'empreinte).
 */

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { creerAppareil, revoquerAppareil } from "@/server/visio/jeton";
import { exigerAccesEnregistreur } from "./acces";
import type { EtatJeton } from "./etat-jeton";

const CHEMIN = "rendez-vous/enregistreur";

export async function creerJetonAction(_prec: EtatJeton, form: FormData): Promise<EtatJeton> {
  try {
    const { userId } = await exigerAccesEnregistreur();
    const nom = String(form.get("nom") ?? "").trim() || "Poste de Williams";
    const cree = await creerAppareil(prisma, { nom, adminUserId: userId, maintenant: new Date() });
    revalidatePath(adminPath("fr", CHEMIN));
    return { etat: "cree", jeton: cree.jeton, expireLe: cree.expireLe.toISOString() };
  } catch (err) {
    return { etat: "erreur", message: err instanceof Error ? err.message : "Création impossible." };
  }
}

/** Renouveler = révoquer l'ancien jeton et en créer un nouveau, même nom. */
export async function renouvelerJetonAction(_prec: EtatJeton, form: FormData): Promise<EtatJeton> {
  try {
    const { userId } = await exigerAccesEnregistreur();
    const appareilId = String(form.get("appareilId") ?? "");
    const ancien = await prisma.appareilEnregistrement.findUnique({
      where: { id: appareilId },
      select: { id: true, nom: true },
    });
    if (!ancien) return { etat: "erreur", message: "Appareil introuvable." };
    const maintenant = new Date();
    const cree = await creerAppareil(prisma, { nom: ancien.nom, adminUserId: userId, maintenant });
    await revoquerAppareil(prisma, ancien.id, maintenant);
    revalidatePath(adminPath("fr", CHEMIN));
    return { etat: "cree", jeton: cree.jeton, expireLe: cree.expireLe.toISOString() };
  } catch (err) {
    return {
      etat: "erreur",
      message: err instanceof Error ? err.message : "Renouvellement impossible.",
    };
  }
}

export async function revoquerJetonAction(form: FormData): Promise<void> {
  await exigerAccesEnregistreur();
  const appareilId = String(form.get("appareilId") ?? "");
  if (appareilId) await revoquerAppareil(prisma, appareilId, new Date());
  revalidatePath(adminPath("fr", CHEMIN));
}
