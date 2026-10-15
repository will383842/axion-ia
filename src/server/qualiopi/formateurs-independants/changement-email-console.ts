/**
 * Formateurs indépendants — CHANGEMENT D'ADRESSE E-MAIL DEPUIS LA CONSOLE (lot C4).
 *
 * L'adresse e-mail d'un indépendant est son IDENTITÉ DE CONNEXION : les liens de
 * l'espace et du dossier partent vers elle. La changer d'un clic, c'était pouvoir
 * détourner son espace (ses honoraires, son dossier, ses pièces) sans que le
 * titulaire le sache. Désormais, `updateTrainerAction` appelle ce module, et :
 *  - le changement exige l'acte `habiliter_formateur` (pas `editor`) — tout comme
 *    faire QUITTER le statut `sous_traitant` à une fiche (sinon : requalifier,
 *    changer l'adresse, re-requalifier contournait la garde) ;
 *  - les liens du dossier sont révoqués (`accesVersion + 1`) dans la MÊME écriture
 *    que l'adresse ;
 *  - vérification 1 (V1-A-8) : dans la MÊME transaction, les codes de signature
 *    encore valables tombent (`ecrireFicheAvecChangementEmail`) — le code reçu à
 *    l'ancienne adresse ne signe plus le contrat ;
 *  - vérification 2 (V2-S-3) : dans la MÊME transaction, les liens de signature encore
 *    vivants des pièces du formateur (contrat-cadre, lettres de mission, autres pièces)
 *    sont révoqués — ils avaient été envoyés à l'ancienne adresse. Les pièces qu'il n'a
 *    pas signées sont rendues à la console « à renvoyer » à la nouvelle adresse ;
 *  - vérification 1 (V1-C-6, V1-D-1) : l'adresse remplacée est gardée, datée
 *    (`emailRemplace`, `emailRemplaceAt`) — F43 la prévient pendant 30 jours d'un
 *    changement de compte, et un lien de mission émis avant la correction tombe ;
 *  - les liens de connexion encore en attente sont consommés (avant l'écriture, échec
 *    = refus ; puis une seconde fois après), et les sessions de
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
import { invaliderCodesSignatureFormateur } from "@/server/qualiopi/documents/signature/code-signature";

import type { Prisma } from "../../../../prisma/generated/client";

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
  const quitteStatut = input.nouveauStatut !== undefined && input.nouveauStatut !== "sous_traitant";
  if (input.nouvelEmail === undefined && !quitteStatut) return { ok: true, changement: null };
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
  if (avant === null) return { ok: true, changement: null };
  const refus = (objet: string): PreparationChangementEmail => ({
    ok: false,
    error: `${objet} refusé : ${MOTIF_REFUS[ACTE_CHANGEMENT_EMAIL_INDEPENDANT]}`,
  });
  const habilite = peutEngager(input.session.role, ACTE_CHANGEMENT_EMAIL_INDEPENDANT);
  // Relecture C4 — sans cette garde, un indépendant requalifié salarié, son adresse
  // changée, puis remis indépendant échappait à tout ce qui suit (en trois demandes).
  if (avant.statut === "sous_traitant" && quitteStatut && !habilite) {
    return refus("Changement de statut d'un formateur indépendant");
  }
  if (input.nouvelEmail === undefined || memeAdresse(avant.email, input.nouvelEmail)) {
    return { ok: true, changement: null };
  }
  if (avant.statut !== "sous_traitant" && input.nouveauStatut !== "sous_traitant") {
    return { ok: true, changement: null };
  }
  if (!habilite) return refus("Changement d'adresse");
  // Relecture C4 — les liens de connexion en attente (envoyés à l'ANCIENNE adresse)
  // tombent AVANT l'écriture : un échec ici refuse, il ne laisse rien d'ouvert.
  try {
    await consommerLiensConnexion(input.trainerId, new Date());
  } catch {
    return { ok: false, error: "Erreur lors de la fermeture des liens de connexion." };
  }
  return { ok: true, changement: { ancienneAdresse: avant.email, prenom: avant.prenom } };
}

function consommerLiensConnexion(trainerId: string, maintenant: Date) {
  return prisma.formateurMagicLink.updateMany({
    where: { trainerId, usedAt: null },
    data: { usedAt: maintenant },
  });
}

/** V2-S-3 — les parties au titre desquelles le formateur signe ses propres pièces. */
const PARTIES_DU_FORMATEUR = ["formateur", "sous_traitant"] as const;

/** V2-S-3 — motif lisible des liens coupés par le changement d'adresse. */
export const MOTIF_LIEN_ADRESSE_CHANGEE =
  "Adresse e-mail du formateur changée : lien envoyé à l'ancienne adresse, à renvoyer à la nouvelle.";

