// Relevé mensuel des apporteurs : actions de la console « Préparer », « Recalculer », « Écarter »,
// « Rétablir » (lot 3c). Aucune ne PART vers un apporteur : l'envoi est le bouton du lot 4a.
//
// Même garde que la facturation : `peutEngager(role, "facturer")` (un relevé est une pièce
// financière). Revalidation de l'écran de vérification après chaque geste.

"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { peutEngager } from "@/server/auth/habilitations";

import { periodeValide } from "./periode";
import { ecarterReleve, preparerTranche, recalculerReleve, retablirReleve } from "./preparation";

export type EtatActionReleve =
  { etat: "initial" } | { etat: "ok"; message: string } | { etat: "erreur"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function refusSession(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return "Session expirée : reconnectez-vous.";
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "facturer")) return "Seul un administrateur peut préparer les relevés.";
  return null;
}

function texte(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

function rafraichir(periode: string): void {
  revalidatePath(adminPath("fr", `apporteurs/releves/${periode}`));
  revalidatePath(adminPath("fr", "apporteurs/releves"));
}

export async function preparerRelevesAction(
  _prev: EtatActionReleve,
  fd: FormData,
): Promise<EtatActionReleve> {
  const refus = await refusSession();
  if (refus) return { etat: "erreur", message: refus };
  const periode = texte(fd, "periode");
  if (!periodeValide(periode)) return { etat: "erreur", message: "Période inconnue." };
  try {
    const r = await preparerTranche(periode, new Date());
    rafraichir(periode);
    const echecs = r.echecs.length;
    if (echecs > 0) {
      return {
        etat: "erreur",
        message: `${r.crees} relevé(s) préparé(s), ${echecs} en échec (voir le journal d'erreurs). Reste ${r.reste}.`,
      };
    }
    return {
      etat: "ok",
      message:
        r.reste > 0
          ? `${r.crees} relevé(s) préparé(s). Reste ${r.reste} : cliquez de nouveau.`
          : `${r.crees} relevé(s) préparé(s). Tous les apporteurs attendus ont un relevé.`,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-releve-preparer" } });
    return {
      etat: "erreur",
      message:
        err instanceof Error && /période/i.test(err.message)
          ? err.message
          : "Préparation impossible. Réessayez.",
    };
  }
}

export async function recalculerReleveAction(
  _prev: EtatActionReleve,
  fd: FormData,
): Promise<EtatActionReleve> {
  const refus = await refusSession();
  if (refus) return { etat: "erreur", message: refus };
  const id = texte(fd, "id");
  const periode = texte(fd, "periode");
  if (!UUID.test(id) || !periodeValide(periode))
    return { etat: "erreur", message: "Relevé inconnu." };
  try {
    const r = await recalculerReleve(id, new Date());
    rafraichir(periode);
    if (r === "recalcule") return { etat: "ok", message: "Recalculé." };
    if (r === "inchange") return { etat: "ok", message: "Rien n'a changé." };
    return {
      etat: "erreur",
      message: r === "introuvable" ? "Relevé inconnu." : "Ce relevé n'est plus modifiable.",
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-releve-recalculer" } });
    return { etat: "erreur", message: "Recalcul impossible. Réessayez." };
  }
}

export async function ecarterReleveAction(
  _prev: EtatActionReleve,
  fd: FormData,
): Promise<EtatActionReleve> {
  const refus = await refusSession();
  if (refus) return { etat: "erreur", message: refus };
  const id = texte(fd, "id");
  const periode = texte(fd, "periode");
  if (!UUID.test(id) || !periodeValide(periode))
    return { etat: "erreur", message: "Relevé inconnu." };
  try {
    const r = await ecarterReleve(id, texte(fd, "motif"));
    rafraichir(periode);
    if (r === "ecarte") return { etat: "ok", message: "Écarté." };
    return {
      etat: "erreur",
      message:
        r === "motif_requis" ? "Le motif est obligatoire." : "Ce relevé ne peut plus être écarté.",
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-releve-ecarter" } });
    return { etat: "erreur", message: "Écart impossible. Réessayez." };
  }
}

export async function retablirReleveAction(
  _prev: EtatActionReleve,
  fd: FormData,
): Promise<EtatActionReleve> {
  const refus = await refusSession();
  if (refus) return { etat: "erreur", message: refus };
  const id = texte(fd, "id");
  const periode = texte(fd, "periode");
  if (!UUID.test(id) || !periodeValide(periode))
    return { etat: "erreur", message: "Relevé inconnu." };
  try {
    const ok = await retablirReleve(id);
    rafraichir(periode);
    return ok
      ? { etat: "ok", message: "Rétabli." }
      : { etat: "erreur", message: "Ce relevé n'est pas écarté." };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-releve-retablir" } });
    return { etat: "erreur", message: "Rétablissement impossible. Réessayez." };
  }
}
