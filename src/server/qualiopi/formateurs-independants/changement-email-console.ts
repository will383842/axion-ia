/**
 * Formateurs indépendants — CHANGEMENT D'ADRESSE E-MAIL DEPUIS LA CONSOLE (lot C4).
 *
 * L'adresse e-mail d'un indépendant est son IDENTITÉ DE CONNEXION : les liens de
 * l'espace et du dossier partent vers elle. La changer d'un clic, c'était pouvoir
 * détourner son espace (ses honoraires, son dossier, ses pièces) sans que le
 * titulaire le sache. Désormais, `updateTrainerAction` appelle ce module, et :
 *  - le changement exige l'acte `habiliter_formateur` (pas `editor`) ;
 *  - les liens du dossier sont révoqués (`accesVersion + 1`) dans la MÊME écriture
 *    que l'adresse ;
 *  - les liens de connexion encore en attente sont consommés, et les sessions de
 *    l'espace ouvertes sous l'ancienne adresse tombent (empreinte d'adresse portée
 *    par la session, `version-session.ts`) ;
 *  - l'ANCIENNE adresse reçoit un e-mail court (F61) — qui ne contient jamais la
 *    nouvelle. Il passe par l'adaptateur commun : texte non validé, rien ne part.
 *
 * Concerné : la fiche est `sous_traitant` AVANT la demande, ou le devient par elle
 * (on ne contourne pas l'acte en requalifiant la fiche dans la même demande).
 * Salariés et dirigeants : INCHANGÉ.
 *
 * Sans `server-only` : aucun import Next.
 */

import { prisma } from "@/lib/prisma";
import type { AdminSession } from "@/server/actions/knowledge/_guards";
import { MOTIF_REFUS, peutEngager } from "@/server/auth/habilitations";

import { envoyer } from "./envois";

/** L'acte qui ouvre le changement d'adresse d'un indépendant — celui de l'activation. */
export const ACTE_CHANGEMENT_EMAIL_INDEPENDANT = "habiliter_formateur" as const;

/** Ce qu'il faut garder de l'AVANT pour prévenir l'ancienne adresse. */
export interface ChangementEmailIndependant {
  readonly ancienneAdresse: string;
  readonly prenom: string;
}

export type PreparationChangementEmail =
  | { readonly ok: true; readonly changement: ChangementEmailIndependant | null }
  | { readonly ok: false; readonly error: string };

const JOUR_FR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

function memeAdresse(a: string, b: string): boolean {
  // La colonne est `citext` : la casse ne fait pas une nouvelle adresse.
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * AVANT l'écriture : la demande change-t-elle l'adresse d'un indépendant, et le rôle
 * le permet-il ? `changement: null` = rien de particulier à faire. Lecture
 * impossible : refus (garde fermée).
 */
export async function preparerChangementEmail(input: {
  readonly trainerId: string;
  readonly nouvelEmail: string | undefined;
  readonly nouveauStatut: string | undefined;
  readonly session: AdminSession;
}): Promise<PreparationChangementEmail> {
  if (input.nouvelEmail === undefined) return { ok: true, changement: null };
  let avant: { statut: string; email: string; prenom: string } | null;
  try {
    avant = await prisma.trainer.findUnique({
      where: { id: input.trainerId },
      select: { statut: true, email: true, prenom: true },
    });
  } catch {
    return { ok: false, error: "Erreur lors de la lecture du formateur." };
  }
  // Fiche introuvable : l'écriture échouera d'elle-même.
  if (avant === null || memeAdresse(avant.email, input.nouvelEmail)) {
    return { ok: true, changement: null };
  }
  if (avant.statut !== "sous_traitant" && input.nouveauStatut !== "sous_traitant") {
    return { ok: true, changement: null };
  }
  if (!peutEngager(input.session.role, ACTE_CHANGEMENT_EMAIL_INDEPENDANT)) {
    return {
      ok: false,
      error: `Changement d'adresse refusé : ${MOTIF_REFUS[ACTE_CHANGEMENT_EMAIL_INDEPENDANT]}`,
    };
  }
  return { ok: true, changement: { ancienneAdresse: avant.email, prenom: avant.prenom } };
}

/** À étaler dans le `data` de l'écriture : les liens du dossier tombent avec l'adresse. */
export function donneesChangementEmail(changement: ChangementEmailIndependant | null): {
  accesVersion?: { increment: number };
} {
  return changement === null ? {} : { accesVersion: { increment: 1 } };
}

/**
 * APRÈS l'écriture réussie : consomme les liens de connexion en attente et prévient
 * l'ancienne adresse. Ne lève jamais — l'adresse est déjà changée, c'est l'essentiel.
 */
export async function apresChangementEmail(
  trainerId: string,
  changement: ChangementEmailIndependant | null,
  maintenant: Date = new Date(),
): Promise<void> {
  if (changement === null) return;
  try {
    await prisma.formateurMagicLink.updateMany({
      where: { trainerId, usedAt: null },
      data: { usedAt: maintenant },
    });
  } catch (err) {
    console.error(
      `[formateurs-independants] liens de connexion non consommés (${trainerId}):`,
      err instanceof Error ? err.message : String(err),
    );
  }
  try {
    await envoyer({
      gabarit: "formateur-email-modifie",
      destinataire: changement.ancienneAdresse,
      entityType: "Trainer",
      entityId: trainerId,
      jobId: `fi-email-modifie-${trainerId}-${maintenant.getTime()}`,
      payload: { prenom: changement.prenom, valeurs: { date: JOUR_FR.format(maintenant) } },
    });
  } catch {
    // L'adresse est changée et les accès sont fermés ; l'e-mail est un avis.
  }
}