/**
 * V2-S-3 — révoque, DANS la transaction de l'adresse, les liens de signature vivants des
 * pièces du formateur (et les codes de signature de la partie « formateur » ; ceux du
 * contrat-cadre tombent par `invaliderCodesSignatureFormateur`). Rend le nombre de
 * pièces dont un lien est tombé et que le formateur n'a pas signées : à renvoyer.
 */
async function revoquerLiensSignatureFormateur(
  tx: Prisma.TransactionClient,
  trainerId: string,
  maintenant: Date,
  parAdminId: string | null,
): Promise<number> {
  const pieces = await tx.documentGenere.findMany({
    where: {
      trainerId,
      signatureTokens: { some: { revokedAt: null, partie: { in: [...PARTIES_DU_FORMATEUR] } } },
    },
    select: {
      id: true,
      annuleeAt: true,
      signatures: {
        where: { revokedAt: null, partie: { in: [...PARTIES_DU_FORMATEUR] } },
        select: { id: true },
      },
    },
  });
  if (pieces.length === 0) return 0;
  const ids = pieces.map((p) => p.id);
  await tx.documentSignatureToken.updateMany({
    where: {
      documentGenereId: { in: ids },
      partie: { in: [...PARTIES_DU_FORMATEUR] },
      revokedAt: null,
    },
    data: {
      revokedAt: maintenant,
      revokedMotif: MOTIF_LIEN_ADRESSE_CHANGEE,
      revokedById: parAdminId,
    },
  });
  await tx.documentSignatureCode.updateMany({
    where: {
      documentGenereId: { in: ids },
      partie: "formateur",
      utiliseAt: null,
      invalideAt: null,
    },
    data: { invalideAt: maintenant },
  });
  return pieces.filter((p) => p.annuleeAt === null && p.signatures.length === 0).length;
}

/** À étaler dans les `changes` du journal : le fait, jamais la valeur. */
export function journalChangementEmail(changement: ChangementEmailIndependant | null): {
  emailIndependantModifie?: true;
} {
  return changement === null ? {} : { emailIndependantModifie: true };
}

/**
 * À étaler dans le `data` de l'écriture : les liens du dossier tombent avec l'adresse,
 * et l'adresse remplacée est gardée, datée.
 */
export function donneesChangementEmail(
  changement: ChangementEmailIndependant | null,
  maintenant: Date = new Date(),
): {
  accesVersion?: { increment: number };
  emailRemplace?: string;
  emailRemplaceAt?: Date;
} {
  return changement === null
    ? {}
    : {
        accesVersion: { increment: 1 },
        emailRemplace: changement.ancienneAdresse,
        emailRemplaceAt: maintenant,
      };
}

/**
 * L'ÉCRITURE de la fiche. Avec un changement d'adresse d'un indépendant : une seule
 * transaction porte l'adresse, la révocation des liens du dossier, l'adresse
 * remplacée, l'invalidation des codes de signature vivants (V1-A-8) ET la révocation
 * des liens de signature envoyés à l'ancienne adresse (V2-S-3). Un échec de l'une
 * annule tout. Sans changement : l'écriture d'avant, inchangée.
 *
 * Rend le nombre de pièces non signées dont le lien est tombé : à renvoyer.
 */
export async function ecrireFicheAvecChangementEmail(input: {
  readonly trainerId: string;
  readonly data: Prisma.TrainerUpdateInput;
  readonly changement: ChangementEmailIndependant | null;
  readonly maintenant?: Date;
  /** L'administrateur qui change l'adresse : il signe la révocation des liens. */
  readonly parAdminId?: string | null;
}): Promise<{ piecesARenvoyer: number }> {
  const { trainerId, data, changement } = input;
  if (changement === null) {
    await prisma.trainer.update({ where: { id: trainerId }, data });
    return { piecesARenvoyer: 0 };
  }
  const maintenant = input.maintenant ?? new Date();
  return prisma.$transaction(async (tx) => {
    await tx.trainer.update({
      where: { id: trainerId },
      data: { ...data, ...donneesChangementEmail(changement, maintenant) },
    });
    await invaliderCodesSignatureFormateur(tx, trainerId, maintenant);
    const piecesARenvoyer = await revoquerLiensSignatureFormateur(
      tx,
      trainerId,
      maintenant,
      input.parAdminId ?? null,
    );
    return { piecesARenvoyer };
  });
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
  // Second passage : un lien demandé par l'ancienne adresse ENTRE la préparation et
  // l'écriture. Le premier, avant l'écriture, a fermé les autres.
  try {
    await consommerLiensConnexion(trainerId, maintenant);
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
