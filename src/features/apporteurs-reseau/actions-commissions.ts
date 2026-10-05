// Réseau d'apporteurs (démarrage manuel) — actions de la console sur les COMMISSIONS.
//
// L'argent qui sort : même garde que la facturation (`peutEngager(role, "facturer")`,
// super-admin et admin). « Marquer versé » exige `confirmer=oui`, posé par le bouton de
// confirmation seulement.

"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { peutEngager } from "@/server/auth/habilitations";

import { marquerVerse, qualifierCommission } from "./commissions";
import { euros } from "./regles";

export type EtatActionCommission =
  { etat: "initial" } | { etat: "ok"; message: string } | { etat: "erreur"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sessionArgent(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return "Session expirée : reconnecte-toi.";
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "facturer")) return "Seul un administrateur peut toucher aux commissions.";
  return null;
}

function texte(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

export async function qualifierCommissionAction(
  _prev: EtatActionCommission,
  fd: FormData,
): Promise<EtatActionCommission> {
  const refus = await sessionArgent();
  if (refus) return { etat: "erreur", message: refus };
  const id = texte(fd, "id");
  if (!UUID.test(id)) return { etat: "erreur", message: "Commission inconnue." };
  try {
    const r = await qualifierCommission(id, texte(fd, "palier"));
    if (!r.ok) return { etat: "erreur", message: r.message };
    revalidatePath(adminPath("fr", "apporteurs/commissions"));
    return { etat: "ok", message: `Qualifiée : ${euros(r.montantCents)}.` };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-commission-qualifier" } });
    return { etat: "erreur", message: "Qualification impossible. Réessaie." };
  }
}

export async function marquerVerseAction(
  _prev: EtatActionCommission,
  fd: FormData,
): Promise<EtatActionCommission> {
  const refus = await sessionArgent();
  if (refus) return { etat: "erreur", message: refus };
  const apporteurId = texte(fd, "apporteurId");
  if (!UUID.test(apporteurId)) return { etat: "erreur", message: "Apporteur inconnu." };
  if (texte(fd, "confirmer") !== "oui")
    return { etat: "erreur", message: "Confirme d'abord le virement." };
  try {
    const r = await marquerVerse(apporteurId);
    if (!r.ok) return { etat: "erreur", message: r.message };
    revalidatePath(adminPath("fr", "apporteurs/commissions"));
    const mail =
      r.envoi === "envoye" || r.envoi === "en-validation"
        ? "relevé envoyé"
        : `relevé NON parti (${r.envoi})`;
    return {
      etat: "ok",
      message: `${euros(r.totalCents)} versés, autofacture ${r.numero}, ${mail}.`,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-commission-verser" } });
    return {
      etat: "erreur",
      message: err instanceof Error ? err.message : "Versement impossible. Réessaie.",
    };
  }
}
