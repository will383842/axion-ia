"use server";

/**
 * Porte qualité : lecture pour l'écran de console (Q8) et enregistrement des réglages (Q14).
 * Les réglages n'agissent que sur la notation en ombre tant que le point final (Q10) n'est
 * pas allumé : rien ne change sur le site public. La liste des interdits n'a AUCUNE écriture.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "./_auth";
import { writeContentGenConfig } from "./_settings";
import { readContentGenConfigDirect } from "@/server/content-gen/config-store";
import {
  lireVuePorte,
  lireVueReglagesJournal,
  type VueReglagesJournal,
} from "@/server/content-gen/porte-qualite-io";
import {
  CLE_CONFIG_PORTE,
  fusionnerReglages,
  type VuePorte,
} from "@/server/content-gen/porte-qualite";

export async function getVuePorteQualite(): Promise<VuePorte> {
  await requireAdmin();
  return lireVuePorte();
}

export async function getVueReglagesJournal(): Promise<VueReglagesJournal> {
  await requireAdmin();
  return lireVueReglagesJournal();
}

/** Formulaire de l'onglet 4 : validé par le schéma Zod unique du back-end, tracé au journal d'audit. */
export async function enregistrerReglagesPorte(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const saisie: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") saisie[k] = v;
  // Lecture qui lève : une panne ne doit jamais faire écraser la config (phase, plafond) par des défauts.
  const existante = await readContentGenConfigDirect<unknown>(CLE_CONFIG_PORTE, {});
  const r = fusionnerReglages(existante, saisie);
  const prefixe = process.env.ADMIN_URL_PREFIX ?? "admin";
  const retour = `/fr/${prefixe}/content-gen/porte-qualite?onglet=reglages`;
  if (!r.ok) {
    redirect(`${retour}&erreur=${encodeURIComponent(r.erreurs.join(" ; ").slice(0, 300))}`);
  }
  await writeContentGenConfig(
    CLE_CONFIG_PORTE,
    r.config,
    session.userId,
    "Porte qualité — réglages modifiés depuis l'écran de la console",
  );
  revalidatePath(retour);
  redirect(`${retour}&etat=ok`);
}
