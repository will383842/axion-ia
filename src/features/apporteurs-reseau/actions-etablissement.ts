"use server";

// « Étendre à toute l'entreprise » (contrat 2.6, art. 3.1 ; décision de Will, 09/10/2026) :
// l'apporteur qui a rencontré la direction d'une entreprise le demande à Williams, qui seul
// décide. Réservé aux ADMINISTRATEURS, journalisé (`etendreALEntreprise`).

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { etendreALEntreprise } from "./etablissement-presentation";
import type { EtatAction } from "./actions-presentations";

const ROLES = new Set(["super_admin", "admin"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function etendreALEntrepriseAction(
  _prev: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const session = await auth();
  if (!session?.user?.id) return { etat: "erreur", message: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role ?? "";
  if (!ROLES.has(role)) return { etat: "erreur", message: "Réservé aux administrateurs." };
  const brut = fd.get("id");
  const id = typeof brut === "string" ? brut.trim().toLowerCase() : "";
  if (!UUID.test(id)) return { etat: "erreur", message: "Identifiant invalide." };
  try {
    const r = await etendreALEntreprise(id, session.user.id);
    if (!r.ok) return { etat: "erreur", message: r.message };
    revalidatePath(adminPath("fr", "apporteurs/entreprises"));
    return {
      etat: "ok",
      message:
        "Attribution étendue à toute l'entreprise (les établissements déjà attribués à d'autres restent les leurs).",
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "etendre-a-l-entreprise" } });
    return { etat: "erreur", message: "L'extension a échoué. Réessayez dans un instant." };
  }
}
