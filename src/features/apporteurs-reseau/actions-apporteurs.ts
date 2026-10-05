"use server";

/**
 * Réseau d'apporteurs (démarrage manuel) — les actions de la FICHE APPORTEUR de la console :
 * juger une pièce, décider (contresigner, à compléter, refuser), envoyer le lien du
 * dossier, ouvrir un dossier à la main, noter, rattacher un parrain.
 *
 * Réservé aux administrateurs : ces écrans montrent des pièces d'identité et engagent la
 * Société (contresignature).
 */

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { validerTexteLibre } from "@/lib/email/templates/texte-libre-reseau";
import { prisma } from "@/lib/prisma";

import {
  apercuDecision,
  appliquerDecision,
  envoyerLien,
  jugerPiece,
  ouvrirDossierManuel,
  preparerLien,
  type Decision,
} from "./verification";
import { apercu, type ApercuRendu } from "./envois";

export type Retour = { ok: true; message: string } | { ok: false; message: string };
export type RetourApercu = { ok: true; email: ApercuRendu } | { ok: false; message: string };

const ROLES = new Set(["super_admin", "admin"]);

async function exigerAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return "Session expirée : reconnecte-toi.";
  const role = (session.user as { role?: string }).role ?? "";
  if (!ROLES.has(role)) return "Réservé aux administrateurs.";
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECISIONS: readonly Decision[] = ["contresigner", "a_completer", "refuser"];

function rafraichir(apporteurId?: string): void {
  revalidatePath("/[locale]/[adminPrefix]/apporteurs", "page");
  if (apporteurId) revalidatePath(`/[locale]/[adminPrefix]/apporteurs/${apporteurId}`, "page");
}

export async function jugerPieceAction(input: {
  apporteurId: string;
  pieceId: string;
  verdict: "conforme" | "a_retransmettre";
  motif: string | null;
}): Promise<Retour> {
  const refus = await exigerAdmin();
  if (refus) return { ok: false, message: refus };
  if (!UUID.test(input.pieceId) || !UUID.test(input.apporteurId))
    return { ok: false, message: "Pièce inconnue." };
  const piece = await prisma.pieceApporteur.findFirst({
    where: { id: input.pieceId, apporteurId: input.apporteurId },
    select: { id: true },
  });
  if (!piece) return { ok: false, message: "Pièce inconnue." };
  const r = await jugerPiece(input.pieceId, input.verdict, input.motif);
  if (!r.ok) return r;
  rafraichir(input.apporteurId);
  return {
    ok: true,
    message: input.verdict === "conforme" ? "Pièce conforme." : "Pièce à retransmettre.",
  };
}

export async function apercuDecisionAction(input: {
  apporteurId: string;
  decision: Decision;
  note: string | null;
  /** Texte principal réécrit (facultatif). Jamais journalisé. */
  texte?: string | null;
}): Promise<RetourApercu> {
  const refus = await exigerAdmin();
  if (refus) return { ok: false, message: refus };
  if (!UUID.test(input.apporteurId) || !DECISIONS.includes(input.decision))
    return { ok: false, message: "Demande invalide." };
  const texte = validerTexteLibre(input.texte);
  if (!texte.ok) return texte;
  try {
    return await apercuDecision(
      input.apporteurId,
      input.decision,
      (input.note ?? "").slice(0, 2000),
      texte.texte,
    );
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-decision", step: "apercu" } });
    return { ok: false, message: "L'aperçu n'a pas pu être préparé." };
  }
}

export async function appliquerDecisionAction(input: {
  apporteurId: string;
  decision: Decision;
  note: string | null;
  /** Texte principal réécrit (facultatif). Jamais journalisé. */
  texte?: string | null;
}): Promise<Retour> {
  const refus = await exigerAdmin();
  if (refus) return { ok: false, message: refus };
  if (!UUID.test(input.apporteurId) || !DECISIONS.includes(input.decision))
    return { ok: false, message: "Demande invalide." };
  const texte = validerTexteLibre(input.texte);
  if (!texte.ok) return texte;
  try {
    const r = await appliquerDecision(
      input.apporteurId,
      input.decision,
      (input.note ?? "").slice(0, 2000),
      texte.texte,
    );
    rafraichir(input.apporteurId);
    return r;
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-decision", step: "appliquer" } });
    return { ok: false, message: "La décision n'a pas pu être enregistrée." };
  }
}

