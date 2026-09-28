// Interrupteur de la réponse automatique « poste pourvu » — Server Action.
// Le passage lui-même vit dans `server/careers/reponse-poste-pourvu.ts`.

"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { CLE_ACTIVATION } from "@/server/careers/reponse-poste-pourvu";

import { requireAdminWrite } from "./session";

/** Met en marche ou arrête — l'effet est pris au passage horaire suivant. */
export async function basculerReponsePostePourvuAction(formData: FormData): Promise<void> {
  const acteur = await requireAdminWrite();
  const actif = formData.get("actif") === "1";
  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: CLE_ACTIVATION },
      create: {
        key: CLE_ACTIVATION,
        value: { actif },
        description:
          "Réponse automatique « poste pourvu » aux candidatures (console › Candidatures).",
        updatedBy: acteur.userId,
      },
      update: { value: { actif }, updatedBy: acteur.userId },
    }),
    prisma.activityLog.create({
      data: {
        adminUserId: acteur.userId,
        action: actif ? "recrutement.reponse_auto_activee" : "recrutement.reponse_auto_arretee",
        targetType: "setting",
        changes: { cle: CLE_ACTIVATION, actif },
      },
    }),
  ]);
  revalidatePath(adminPath("fr", "contacts/candidatures"));
}
