// Conformité RGPD (console) — « Mettre une adresse à l'écart ».
//
// 🔴 Décision de Williams du 11/11/2026 : une demande d'effacement ne supprime rien, la personne
// est mise à l'écart (`server/rgpd/ecarter-au-lieu-d-effacer.ts`). Ce geste couvre le cas où la
// demande n'arrive par AUCUN des chemins automatiques : e-mail d'une personne non abonnée, demande
// du portail stagiaire, message privé d'un réseau dont l'adresse reste à vérifier (alors posée
// seulement en opposition). Il pose la marque « effacement demandé » : plus AUCUN envoi.
//
// super_admin seulement, revérifié ICI (une action serveur se joint par un simple POST), motif
// obligatoire (sans adresse : il va au journal). La réponse ne répète jamais l'adresse.
// ⛔ Aucune suppression.

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { getClientIp } from "@/lib/client-ip";
import { ecarterPourDemandeEffacement } from "@/server/rgpd/ecarter-au-lieu-d-effacer";

export type EtatEcartAdresse = { ok: true; message: string } | { ok: false; erreur: string } | null;

const schema = z.object({
  email: z.string().trim().max(254).email("Adresse e-mail invalide."),
  motif: z.string().trim().min(3, "Motif obligatoire (3 caractères au moins).").max(500),
});

export async function ecarterAdresseAction(
  _prev: EtatEcartAdresse,
  formData: FormData,
): Promise<EtatEcartAdresse> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return { ok: false, erreur: "Session expirée : reconnectez-vous." };
  if (user.role !== "super_admin") {
    return { ok: false, erreur: "Mise à l'écart d'une adresse réservée super_admin." };
  }
  const parsed = schema.safeParse({ email: formData.get("email"), motif: formData.get("motif") });
  if (!parsed.success) {
    return { ok: false, erreur: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }
  if (parsed.data.motif.toLowerCase().includes(parsed.data.email.toLowerCase())) {
    return { ok: false, erreur: "Le motif ne doit pas contenir l'adresse e-mail." };
  }

  let issue;
  try {
    issue = await ecarterPourDemandeEffacement({
      email: parsed.data.email,
      origine: "console",
      adminUserId: user.id,
      motif: parsed.data.motif,
      ip: await getClientIp(),
    });
  } catch {
    return { ok: false, erreur: "La mise à l'écart a échoué. Réessayez dans un instant." };
  }
  // Une marque ou une opposition qui n'a pas pu être posée n'est PAS « fait ».
  const manque = issue.etapesEnEchec.filter((e) => e === "marque" || e === "opposition");
  if (manque.length > 0) {
    return {
      ok: false,
      erreur: `Mise à l'écart incomplète : ${manque.join(", ")} en échec. Réessayez (rien n'est supprimé).`,
    };
  }

  revalidatePath(adminPath("fr", "conformite-rgpd"));
  return { ok: true, message: "Adresse mise à l'écart : plus aucun envoi. Rien n'a été supprimé." };
}
