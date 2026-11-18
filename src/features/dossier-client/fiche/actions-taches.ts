"use server";

/**
 * Actions « Ajouter une tâche », « Marquer comme faite », « Rouvrir » (lot B3). Le rôle est
 * REVÉRIFIÉ ici avant toute lecture ou écriture : masquer un bouton n'est pas interdire. Rien
 * n'est supprimé, aucun message n'est envoyé.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { messageAffichable } from "@/features/dossier-client/message-affichable";
import { avecMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import { creerTache, marquerFaite, rouvrir } from "./taches";

const uuid = z.string().uuid();

function champ(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

type Acteur = Awaited<ReturnType<typeof exigerAccesEchanges>>;

async function agir(
  fd: FormData,
  travail: (a: { clientId: string; acteur: Acteur }) => Promise<string>,
): Promise<void> {
  const clientId = champ(fd, "clientId");
  const repli = adminPath("fr", "/qualiopi/clients");
  if (!uuid.safeParse(clientId).success) redirect(repli);
  const fiche = adminPath("fr", `/qualiopi/clients/${clientId}`);
  const retour = `${fiche}?onglet=resume`;
  let url: string;
  try {
    // Le rôle est jugé AVANT toute lecture ou écriture du dossier.
    const acteur = await exigerAccesEchanges();
    const message = await travail({ clientId, acteur });
    revalidatePath(fiche);
    url = avecMessageDeRetour(retour, "message", message);
  } catch (e) {
    url = avecMessageDeRetour(retour, "erreur", messageAffichable(e));
  }
  redirect(url);
}

function idFacultatif(fd: FormData, cle: string): string | null {
  const v = champ(fd, cle);
  if (v === "") return null;
  if (!uuid.safeParse(v).success) throw new Error("identifiant invalide");
  return v;
}

export async function ajouterTacheFormAction(fd: FormData): Promise<void> {
  await agir(fd, async ({ clientId, acteur }) => {
    await creerTache(prisma, {
      clientId,
      intitule: champ(fd, "intitule"),
      avantLe: champ(fd, "avantLe"),
      responsable: champ(fd, "responsable"),
      contactId: idFacultatif(fd, "contactId"),
      projetId: idFacultatif(fd, "projetId"),
      acteur,
    });
    return "Tâche ajoutée.";
  });
}

export async function marquerFaiteFormAction(fd: FormData): Promise<void> {
  await agir(fd, async ({ clientId, acteur }) => {
    const tacheId = champ(fd, "tacheId");
    if (!uuid.safeParse(tacheId).success) throw new Error("identifiant invalide");
    const issue = await marquerFaite(prisma, { tacheId, clientId, maintenant: new Date(), acteur });
    return issue === "deja" ? "Tâche déjà faite." : "Tâche marquée comme faite.";
  });
}

export async function rouvrirTacheFormAction(fd: FormData): Promise<void> {
  await agir(fd, async ({ clientId, acteur }) => {
    const tacheId = champ(fd, "tacheId");
    if (!uuid.safeParse(tacheId).success) throw new Error("identifiant invalide");
    const issue = await rouvrir(prisma, { tacheId, clientId, acteur });
    return issue === "deja" ? "Tâche déjà ouverte." : "Tâche rouverte.";
  });
}
