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
import {
  etatJetonCree,
  FORMAT_NONCE_LIAISON,
  type EtatJeton,
  type EtatLiaison,
} from "./etat-jeton";

const CHEMIN = "rendez-vous/enregistreur";

export async function creerJetonAction(_prec: EtatJeton, form: FormData): Promise<EtatJeton> {
  try {
    const { userId } = await exigerAccesEchanges(motifSansAccesEnregistreur);
    const nom = String(form.get("nom") ?? "").trim() || "Poste de Williams";
    const cree = await creerAppareil(prisma, { nom, adminUserId: userId, maintenant: new Date() });
    // PAS de `revalidatePath` (constat du 02/10) : le re-rendu démontait le
    // formulaire et perdait le jeton avant qu'il soit affiché. La liste se met
    // à jour par le lien « actualiser la liste » sous le jeton.
    return etatJetonCree(cree.jeton);
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
    // Pas de `revalidatePath` : même raison que la création.
    return etatJetonCree(r.jeton);
  } catch (err) {
    return {
      etat: "erreur",
      message: err instanceof Error ? err.message : "Renouvellement impossible.",
    };
  }
}

/**
 * « Relier » (extension 1.4.0) : crée le jeton d'un poste, sans date de fin,
 * et le rend avec le nonce de liaison — la page le pose dans un élément masqué
 * que le relais de l'extension transmet à son service worker. Pas de
 * `revalidatePath` (même raison que la création).
 */
export async function relierPosteAction(_prec: EtatLiaison, form: FormData): Promise<EtatLiaison> {
  try {
    const { userId } = await exigerAccesEchanges(motifSansAccesEnregistreur);
    const nonce = String(form.get("nonce") ?? "");
    if (!FORMAT_NONCE_LIAISON.test(nonce)) {
      return {
        etat: "erreur",
        message: "Lien de liaison invalide : relancez « Relier à ma console » depuis l'extension.",
      };
    }
    const nom = String(form.get("nom") ?? "").trim() || "Poste de Williams";
    const cree = await creerAppareil(prisma, { nom, adminUserId: userId, maintenant: new Date() });
    return { etat: "relie", nonce, jeton: cree.jeton };
  } catch (err) {
    return { etat: "erreur", message: err instanceof Error ? err.message : "Liaison impossible." };
  }
}

export async function revoquerJetonAction(form: FormData): Promise<void> {
  await exigerAccesEchanges(motifSansAccesEnregistreur);
  const appareilId = String(form.get("appareilId") ?? "");
  if (appareilId) await revoquerAppareil(prisma, appareilId, new Date());
  revalidatePath(adminPath("fr", CHEMIN));
}
