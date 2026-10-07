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
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import {
  apercuDecision,
  appliquerDecision,
  etatDuDossier,
  envoyerLien,
  jugerPiece,
  ouvrirDossierManuel,
  preparerLien,
  renvoyerContratSigne,
  type Decision,
} from "./verification";
import { libererSiPiecesValides } from "./commissions";
import { apercu, type ApercuRendu } from "./envois";
import { refusRattachement, type IdentiteParrainage } from "./parrainage";

export type Retour = { ok: true; message: string } | { ok: false; message: string };
export type RetourApercu =
  { ok: true; email: ApercuRendu; dejaEnvoyeLe?: string | null } | { ok: false; message: string };

const ROLES = new Set(["super_admin", "admin"]);

async function exigerAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return "Session expirée : reconnectez-vous.";
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
  // Pièces de vigilance conformes : les commissions en attente sont libérées TOUT DE SUITE,
  // pas au passage du lendemain.
  if (input.verdict === "conforme") {
    try {
      await libererSiPiecesValides(input.apporteurId);
    } catch (err) {
      Sentry.captureException(err, { tags: { action: "apporteurs-piece", step: "liberation" } });
    }
  }
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
  return { ok: true, email: await apercu(prep.envoi), dejaEnvoyeLe: prep.dejaEnvoyeLe };
}

export async function envoyerLienAction(input: {
  apporteurId: string;
  mot: string | null;
  /** Texte principal réécrit (facultatif). Jamais journalisé. */
  texte?: string | null;
  /** Vrai quand Will a vu « déjà envoyé le … » dans l'aperçu et confirme le renvoi. */
  confirmerRenvoi?: boolean;
}): Promise<Retour> {
  const refus = await exigerAdmin();
  if (refus) return { ok: false, message: refus };
  if (!UUID.test(input.apporteurId)) return { ok: false, message: "Apporteur inconnu." };
  const texte = validerTexteLibre(input.texte);
  if (!texte.ok) return texte;
  const r = await envoyerLien(
    input.apporteurId,
    input.mot,
    texte.texte,
    input.confirmerRenvoi === true,
  );
  rafraichir(input.apporteurId);
  return r;
}

export async function renvoyerContratSigneAction(input: { apporteurId: string }): Promise<Retour> {
  const refus = await exigerAdmin();
  if (refus) return { ok: false, message: refus };
  if (!UUID.test(input.apporteurId)) return { ok: false, message: "Apporteur inconnu." };
  try {
    const r = await renvoyerContratSigne(input.apporteurId);
    rafraichir(input.apporteurId);
    return r;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "apporteurs-decision", step: "renvoi-contrat" },
    });
    return { ok: false, message: "Le renvoi n'a pas pu être préparé." };
  }
}

export type RetourNouvelApporteur =
  | { ok: true; apporteurId: string }
  | {
      ok: false;
      message: string;
      /** Un dossier existe déjà pour cette adresse : pas de doublon, on ouvre sa fiche. */
      existant?: { apporteurId: string; statut: string; dernierLienLe: string | null };
    };

export async function ouvrirDossierManuelAction(input: {
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  submissionId?: string | null;
}): Promise<RetourNouvelApporteur> {
  const refus = await exigerAdmin();
  if (refus) return { ok: false, message: refus };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    return { ok: false, message: "Adresse e-mail invalide." };
  if (input.submissionId && !UUID.test(input.submissionId))
    return { ok: false, message: "Fiche candidat inconnue." };
  const r = await ouvrirDossierManuel({
    prenom: input.prenom.slice(0, 80),
    nom: input.nom.slice(0, 80),
    email: input.email.slice(0, 200),
    telephone: input.telephone?.slice(0, 30) ?? null,
    submissionId: input.submissionId ?? null,
  });
  if (r.ok && r.existait) {
    const { statut, dernierLienLe } = await etatDuDossier(r.apporteurId);
    return {
      ok: false,
      message: `Un dossier existe déjà pour cette adresse (statut : ${statut}${dernierLienLe ? `, dernier lien envoyé le ${dernierLienLe}` : ", aucun lien envoyé"}).`,
      existant: { apporteurId: r.apporteurId, statut, dernierLienLe },
    };
  }
  rafraichir();
  return r.ok ? { ok: true, apporteurId: r.apporteurId } : r;
}

