/**
 * Actions serveur des LIENS PRIVÉS envoyés à un candidat (Candidatures unifiées L5, ADR 0065).
 *
 * 🔴 Chaque action appelle `gardeBibliotheque()` en PREMIÈRE instruction : mêmes
 *    rôles que les dossiers des candidats, refus de `editor` et `reader` DANS
 *    l'action. Chaque geste réussi trace une ligne `ActivityLog` (identifiant du
 *    lien seulement).
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { prolongerLien, retirerLien, type IssueGeste } from "@/server/partages/suivi";

import { gardeBibliotheque } from "./garde";

const idSchema = z.string().uuid();

async function tracer(geste: "prolonge" | "retire", lienId: string, auteurId: string) {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: auteurId,
        action: `lien_partage.${geste}`,
        targetType: "lien_partage",
        targetId: lienId,
      },
    });
  } catch (e) {
    console.warn(`[partages] trace « ${geste} » non écrite :`, (e as Error).message);
  }
}

async function geste(
  lienIdBrut: unknown,
  quoi: "prolonge" | "retire",
): Promise<{ ok: boolean; message: string }> {
  const g = await gardeBibliotheque();
  if (!g.ok) return { ok: false, message: g.erreur };
  const id = idSchema.safeParse(lienIdBrut);
  if (!id.success) return { ok: false, message: "Lien introuvable." };
  const r: IssueGeste =
    quoi === "prolonge" ? await prolongerLien(id.data) : await retirerLien(id.data);
  if (!r.ok) return { ok: false, message: r.erreur };
  await tracer(quoi, id.data, g.auteur.id);
  revalidatePath(adminPath("fr", `contacts/candidatures/${r.applicationId}`));
  return {
    ok: true,
    message:
      quoi === "prolonge" ? "Lien prolongé." : "Lien retiré : la page ne montre plus les fichiers.",
  };
}

/** « Prolonger » : nouvelle date limite à partir d'aujourd'hui (30 jours, 7 avec des rushs). */
export async function prolongerLienAction(
  lienId: unknown,
): Promise<{ ok: boolean; message: string }> {
  return geste(lienId, "prolonge");
}

/** « Retirer le lien » : la page devient neutre. Définitif pour ce lien. */
export async function retirerLienAction(
  lienId: unknown,
): Promise<{ ok: boolean; message: string }> {
  return geste(lienId, "retire");
}
