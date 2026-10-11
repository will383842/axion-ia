/**
 * Formateurs indépendants — les E-MAILS DU DOSSIER (lot L6, catalogue F8 à F15).
 *
 * Tous passent par l'adaptateur `envois.ts` : rien ne part sans le texte VALIDÉ
 * (`textes_valides` + registre), ni après une fin de collaboration. Chaque envoi a sa clé
 * d'idempotence (`fi-…`, sans adresse).
 *
 *   - F8  `formateur-dossier-lien`        : « Renvoyer le lien » (console). La version
 *         d'accès est incrémentée : les liens déjà envoyés sont révoqués ;
 *   - F11 alerte interne                  : à l'envoi du dossier, Telegram MINIMISÉ
 *         (identifiant court, couleur du registre, lien console) ;
 *   - F12 `formateur-dossier-a-completer` : « Demander un complément » (console), motif
 *         d'une liste FERMÉE ; le dossier est rouvert avec un NOUVEAU lien ;
 *   - F15 `formateur-statut-non-ouvert`   : une seule fois par fiche.
 *
 * Ni F10 (sa pièce jointe est la copie du contrat signé : signature pas encore livrée),
 * ni F13 (aucun état « refusé » n'existe encore pour le dossier) : voir le rapport du lot.
 *
 * 🔴 Les écritures sont conditionnelles ; le journal ne porte que des identifiants.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { dejaTente } from "@/server/relances/passer-campagnes";

import { envoyer, texteValide, type ResultatEnvoiFormateur } from "./envois";
import { lireDrapeauEnvoi } from "./interrupteurs";
import { lireEtatsInterrupteurs } from "./interrupteurs-etat";
import { urlDossierFormateur } from "./jeton-dossier";

/** Les motifs FERMÉS d'une demande de complément (F12), tels qu'écrits dans l'e-mail. */
export const MOTIFS_COMPLEMENT = {
  attestation_urssaf: "une attestation URSSAF de moins de 6 mois",
  code_urssaf: "le code de sécurité de votre attestation URSSAF",
  rib: "un RIB lisible, au nom de votre activité",
  cv: "votre CV à jour",
  recepisse: "le récépissé de votre déclaration d'activité",
  siret: "le numéro SIRET de votre activité",
} as const;

export type MotifComplement = keyof typeof MOTIFS_COMPLEMENT;

export function estMotifComplement(v: unknown): v is MotifComplement {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(MOTIFS_COMPLEMENT, v);
}

export type ResultatDossier =
  | { ok: true; envoi: ResultatEnvoiFormateur }
  | { ok: false; raison: "eteint" | "texte-non-valide" | "etat" };

const FICHE_OUVERTE = {
  statut: "sous_traitant",
  finCollaborationAt: null,
  organismeSousTraitantId: null,
} as const;

async function dossierOuvert(): Promise<boolean> {
  return lireDrapeauEnvoi(await lireEtatsInterrupteurs(), "dossier_en_ligne");
}

/**
 * Incrémente la version d'accès si la fiche est dans l'un de ces états, et passe
 * éventuellement le dossier à un nouvel état. Rend la fiche relue, ou `null`.
 */
async function nouvelleVersion(
  trainerId: string,
  depuis: ReadonlyArray<"en_cours" | "a_completer" | "a_verifier">,
  vers: "en_cours" | "a_completer" | null,
  action: string,
  parId: string,
  changes: Record<string, unknown>,
) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.trainer.updateMany({
      where: { id: trainerId, ...FICHE_OUVERTE, dossierStatut: { in: [...depuis] } },
      data: { accesVersion: { increment: 1 }, ...(vers ? { dossierStatut: vers } : {}) },
    });
    if (r.count !== 1) return null;
    await journaliser(
      tx,
      { action, targetType: "Trainer", targetId: trainerId, changes, session: { userId: parId } },
      { exiger: true },
    );
    return tx.trainer.findUnique({
      where: { id: trainerId },
      select: { id: true, email: true, prenom: true, accesVersion: true },
    });
  });
}

/** Un lien peut-il être signé (secret présent) ? Vérifié AVANT de révoquer les anciens. */
function lienFabricable(p: { trainerId: string; maintenant: Date }): boolean {
  return urlDossierFormateur(p.trainerId, 0, p.maintenant) !== null;
}

