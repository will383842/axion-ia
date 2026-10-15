/**
 * Formateurs indépendants — le NUMÉRO DE DÉCLARATION D'ACTIVITÉ transmis depuis
 * l'espace formateur (vérification n° 1, V1-A-10).
 *
 * Une personne qui a signé avec un numéro « en cours » reçoit F21 (« transmettez-le
 * depuis votre espace ») à 1 puis 2 mois. Aucun écran ne le permettait : seule la
 * console écrivait ce numéro. « Mon dossier » le reçoit désormais.
 *
 * 🔑 L'écriture est CONDITIONNELLE : la fiche de la session, indépendante en nom propre,
 * collaboration en cours, et dont le numéro dit encore « en cours ». Un numéro déjà
 * connu ne se remplace pas d'ici (la console le corrige). Le numéro enregistré, F21
 * s'arrête de lui-même (la campagne ne lit que les fiches « en cours »).
 *
 * 🔴 Un numéro TAPÉ PAR LE FORMATEUR n'est pas un numéro VÉRIFIÉ : la même écriture
 * remet `sousTraitantVerifieAt` à `null`. Le contrôle d'avant portait sur « en cours » ;
 * le garder ouvrirait les missions (donc le paiement) sur 11 chiffres que personne n'a
 * lus sur la liste des organismes de formation (relecture, V1-A-9). La garde de mission
 * refuse donc avec le motif `registre` jusqu'à ce que la console revérifie
 * (`verifyTrainerSousTraitantAction`), et la fiche console dit « numéro reçu, à
 * vérifier » (`numeroRecuAVerifier`).
 *
 * 🔴 ÉTEINT : tant que `formateurs.dossier_en_ligne` est coupé, rien n'est lu ni écrit.
 * 🔴 Aucun numéro dans le journal ni dans Sentry : la trace dit seulement d'où il vient.
 *
 * Sans `server-only` : aucun import Next.
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";

import { normaliserNda } from "./controle-regles";
import { envoiAllume } from "./interrupteurs-envoi";

export const ACTION_NDA_TRANSMIS = "qualiopi.formateur.nda_transmis_espace";

/** Les issues, par CODE FERMÉ (la page n'affiche que le texte qui leur correspond). */
export const MESSAGES_NDA_ESPACE = {
  nda_recu: "Numéro enregistré, merci. Vous n'avez plus rien à nous transmettre à ce sujet.",
  nda_invalide:
    "Le numéro de déclaration d'activité compte 11 chiffres : recopiez-le depuis le récépissé de la préfecture.",
  nda_deja_connu: "Votre numéro de déclaration d'activité est déjà enregistré.",
  nda_indisponible: "Cette saisie n'est pas ouverte pour le moment.",
  nda_erreur: "L'enregistrement n'a pas abouti. Réessayez dans quelques minutes.",
} as const;

export type IssueNdaEspace = keyof typeof MESSAGES_NDA_ESPACE;

/** Même lecture que la garde de mission et la campagne F21. */
const RE_EN_COURS = /en\s*cours/i;

const FICHE_ATTENDUE = {
  statut: "sous_traitant",
  organismeSousTraitantId: null,
  finCollaborationAt: null,
} as const;

/** Cette fiche attend-elle son numéro ? Coupé, ou lecture en échec : non. */
export async function numeroDeclarationAttendu(trainerId: string): Promise<boolean> {
  if (!(await envoiAllume("dossier_en_ligne"))) return false;
  try {
    const t = await prisma.trainer.findFirst({
      where: { id: trainerId, ...FICHE_ATTENDUE },
      select: { sousTraitantNda: true },
    });
    return t !== null && RE_EN_COURS.test(t.sousTraitantNda ?? "");
  } catch {
    return false;
  }
}

/** Enregistre le numéro saisi dans l'espace ; rend le code de l'issue. */
export async function transmettreNumeroDeclaration(
  trainerId: string,
  saisie: string,
): Promise<IssueNdaEspace> {
  if (!(await envoiAllume("dossier_en_ligne"))) return "nda_indisponible";
  const nda = normaliserNda(saisie.slice(0, 40));
  if (nda === null) return "nda_invalide";
  const r = await prisma.trainer.updateMany({
    where: {
      id: trainerId,
      ...FICHE_ATTENDUE,
      sousTraitantNda: { contains: "cours", mode: "insensitive" },
    },
    data: { sousTraitantNda: nda, sousTraitantVerifieAt: null },
  });
  if (r.count !== 1) return "nda_deja_connu";
  await journaliser(prisma, {
    action: ACTION_NDA_TRANSMIS,
    targetType: "Trainer",
    targetId: trainerId,
    changes: { source: "espace_formateur" },
    session: null,
  });
  return "nda_recu";
}

/**
 * La fiche porte-t-elle un numéro reçu de l'espace et pas encore revérifié en console ?
 * Rend la date de la transmission, sinon `null`. Coupé, ou lecture en échec : `null`.
 */
export async function numeroRecuAVerifier(trainerId: string): Promise<Date | null> {
  if (!(await envoiAllume("dossier_en_ligne"))) return null;
  try {
    const t = await prisma.trainer.findFirst({
      where: { id: trainerId, ...FICHE_ATTENDUE, sousTraitantVerifieAt: null },
      select: { sousTraitantNda: true },
    });
    const nda = (t?.sousTraitantNda ?? "").trim();
    if (nda === "" || RE_EN_COURS.test(nda)) return null;
    const trace = await prisma.activityLog.findFirst({
      where: { action: ACTION_NDA_TRANSMIS, targetType: "Trainer", targetId: trainerId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return trace?.createdAt ?? null;
  } catch {
    return null;
  }
}
