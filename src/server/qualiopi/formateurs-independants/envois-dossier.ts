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
 *   - F12 depuis l'écran W-4 (lot A, M7) : même geste, motif de la liste fermée de W-4 ;
 *   - F13 `formateur-dossier-refuse`      : « Refuser le dossier » (W-4, registre rouge).
 *         L'état « refusé » est ÉCRIT avant l'e-mail : une ligne `refus_administrateur`
 *         AJOUTÉE au registre des contrôles (ajout seul, plan 08 §2.2), motif d'origine
 *         gardé ;
 *   - F15 `formateur-statut-non-ouvert`   : une seule fois par fiche.
 *
 * Pas F10 (sa pièce jointe est la copie du contrat signé : signature pas encore livrée).
 *
 * 🔴 Les écritures sont conditionnelles ; le journal ne porte que des identifiants.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { dejaTente } from "@/server/relances/passer-campagnes";

import { SOURCE_REFUS_ADMINISTRATEUR } from "./controle-regles";
import { envoyer, texteValide, type ResultatEnvoiFormateur } from "./envois";
import { lireDrapeauEnvoi } from "./interrupteurs";
import { lireEtatsInterrupteurs } from "./interrupteurs-etat";
import { urlDossierFormateur } from "./jeton-dossier";
import {
  MOTIFS_COMPLEMENT as MOTIFS_COMPLEMENT_W4,
  type MotifComplement as MotifComplementW4,
} from "./verifier-contresigner-regles";

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
  return complementAvecNouveauLien(p, p.motif, MOTIFS_COMPLEMENT[p.motif]);
}

/**
 * F12 depuis l'écran W-4 (M7) : le motif est un libellé de la liste fermée de W-4
 * (« le CV », « l'attestation URSSAF »…), écrit tel quel dans l'e-mail.
 */
export async function demanderComplementW4(p: {
  trainerId: string;
  motif: string;
  parId: string;
  maintenant: Date;
}): Promise<ResultatDossier> {
  if (!(MOTIFS_COMPLEMENT_W4 as ReadonlyArray<string>).includes(p.motif)) {
    return { ok: false, raison: "etat" };
  }
  const motif = p.motif as MotifComplementW4;
  return complementAvecNouveauLien(p, motif, motif);
}

async function complementAvecNouveauLien(
  p: { trainerId: string; parId: string; maintenant: Date },
  motifJournal: string,
  libelle: string,
): Promise<ResultatDossier> {
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
    { motif: motifJournal },
  );
  if (!t) return { ok: false, raison: "etat" };
  const lien = urlDossierFormateur(t.id, t.accesVersion, p.maintenant);
  if (!lien) return { ok: true, envoi: "indisponible" };
  const envoi = await envoyer({
    gabarit: "formateur-dossier-a-completer",
    destinataire: t.email,
    payload: { prenom: t.prenom, lien, valeurs: { motif: libelle } },
    entityType: "Trainer",
    entityId: t.id,
    jobId: `fi-dossier-complement-${t.id}-v${t.accesVersion}`,
  });
  return { ok: true, envoi };
}

/** La source de la ligne « dossier refusé » du registre des contrôles (F13). */
export const SOURCE_REFUS_DOSSIER = SOURCE_REFUS_ADMINISTRATEUR;

/**
 * F13 — refuser le dossier sur un registre ROUGE. Sous le verrou des contrôles du
 * formateur (même clé que `controle.ts`) : le dernier contrôle doit être rouge. L'état
 * « refusé » est une ligne AJOUTÉE (verdict rouge, source `refus_administrateur`,
 * date et motif du contrôle jugé) : rien n'est modifié ni effacé. Un second clic
 * n'ajoute rien ; l'e-mail garde sa clé unique par fiche.
 */
export async function refuserDossier(p: {
  trainerId: string;
  motif: "entreprise fermée" | "numéro introuvable";
  parId: string;
}): Promise<ResultatDossier> {
  // AVANT d'écrire : on ne refuse pas un dossier sans pouvoir le dire à la personne.
  if (!(await texteValide("formateur-dossier-refuse"))) {
    return { ok: false, raison: "texte-non-valide" };
  }
  const t = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`controle_registre:${p.trainerId}`}))`;
    const fiche = await tx.trainer.findFirst({
      where: { id: p.trainerId, ...FICHE_OUVERTE, actif: false },
      select: { id: true, email: true, prenom: true },
    });
    if (fiche === null) return null;
    const dernier = await tx.verificationRegistreSousTraitance.findFirst({
      where: { trainerId: p.trainerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        verdict: true,
        source: true,
        verifieAt: true,
        siren: true,
        siret: true,
        numeroDeclarationActivite: true,
        motif: true,
      },
    });
    if (dernier === null || dernier.verdict !== "rouge") return null;
    if (dernier.source !== SOURCE_REFUS_DOSSIER) {
      await tx.verificationRegistreSousTraitance.create({
        data: {
          trainerId: p.trainerId,
          verifieAt: dernier.verifieAt,
          verdict: "rouge",
          source: SOURCE_REFUS_DOSSIER,
          siren: dernier.siren,
          siret: dernier.siret,
          numeroDeclarationActivite: dernier.numeroDeclarationActivite,
          motif: dernier.motif,
          verifieParId: p.parId,
        },
      });
      await journaliser(
        tx,
        {
          action: "qualiopi.formateur.dossier_refuse",
          targetType: "Trainer",
          targetId: p.trainerId,
          changes: { controleId: dernier.id, motif: p.motif },
          session: { userId: p.parId },
        },
        { exiger: true },
      );
    }
    return fiche;
  });
  if (t === null) return { ok: false, raison: "etat" };
  const envoi = await envoyer({
    gabarit: "formateur-dossier-refuse",
    destinataire: t.email,
    payload: { prenom: t.prenom, valeurs: { motif: p.motif } },
    entityType: "Trainer",
    entityId: t.id,
    jobId: `fi-dossier-refuse-${t.id}`,
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
