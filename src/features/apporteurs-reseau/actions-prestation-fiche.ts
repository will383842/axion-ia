// « Marquer la prestation réalisée » / « Annuler », depuis la fiche d'une ENTREPRISE PRÉSENTÉE
// (contrat 2.3, art. 4.2). Mêmes contrôles et même domaine que l'onglet Commissions
// (`actions-commissions.ts` → `realisation.ts`) ; seule la page de retour change : on revient sur
// la fiche de l'entreprise, avec le message.

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { peutEngager } from "@/server/auth/habilitations";

import { annulerRealisation, marquerPrestationRealisee } from "./realisation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ONGLETS = new Set(["a-traiter", "protegees", "toutes"]);

async function session(): Promise<{ refus: string } | { acteur: string }> {
  const s = await auth();
  if (!s?.user?.id) return { refus: "Session expirée : reconnectez-vous." };
  const role = (s.user as { role?: string }).role;
  if (!peutEngager(role, "facturer"))
    return { refus: "Seul un administrateur peut marquer une prestation réalisée." };
  return { acteur: s.user.id };
}

function texte(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

function retour(fd: FormData, cle: "prestation" | "prestationErreur", message: string): never {
  const onglet = texte(fd, "onglet");
  const q = new URLSearchParams({
    onglet: ONGLETS.has(onglet) ? onglet : "toutes",
    [cle]: message,
  });
  redirect(`${adminPath("fr", "apporteurs/entreprises")}?${q.toString()}`);
}

function rafraichir(): void {
  revalidatePath(adminPath("fr", "apporteurs/entreprises"));
  revalidatePath(adminPath("fr", "apporteurs/commissions"));
}

export async function marquerRealiseeFicheAction(fd: FormData): Promise<void> {
  const s = await session();
  if ("refus" in s) retour(fd, "prestationErreur", s.refus);
  const id = texte(fd, "id");
  if (!UUID.test(id)) retour(fd, "prestationErreur", "Commission inconnue.");
  const jour = texte(fd, "realiseeLe");
  const realiseeLe = /^\d{4}-\d{2}-\d{2}$/.test(jour)
    ? new Date(`${jour}T12:00:00.000Z`)
    : new Date(NaN);
  let r: { ok: true } | { ok: false; message: string };
  try {
    r = await marquerPrestationRealisee(id, realiseeLe, new Date(), s.acteur);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-fiche-prestation-realisee" } });
    r = { ok: false, message: "La réalisation n'a pas pu être enregistrée. Réessayez." };
  }
  rafraichir();
  if (r.ok)
    retour(fd, "prestation", "Prestation marquée réalisée : la commission peut être facturée.");
  retour(fd, "prestationErreur", r.message);
}

export async function annulerRealisationFicheAction(fd: FormData): Promise<void> {
  const s = await session();
  if ("refus" in s) retour(fd, "prestationErreur", s.refus);
  const id = texte(fd, "id");
  if (!UUID.test(id)) retour(fd, "prestationErreur", "Commission inconnue.");
  let r: { ok: true } | { ok: false; message: string };
  try {
    r = await annulerRealisation(id, s.acteur);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-fiche-realisation-annulee" } });
    r = { ok: false, message: "L'annulation n'a pas pu être enregistrée. Réessayez." };
  }
  rafraichir();
  if (r.ok)
    retour(fd, "prestation", "Réalisation annulée : la commission est de nouveau en attente.");
  retour(fd, "prestationErreur", r.message);
}
