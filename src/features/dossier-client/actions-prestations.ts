/**
 * Action serveur du suivi des prestations (fiche client, étape 3, 2026-10-26) : Will note le type,
 * l'étape et le montant d'une prestation. Elle vérifie ELLE-MÊME la session et le rôle
 * (`exigerAccesEchanges`) : une Server Action s'appelle directement. Le projet doit appartenir à
 * la fiche indiquée. Rien n'est supprimé : une nouvelle saisie remplace la précédente.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { avecMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import {
  estEtapePrestation,
  estTypePrestation,
  eurosEnCentimes,
  messageMontantInvalide,
} from "@/features/dossier-client/prestations";

const uuid = z.string().uuid();

const champ = (fd: FormData, cle: string): string => {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
};

export async function enregistrerSuiviPrestationAction(fd: FormData): Promise<void> {
  const clientId = champ(fd, "clientId");
  if (!uuid.safeParse(clientId).success) redirect(adminPath("fr", "qualiopi/clients"));
  const retour = `${adminPath("fr", `qualiopi/clients/${clientId}`)}?onglet=prestations&bloc=suivi`;
  const echec = (texte: string): never => redirect(avecMessageDeRetour(retour, "erreur", texte));
  const session = await exigerAccesEchanges();

  const projetId = champ(fd, "projetId");
  if (!uuid.safeParse(projetId).success) echec("Prestation inconnue.");
  const type = champ(fd, "type");
  if (!estTypePrestation(type)) echec("Choisissez le type de la prestation.");
  const etape = champ(fd, "etape");
  // Vide = « calculée » : on retire le forçage, rien d'autre.
  if (etape !== "" && !estEtapePrestation(etape)) echec("Cette étape n'existe pas.");
  const saisieMontant = champ(fd, "montant");
  const montant = eurosEnCentimes(saisieMontant);
  if (montant === undefined) echec(messageMontantInvalide(saisieMontant));

  const projet = await prisma.projet.findUnique({
    where: { id: projetId },
    select: { clientId: true },
  });
  if (projet === null || projet.clientId !== clientId) echec("Prestation inconnue.");

  const donnees = { type, etapeForcee: etape === "" ? null : etape, montantCents: montant ?? null };
  try {
    await prisma.$transaction(async (tx) => {
      const avant = await tx.projetSuivi.findUnique({
        where: { projetId },
        select: { type: true, etapeForcee: true, montantCents: true },
      });
      await tx.projetSuivi.upsert({
        where: { projetId },
        create: { projetId, ...donnees },
        update: donnees,
      });
      await tx.activityLog.create({
        data: {
          adminUserId: session.userId,
          action: "prestation.suivi_modifie",
          targetType: "projet",
          targetId: projetId,
          changes: {
            avant: avant ?? null,
            apres: {
              type: donnees.type,
              etapeForcee: donnees.etapeForcee,
              montantCents: donnees.montantCents,
            },
          },
        },
      });
    });
  } catch {
    echec("L'enregistrement n'a pas pu être fait. Réessayez dans un instant.");
  }
  revalidatePath(adminPath("fr", `qualiopi/clients/${clientId}`));
  redirect(avecMessageDeRetour(retour, "message", "Prestation enregistrée."));
}