export interface CandidatTrouve {
  submissionId: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  recueLe: string;
}

/**
 * « Nouvel apporteur » : les fiches de candidats apporteurs (non supprimées) dont le nom, le
 * prénom, l'adresse ou le téléphone contient la recherche. Lecture seule, 10 au plus.
 */
export async function rechercherCandidatsApporteursAction(
  recherche: string,
): Promise<{ ok: true; candidats: CandidatTrouve[] } | { ok: false; message: string }> {
  const refus = await exigerAdmin();
  if (refus) return { ok: false, message: refus };
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "");
  const q = norm(recherche.slice(0, 80));
  if (q.length < 2) return { ok: true, candidats: [] };
  const { estApporteur, FILTRE_APPORTEUR_PRISMA } =
    await import("@/lib/commercial-application/est-apporteur");
  const lignes = await prisma.submission.findMany({
    where: { deletedAt: null, ...FILTRE_APPORTEUR_PRISMA },
    orderBy: { submittedAt: "desc" },
    take: 600,
    select: {
      id: true,
      details: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      submittedAt: true,
    },
  });
  const clair = (v: string | null) => {
    try {
      return (v ? decryptPii(v) : null) ?? "";
    } catch {
      return "";
    }
  };
  const candidats: CandidatTrouve[] = [];
  for (const l of lignes) {
    if (!estApporteur(l.details)) continue;
    const nomComplet = clair(l.contactName);
    const email = clair(l.contactEmail);
    const telephone = clair(l.contactPhone);
    if (![nomComplet, email, telephone].some((x) => norm(x).includes(q))) continue;
    const [prenom = "", ...reste] = nomComplet.trim().split(/\s+/);
    candidats.push({
      submissionId: l.id,
      prenom,
      nom: reste.join(" "),
      email,
      telephone,
      recueLe: l.submittedAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }),
    });
    if (candidats.length >= 10) break;
  }
  return { ok: true, candidats };
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
    const choix = { siren: true, email: true, telephone: true, iban: true } as const;
    const [parrain, filleul] = await Promise.all([
      prisma.apporteurReseau.findUnique({
        where: { id: input.parrainId },
        select: { parrainId: true, statut: true, ...choix },
      }),
      prisma.apporteurReseau.findUnique({
        where: { id: input.apporteurId },
        select: choix,
      }),
    ]);
    if (!parrain) return { ok: false, message: "Parrain inconnu." };
    if (parrain.parrainId === input.apporteurId) {
      return { ok: false, message: "Ce parrain est déjà le filleul de cet apporteur." };
    }
    const identite = (a: {
      siren: string | null;
      email: string;
      telephone: string | null;
      iban: string | null;
    }): IdentiteParrainage => ({
      siren: a.siren,
      email: decryptPii(a.email) ?? null,
      telephone: decryptPii(a.telephone) ?? null,
      iban: decryptPii(a.iban) ?? null,
    });
    const refusParrain = filleul
      ? refusRattachement({
          parrainStatut: parrain.statut,
          filleul: identite(filleul),
          parrain: identite(parrain),
        })
      : "Apporteur inconnu.";
    if (refusParrain) return { ok: false, message: refusParrain };
  }
  await prisma.apporteurReseau.update({
    where: { id: input.apporteurId },
    data: { parrainId: input.parrainId },
  });
  rafraichir(input.apporteurId);
  return { ok: true, message: input.parrainId ? "Parrain rattaché." : "Parrain retiré." };
}
