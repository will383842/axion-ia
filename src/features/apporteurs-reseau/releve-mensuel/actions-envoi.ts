// Relevé mensuel des apporteurs : actions de la console « Envoyer les relevés à tout le monde » et
// « Renvoyer les échecs » (lot 4a). SEUL chemin d'envoi vers les apporteurs : un clic du dirigeant,
// jamais automatique (D3, D7).
//
// Garde : `peutEngager(role, "facturer")`. Confirmation par saisie de `AAAA-MM`.

"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { peutEngager } from "@/server/auth/habilitations";

import { envoyerLot, type ModeLot } from "./envoi";
import { periodeValide } from "./periode";

export type EtatActionEnvoi =
  { etat: "initial" } | { etat: "ok"; message: string } | { etat: "erreur"; message: string };

async function agir(fd: FormData, mode: ModeLot): Promise<EtatActionEnvoi> {
  const session = await auth();
  if (!session?.user?.id) return { etat: "erreur", message: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "facturer")) {
    return { etat: "erreur", message: "Seul un administrateur peut envoyer les relevés." };
  }
  const periode = String(fd.get("periode") ?? "").trim();
  if (!periodeValide(periode)) return { etat: "erreur", message: "Période inconnue." };
  if (mode === "tous" && String(fd.get("confirmation") ?? "").trim() !== periode) {
    return { etat: "erreur", message: `Saisissez ${periode} pour confirmer l'envoi.` };
  }
  try {
    const r = await envoyerLot({ periode, declenchePar: `console:${session.user.id}`, mode });
    revalidatePath(adminPath("fr", `apporteurs/releves/${periode}`));
    revalidatePath(adminPath("fr", "apporteurs/releves"));
    return r.ok
      ? { etat: r.nbEchecs + r.nbBloques > 0 ? "erreur" : "ok", message: r.message }
      : { etat: "erreur", message: r.message };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: `apporteurs-releve-envoi-${mode}` } });
    return {
      etat: "erreur",
      message:
        err instanceof Error && /période/i.test(err.message)
          ? err.message
          : "Envoi impossible. Réessayez.",
    };
  }
}

export async function envoyerATousAction(
  _prev: EtatActionEnvoi,
  fd: FormData,
): Promise<EtatActionEnvoi> {
  return agir(fd, "tous");
}

export async function renvoyerEchecsAction(
  _prev: EtatActionEnvoi,
  fd: FormData,
): Promise<EtatActionEnvoi> {
  return agir(fd, "echecs");
}
