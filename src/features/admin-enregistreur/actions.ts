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
import { creerAppareil, renouvelerAppareil, revoquerAppareil } from "@/server/visio/jeton";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { motifSansAccesEnregistreur } from "./motif";
import { etatJetonCree, type EtatJeton } from "./etat-jeton";

const CHEMIN = "rendez-vous/enregistreur";

export async function creerJetonAction(_prec: EtatJeton, form: FormData): Promise<EtatJeton> {
  try {
    const { userId } = await exigerAccesEchanges(motifSansAccesEnregistreur);
    const nom = String(form.get("nom") ?? "").trim() || "Poste de Williams";
    const cree = await creerAppareil(prisma, { nom, adminUserId: userId, maintenant: new Date() });
    revalidatePath(adminPath("fr", CHEMIN));
    return etatJetonCree(cree.jeton, cree.expireLe);
  } catch (err) {
    return { etat: "erreur", message: err instanceof Error ? err.message : "Création impossible." };
  }
}

/**
 * Renouveler = révoquer l'ancien jeton PUIS en créer un nouveau, même nom,
 * dans une seule transaction ; refusé pour un appareil déjà révoqué (V1, S5).
 */
export async function renouvelerJetonAction(_prec: EtatJeton, form: FormData): Promise<EtatJeton> {
  try {
    const { userId } = await exigerAccesEchanges(motifSansAccesEnregistreur);
    const appareilId = String(form.get("appareilId") ?? "");
    const r = await renouvelerAppareil(prisma, {
      appareilId,
      adminUserId: userId,
      maintenant: new Date(),
    });
    if (!r.ok) return { etat: "erreur", message: r.message };
    revalidatePath(adminPath("fr", CHEMIN));
    return etatJetonCree(r.jeton, r.expireLe);
  } catch (err) {
    return {
      etat: "erreur",
      message: err instanceof Error ? err.message : "Renouvellement impossible.",
    };
  }
}

export async function revoquerJetonAction(form: FormData): Promise<void> {
  await exigerAccesEchanges(motifSansAccesEnregistreur);
  const appareilId = String(form.get("appareilId") ?? "");
  if (appareilId) await revoquerAppareil(prisma, appareilId, new Date());
  revalidatePath(adminPath("fr", CHEMIN));
}
