/**
 * Action serveur « Facture établie hors console » (fiche client, étape 4, 2026-10-26).
 *
 * Elle vérifie ELLE-MÊME la session et le rôle (`exigerAccesEchanges`, comme les autres actions du
 * dossier client, sans importer le domaine Qualiopi) : une Server Action
 * s'appelle directement. Dans UNE transaction : la ligne `client_factures_hors_console` (la date,
 * corrigeable), puis — seulement si la fiche est un prospect ou a reçu un devis — le passage à
 * « client actif », tracé `client.devient_client`. Le statut ne redescend jamais, rien n'est
 * supprimé, aucun e-mail ne part, l'émission d'une facture n'est jamais touchée.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { dayKeyInParis } from "@/lib/calendar-grid";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { avecMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import {
  statutApresFactureHorsConsole,
  validerJourFacture,
} from "@/features/dossier-client/facture-hors-console";

const uuid = z.string().uuid();

const champ = (fd: FormData, cle: string): string => {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
};

export async function factureHorsConsoleAction(fd: FormData): Promise<void> {
  const clientId = champ(fd, "clientId");
  if (!uuid.safeParse(clientId).success) redirect(adminPath("fr", "qualiopi/clients"));
  const retour = `${adminPath("fr", `qualiopi/clients/${clientId}`)}?onglet=devis-factures`;
  const echec = (texte: string): never => redirect(avecMessageDeRetour(retour, "erreur", texte));

  const session = await exigerAccesEchanges();
  if (champ(fd, "facture_hors_console") !== "1") echec("Cochez la case pour l'enregistrer.");
  const jour = validerJourFacture(champ(fd, "date"), dayKeyInParis(new Date()));
  const jourFacture = jour.ok ? jour.jour : echec(jour.motif);
  const etabliLe = new Date(`${jourFacture}T00:00:00Z`);

  let devenu = false;
  try {
    devenu = await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: { statut: true },
      });
      if (client === null) throw new Error("fiche introuvable");
      await tx.clientFactureHorsConsole.upsert({
        where: { clientId },
        create: { clientId, etabliLe, parAdminId: session.userId },
        update: { etabliLe, parAdminId: session.userId },
      });
      const apres = statutApresFactureHorsConsole(client.statut);
      if (apres === null) return false;
      // Le statut commercial n'est pas un champ transmis à Axion Partners (comme `sendDevisAction`) :
      // pas d'émission. Le cliquet des écrivains de Client le déclare, nommément.
      await tx.client.update({ where: { id: clientId }, data: { statut: apres } });
      await tx.activityLog.create({
        data: {
          adminUserId: session.userId,
          action: "client.devient_client",
          targetType: "Client",
          targetId: clientId,
          changes: {
            origine: "facture_hors_console",
            statutAvant: client.statut,
            statutApres: apres,
            etabliLe: jourFacture,
          },
        },
      });
      return true;
    });
  } catch {
    echec("Fiche introuvable ou enregistrement impossible. Réessayez dans un instant.");
  }
  revalidatePath(adminPath("fr", `qualiopi/clients/${clientId}`));
  redirect(
    avecMessageDeRetour(
      retour,
      "message",
      devenu
        ? "Facture hors console enregistrée : la fiche est maintenant un client."
        : "Facture hors console enregistrée.",
    ),
  );
}
