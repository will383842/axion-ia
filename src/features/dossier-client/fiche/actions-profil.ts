"use server";

/**
 * Actions du profil de la fiche (lot B6) : responsable, étiquettes, archivage. Le rôle est
 * REVÉRIFIÉ ici, avant toute lecture ou écriture du dossier : masquer un bouton n'est pas
 * interdire. Archiver et sortir des archives : super-administrateur seul. Rien n'est supprimé.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { messageAffichable } from "@/features/dossier-client/message-affichable";
import { avecMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import { estSuperAdmin, peutEcrire, type RoleAdmin } from "@/server/auth/habilitations";
import { ajouterEtiquette, retirerEtiquette } from "./etiquettes";
import { archiver, definirResponsable, desarchiver, ErreurProfil } from "./profil";

const uuid = z.string().uuid();

/** Ce que les formulaires de « Modifier la fiche » affichent après un envoi. */
export interface EtatProfil {
  readonly message: string | null;
  readonly erreur: string | null;
}

function champ(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

type Acteur = { userId: string; role: RoleAdmin };

/** Rôle revérifié en PREMIER : lecture du dossier et écriture ne viennent qu'après. */
async function acteurEcriture(superAdminSeul: boolean): Promise<Acteur> {
  const acteur = await exigerAccesEchanges();
  if (!peutEcrire(acteur.role)) {
    throw new ErreurProfil("Votre rôle ne permet pas de modifier la fiche.");
  }
  if (superAdminSeul && !estSuperAdmin(acteur.role)) {
    throw new ErreurProfil("Seul le super-administrateur peut archiver ou sortir des archives.");
  }
  return acteur;
}

async function enEtat(
  fd: FormData,
  superAdminSeul: boolean,
  travail: (a: { clientId: string; acteur: Acteur }) => Promise<string>,
): Promise<EtatProfil> {
  try {
    const acteur = await acteurEcriture(superAdminSeul);
    const clientId = champ(fd, "clientId");
    if (!uuid.safeParse(clientId).success) throw new ErreurProfil("Fiche inconnue.");
    const message = await travail({ clientId, acteur });
    revalidatePath(adminPath("fr", `/qualiopi/clients/${clientId}`));
    revalidatePath(adminPath("fr", `/qualiopi/clients/${clientId}/edit`));
    revalidatePath(adminPath("fr", "/qualiopi/clients"));
    return { message, erreur: null };
  } catch (e) {
    return { message: null, erreur: messageAffichable(e) };
  }
}

export async function definirResponsableAction(
  _avant: EtatProfil,
  fd: FormData,
): Promise<EtatProfil> {
  return enEtat(fd, false, async ({ clientId, acteur }) => {
    await definirResponsable(prisma, { clientId, libelle: champ(fd, "responsable"), acteur });
    return champ(fd, "responsable") === "" ? "Responsable retiré." : "Responsable enregistré.";
  });
}

export async function ajouterEtiquetteAction(
  _avant: EtatProfil,
  fd: FormData,
): Promise<EtatProfil> {
  return enEtat(fd, false, async ({ clientId, acteur }) => {
    await ajouterEtiquette(prisma, { clientId, libelle: champ(fd, "libelle"), acteur });
    return "Étiquette ajoutée.";
  });
}

export async function retirerEtiquetteAction(
  _avant: EtatProfil,
  fd: FormData,
): Promise<EtatProfil> {
  return enEtat(fd, false, async ({ clientId, acteur }) => {
    const etiquetteId = champ(fd, "etiquetteId");
    if (!uuid.safeParse(etiquetteId).success) throw new ErreurProfil("Étiquette inconnue.");
    const fait = await retirerEtiquette(prisma, { clientId, etiquetteId, acteur });
    return fait ? "Étiquette retirée." : "Cette étiquette n'était plus sur la fiche.";
  });
}

export async function archiverAction(_avant: EtatProfil, fd: FormData): Promise<EtatProfil> {
  return enEtat(fd, true, async ({ clientId, acteur }) => {
    const issue = await archiver(prisma, {
      clientId,
      motif: champ(fd, "motif"),
      maintenant: new Date(),
      acteur,
    });
    return issue === "deja" ? "Cette fiche est déjà archivée." : "Client archivé.";
  });
}

export async function desarchiverAction(_avant: EtatProfil, fd: FormData): Promise<EtatProfil> {
  return enEtat(fd, true, async ({ clientId, acteur }) => {
    const issue = await desarchiver(prisma, { clientId, acteur });
    return issue === "deja" ? "Cette fiche n'était pas archivée." : "Client sorti des archives.";
  });
}

/** « Sortir des archives » depuis la fiche : retour à la fiche avec un message scellé. */
export async function sortirDesArchivesFormAction(fd: FormData): Promise<void> {
  const clientId = champ(fd, "clientId");
  const repli = adminPath("fr", "/qualiopi/clients");
  if (!uuid.safeParse(clientId).success) redirect(repli);
  const retour = adminPath("fr", `/qualiopi/clients/${clientId}`);
  let url: string;
  try {
    const acteur = await acteurEcriture(true);
    const issue = await desarchiver(prisma, { clientId, acteur });
    url = avecMessageDeRetour(
      retour,
      "message",
      issue === "deja" ? "Cette fiche n'était pas archivée." : "Client sorti des archives.",
    );
  } catch (e) {
    url = avecMessageDeRetour(retour, "erreur", messageAffichable(e));
  }
  redirect(url);
}
