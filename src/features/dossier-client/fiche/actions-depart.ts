"use server";

/**
 * Actions « Noter le départ » / « Annuler le départ » (lot B5). Le rôle est REVÉRIFIÉ ici : masquer
 * un bouton n'est pas interdire. Rien n'est supprimé, aucun message n'est envoyé.
 */

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { messageAffichable } from "@/features/dossier-client/message-affichable";
import { avecMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import { annulerDepart, noterDepart } from "./depart-personne";

const uuid = z.string().uuid();

function champ(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

async function agir(
  fd: FormData,
  travail: (a: {
    contactId: string;
    clientId: string;
    acteur: { userId: string; role: Awaited<ReturnType<typeof exigerAccesEchanges>>["role"] };
  }) => Promise<string>,
): Promise<void> {
  const clientId = champ(fd, "clientId");
  const contactId = champ(fd, "contactId");
  const repli = adminPath("fr", "/qualiopi/clients");
  if (!uuid.safeParse(clientId).success || !uuid.safeParse(contactId).success) redirect(repli);
  const retour = `${adminPath("fr", `/qualiopi/clients/${clientId}`)}?onglet=personnes`;
  let url: string;
  try {
    const acteur = await exigerAccesEchanges();
    const message = await travail({ contactId, clientId, acteur });
    url = avecMessageDeRetour(retour, "message", message);
  } catch (e) {
    url = avecMessageDeRetour(retour, "erreur", messageAffichable(e));
  }
  redirect(url);
}

export async function noterDepartFormAction(fd: FormData): Promise<void> {
  await agir(fd, async ({ contactId, clientId, acteur }) => {
    await noterDepart(prisma, {
      contactId,
      clientId,
      partiLe: champ(fd, "partiLe"),
      maintenant: new Date(),
      acteur,
    });
    return "Départ noté. La personne reste sur la fiche ; plus aucun envoi ne lui sera fait.";
  });
}

export async function annulerDepartFormAction(fd: FormData): Promise<void> {
  await agir(fd, async ({ contactId, clientId, acteur }) => {
    await annulerDepart(prisma, { contactId, clientId, acteur });
    return "Départ annulé : la personne est de nouveau active.";
  });
}
