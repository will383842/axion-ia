"use server";

/**
 * Actions « Ajouter une note » / « Épingler » / « Détacher » (lot B4). Le rôle est REVÉRIFIÉ ici,
 * avant toute lecture : masquer un bouton n'est pas interdire. Le texte d'une note ne revient
 * jamais dans l'adresse de retour.
 */

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { messageAffichable } from "@/features/dossier-client/message-affichable";
import { avecMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import {
  AUTEUR_PAR_DEFAUT,
  ajouterNote,
  basculerEpingle,
  ErreurNoteFiche,
  type BaseNotes,
} from "./notes";

const uuid = z.string().uuid();

function champ(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

async function agir(
  fd: FormData,
  travail: (a: {
    clientId: string;
    acteur: { userId: string; auteurLabel: string };
  }) => Promise<string>,
): Promise<void> {
  const clientId = champ(fd, "clientId");
  const repli = adminPath("fr", "/qualiopi/clients");
  if (!uuid.safeParse(clientId).success) redirect(repli);
  const retour = `${adminPath("fr", `/qualiopi/clients/${clientId}`)}?onglet=resume`;
  let url: string;
  try {
    const acces = await exigerAccesEchanges();
    const admin = await prisma.adminUser.findUnique({
      where: { id: acces.userId },
      select: { name: true },
    });
    const prenom = admin?.name.trim().split(/\s+/)[0] ?? "";
    const auteurLabel = (prenom === "" ? AUTEUR_PAR_DEFAUT : prenom).slice(0, 80);
    const message = await travail({ clientId, acteur: { userId: acces.userId, auteurLabel } });
    url = avecMessageDeRetour(retour, "message", message);
  } catch (e) {
    // Les erreurs de ce lot (ErreurNoteFiche) ne portent jamais le texte d'une note.
    url = avecMessageDeRetour(
      retour,
      "erreur",
      e instanceof ErreurNoteFiche ? e.message : messageAffichable(e),
    );
  }
  redirect(url);
}

const base = (): BaseNotes => prisma as unknown as BaseNotes;

export async function ajouterNoteFormAction(fd: FormData): Promise<void> {
  await agir(fd, async ({ clientId, acteur }) => {
    const projetBrut = champ(fd, "projetId");
    if (projetBrut !== "" && !uuid.safeParse(projetBrut).success) {
      throw new ErreurNoteFiche("Cette prestation n'existe pas.");
    }
    await ajouterNote(base(), {
      clientId,
      texte: champ(fd, "texte"),
      projetId: projetBrut === "" ? null : projetBrut,
      acteur,
    });
    return "Note ajoutée.";
  });
}

export async function basculerEpingleFormAction(fd: FormData): Promise<void> {
  await agir(fd, async ({ clientId, acteur }) => {
    const noteId = champ(fd, "noteId");
    if (!uuid.safeParse(noteId).success)
      throw new ErreurNoteFiche("Note introuvable sur cette fiche.");
    const { epinglee } = await basculerEpingle(base(), { clientId, noteId, acteur });
    return epinglee ? "Note épinglée." : "Note détachée.";
  });
}
