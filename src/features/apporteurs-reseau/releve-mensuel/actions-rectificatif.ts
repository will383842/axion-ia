// Relevé mensuel des apporteurs : action de la fiche « Établir un relevé rectificatif » (lot 4b).
// Crée une ligne `prepare` ; n'envoie RIEN. Garde : `peutEngager(role, "facturer")`.

"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { peutEngager } from "@/server/auth/habilitations";

import { etablirRectificatif } from "./rectificatif";

export type EtatActionRectificatif =
  { etat: "initial" } | { etat: "ok"; message: string } | { etat: "erreur"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function etablirRectificatifAction(
  _prev: EtatActionRectificatif,
  fd: FormData,
): Promise<EtatActionRectificatif> {
  const session = await auth();
  if (!session?.user?.id) return { etat: "erreur", message: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "facturer")) {
    return { etat: "erreur", message: "Seul un administrateur peut établir un rectificatif." };
  }
  const id = String(fd.get("id") ?? "").trim();
  if (!UUID.test(id)) return { etat: "erreur", message: "Relevé inconnu." };
  try {
    const r = await etablirRectificatif(id, new Date());
    if (!r.ok) return { etat: "erreur", message: r.message };
    revalidatePath(adminPath("fr", "apporteurs/releves"));
    return {
      etat: "ok",
      message: `Rectificatif ${r.numero} préparé. Il n'est pas envoyé : vérifiez son PDF.`,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-releve-rectificatif" } });
    return { etat: "erreur", message: "Rectificatif impossible. Réessayez." };
  }
}