export async function apercuLienAction(input: {
  apporteurId: string;
  mot: string | null;
  /** Texte principal réécrit (facultatif). Jamais journalisé. */
  texte?: string | null;
}): Promise<RetourApercu> {
  const refus = await exigerAdmin();
  if (refus) return { ok: false, message: refus };
  if (!UUID.test(input.apporteurId)) return { ok: false, message: "Apporteur inconnu." };
  const texte = validerTexteLibre(input.texte);
  if (!texte.ok) return texte;
  const prep = await preparerLien(input.apporteurId, input.mot, texte.texte);
  if (!prep.ok) return prep;
  return { ok: true, email: await apercu(prep.envoi) };
}

export async function envoyerLienAction(input: {
  apporteurId: string;
  mot: string | null;
  /** Texte principal réécrit (facultatif). Jamais journalisé. */
  texte?: string | null;
}): Promise<Retour> {
  const refus = await exigerAdmin();
  if (refus) return { ok: false, message: refus };
  if (!UUID.test(input.apporteurId)) return { ok: false, message: "Apporteur inconnu." };
  const texte = validerTexteLibre(input.texte);
  if (!texte.ok) return texte;
  const r = await envoyerLien(input.apporteurId, input.mot, texte.texte);
  rafraichir(input.apporteurId);
  return r;
}

export async function ouvrirDossierManuelAction(input: {
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
}): Promise<{ ok: true; apporteurId: string } | { ok: false; message: string }> {
  const refus = await exigerAdmin();
  if (refus) return { ok: false, message: refus };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    return { ok: false, message: "Adresse e-mail invalide." };
  const r = await ouvrirDossierManuel({
    prenom: input.prenom.slice(0, 80),
    nom: input.nom.slice(0, 80),
    email: input.email.slice(0, 200),
    telephone: input.telephone?.slice(0, 30) ?? null,
  });
  rafraichir();
  return r;
}

export async function enregistrerNoteAction(input: {
  apporteurId: string;
  note: string;
}): Promise<Retour> {
  const refus = await exigerAdmin();
  if (refus) return { ok: false, message: refus };
  if (!UUID.test(input.apporteurId)) return { ok: false, message: "Apporteur inconnu." };
  await prisma.apporteurReseau.update({
    where: { id: input.apporteurId },
    data: { noteInterne: input.note.slice(0, 5000) || null },
  });
  rafraichir(input.apporteurId);
  return { ok: true, message: "Note enregistrée." };
}

/** Rattache un parrain (un seul niveau, jamais soi-même, jamais un filleul de soi). */
export async function rattacherParrainAction(input: {
  apporteurId: string;
  parrainId: string | null;
}): Promise<Retour> {
  const refus = await exigerAdmin();
  if (refus) return { ok: false, message: refus };
  if (!UUID.test(input.apporteurId)) return { ok: false, message: "Apporteur inconnu." };
  if (input.parrainId !== null) {
    if (!UUID.test(input.parrainId) || input.parrainId === input.apporteurId) {
      return { ok: false, message: "Un apporteur ne peut pas être son propre parrain." };
    }
    const parrain = await prisma.apporteurReseau.findUnique({
      where: { id: input.parrainId },
      select: { parrainId: true, statut: true },
    });
    if (!parrain) return { ok: false, message: "Parrain inconnu." };
    if (parrain.parrainId === input.apporteurId) {
      return { ok: false, message: "Ce parrain est déjà le filleul de cet apporteur." };
    }
  }
  await prisma.apporteurReseau.update({
    where: { id: input.apporteurId },
    data: { parrainId: input.parrainId },
  });
  rafraichir(input.apporteurId);
  return { ok: true, message: input.parrainId ? "Parrain rattaché." : "Parrain retiré." };
}
