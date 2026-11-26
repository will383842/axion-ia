"use server";

/**
 * Réseau d'apporteurs — « Changer le régime de TVA à compter du JJ/MM/AAAA » depuis la fiche de la
 * console (contrat 2.8, art. 4.7 et 6.3). Réservé au droit « contresigner », contrôlé ICI côté
 * serveur. Voir `regime-tva.ts` pour les règles.
 */

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { peutEngager } from "@/server/auth/habilitations";

import {
  annulerChangementAVenir,
  changerRegimeTva,
  jourDepuisSaisie,
  piecesEmisesDepuis,
  type PieceEmiseDepuis,
  type ResultatChangement,
} from "./regime-tva";
import { jourParis } from "./autofacture-donnees";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function acteur(): Promise<{ id: string } | { erreur: string }> {
  const session = await auth();
  if (!session?.user?.id) return { erreur: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role ?? "";
  if (!peutEngager(role, "contresigner")) return { erreur: "Réservé aux administrateurs." };
  return { id: session.user.id };
}

function rafraichir(apporteurId: string): void {
  revalidatePath("/[locale]/[adminPrefix]/apporteurs", "page");
  revalidatePath(`/[locale]/[adminPrefix]/apporteurs/${apporteurId}`, "page");
}

export async function changerRegimeTvaAction(input: {
  apporteurId: string;
  regimeTva: string;
  numeroTva?: string;
  effetAu: string;
  confirmePiecesEmises?: boolean;
}): Promise<ResultatChangement> {
  const a = await acteur();
  if ("erreur" in a) return { ok: false, message: a.erreur };
  if (!UUID.test(input.apporteurId)) return { ok: false, message: "Apporteur inconnu." };
  if (input.regimeTva !== "assujetti" && input.regimeTva !== "franchise_293b")
    return { ok: false, message: "Choisissez un régime de TVA." };
  try {
    const r = await changerRegimeTva({
      apporteurId: input.apporteurId,
      regimeTva: input.regimeTva,
      numeroTva: input.numeroTva ? String(input.numeroTva) : null,
      effetAu: String(input.effetAu ?? ""),
      acteurId: a.id,
      confirmePiecesEmises: input.confirmePiecesEmises === true,
    });
    if (r.ok) rafraichir(input.apporteurId);
    return r;
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-changer-regime-tva" } });
    return { ok: false, message: "Le changement n'a pas pu être enregistré. Réessayez." };
  }
}

export async function annulerChangementRegimeTvaAction(input: {
  apporteurId: string;
  changementId: string;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const a = await acteur();
  if ("erreur" in a) return { ok: false, message: a.erreur };
  if (!UUID.test(input.apporteurId) || !UUID.test(input.changementId))
    return { ok: false, message: "Changement inconnu." };
  try {
    const r = await annulerChangementAVenir({
      changementId: input.changementId,
      apporteurId: input.apporteurId,
      acteurId: a.id,
    });
    if (r.ok) rafraichir(input.apporteurId);
    return r;
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-annuler-regime-tva" } });
    return { ok: false, message: "L'annulation n'a pas pu être enregistrée. Réessayez." };
  }
}

/** Aperçu avant enregistrement : les pièces déjà émises depuis la date (elles restent au régime d'alors). */
export async function piecesEmisesDepuisAction(input: {
  apporteurId: string;
  effetAu: string;
}): Promise<{ ok: true; pieces: PieceEmiseDepuis[] } | { ok: false; message: string }> {
  const a = await acteur();
  if ("erreur" in a) return { ok: false, message: a.erreur };
  if (!UUID.test(input.apporteurId)) return { ok: false, message: "Apporteur inconnu." };
  const jour = jourDepuisSaisie(String(input.effetAu ?? ""));
  if (!jour) return { ok: false, message: "Date invalide : écrivez-la JJ/MM/AAAA." };
  if (jour > jourParis(new Date())) return { ok: true, pieces: [] };
  try {
    return { ok: true, pieces: await piecesEmisesDepuis(input.apporteurId, jour) };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-pieces-emises-depuis" } });
    return { ok: false, message: "Lecture impossible. Réessayez." };
  }
}