/** F8 — renvoyer le lien du dossier (nouvelle version : les anciens liens sont révoqués). */
export async function renvoyerLienDossier(p: {
  trainerId: string;
  parId: string;
  maintenant: Date;
}): Promise<ResultatDossier> {
  if (!(await dossierOuvert())) return { ok: false, raison: "eteint" };
  // AVANT de révoquer les liens envoyés : sans texte validé, rien ne partirait.
  if (!(await texteValide("formateur-dossier-lien")))
    return { ok: false, raison: "texte-non-valide" };
  const t = await nouvelleVersion(
    p.trainerId,
    ["en_cours", "a_completer"],
    null,
    "qualiopi.formateur.dossier_lien_renvoye",
    p.parId,
    {},
  );
  if (!t) return { ok: false, raison: "etat" };
  const lien = urlDossierFormateur(t.id, t.accesVersion, p.maintenant);
  if (!lien) return { ok: true, envoi: "indisponible" };
  const envoi = await envoyer({
    gabarit: "formateur-dossier-lien",
    destinataire: t.email,
    payload: { prenom: t.prenom, lien },
    entityType: "Trainer",
    entityId: t.id,
    jobId: `fi-dossier-lien-${t.id}-v${t.accesVersion}`,
  });
  return { ok: true, envoi };
}

/** F12 — demander un complément : le dossier « à vérifier » est rouvert, avec un nouveau lien. */
export async function demanderComplement(p: {
  trainerId: string;
  motif: MotifComplement;
  parId: string;
  maintenant: Date;
}): Promise<ResultatDossier> {
  if (!(await dossierOuvert())) return { ok: false, raison: "eteint" };
  if (!(await texteValide("formateur-dossier-a-completer"))) {
    return { ok: false, raison: "texte-non-valide" };
  }
  if (!lienFabricable(p)) return { ok: false, raison: "etat" };
  const t = await nouvelleVersion(
    p.trainerId,
    ["a_verifier"],
    "a_completer",
    "qualiopi.formateur.dossier_complement_demande",
    p.parId,
    { motif: p.motif },
  );
  if (!t) return { ok: false, raison: "etat" };
  const lien = urlDossierFormateur(t.id, t.accesVersion, p.maintenant);
  if (!lien) return { ok: true, envoi: "indisponible" };
  const envoi = await envoyer({
    gabarit: "formateur-dossier-a-completer",
    destinataire: t.email,
    payload: { prenom: t.prenom, lien, valeurs: { motif: MOTIFS_COMPLEMENT[p.motif] } },
    entityType: "Trainer",
    entityId: t.id,
    jobId: `fi-dossier-complement-${t.id}-v${t.accesVersion}`,
  });
  return { ok: true, envoi };
}

/** F15 — statut pas encore ouvert : une seule fois par fiche (clé d'idempotence fixe). */
export async function prevenirStatutNonOuvert(trainerId: string): Promise<ResultatEnvoiFormateur> {
  const t = await prisma.trainer.findFirst({
    where: { id: trainerId, ...FICHE_OUVERTE },
    select: { id: true, email: true, prenom: true },
  });
  if (!t) return "indisponible";
  const jobId = `fi-statut-non-ouvert-${t.id}`;
  // « Une seule fois » au-delà de la mémoire de la file : journal ET corbeille relus.
  const deja = await dejaTente(jobId);
  if (deja !== false) return "indisponible";
  return envoyer({
    gabarit: "formateur-statut-non-ouvert",
    destinataire: t.email,
    payload: { prenom: t.prenom },
    entityType: "Trainer",
    entityId: t.id,
    jobId,
  });
}

/** F11 — l'alerte interne à l'envoi : identifiant, couleur du dernier contrôle, rien d'autre. */
export async function alerterDossierRecu(trainerId: string): Promise<void> {
  const derniere = await prisma.verificationRegistreSousTraitance.findFirst({
    where: { trainerId },
    orderBy: { createdAt: "desc" },
    select: { verdict: true },
  });
  const { notify } = await import("@/server/notifications");
  await notify({
    category: "TRAINER_DOSSIER_RECU",
    payload: { trainerId, registre: derniere?.verdict ?? "muet" },
  });
}
