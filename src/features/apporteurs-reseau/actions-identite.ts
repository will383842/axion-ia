"use server";

/**
 * Réseau d'apporteurs — « Corriger le nom » sur la fiche apporteur de la console (2026-10-08).
 * Réservé au droit « contresigner », contrôlé ICI côté serveur ; refusé si le contrat est signé
 * (voir `correction-nom.ts`).
 */

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { peutEngager } from "@/server/auth/habilitations";

import { corrigerNomApporteur } from "./correction-nom";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function corrigerNomAction(input: {
  apporteurId: string;
  prenom: string;
  nom: string;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role ?? "";
  if (!peutEngager(role, "contresigner"))
    return { ok: false, message: "Réservé aux administrateurs." };
  if (!UUID.test(input.apporteurId)) return { ok: false, message: "Apporteur inconnu." };
  try {
    const r = await corrigerNomApporteur({
      apporteurId: input.apporteurId,
      prenom: String(input.prenom ?? ""),
      nom: String(input.nom ?? ""),
      acteurId: session.user.id,
    });
    if (r.ok) {
      revalidatePath("/[locale]/[adminPrefix]/apporteurs", "page");
      revalidatePath(`/[locale]/[adminPrefix]/apporteurs/${input.apporteurId}`, "page");
    }
    return r;
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-corriger-nom" } });
    return { ok: false, message: "La correction n'a pas pu être enregistrée. Réessayez." };
  }
}
