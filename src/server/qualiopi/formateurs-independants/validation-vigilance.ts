/**
 * Formateurs indépendants — SERVICE de validation de l'attestation de vigilance
 * URSSAF (lot L4b, ADR 0066 (d) 4).
 *
 * Une validation = UNE ligne `PreuveVigilance` (ajout seul) ET la pièce passée
 * à `valide` (ou `rejete`), dans la MÊME transaction, avec sa trace au journal.
 * Sans preuve, pas de validation ; sans trace, pas de preuve.
 *
 * Livré ÉTEINT : un SERVICE, pas encore une Server Action — l'action et son
 * écran (« Vérifier et contresigner », W-4) arrivent avec L9, qui l'appelle.
 * L'habilitation est exigée ICI, quel que soit l'appelant. La validation
 * générique des pièces reste inchangée.
 */

import "server-only";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireHabilitation } from "@/server/actions/qualiopi/_guards";
import { journaliser } from "@/server/journal/journaliser";
import {
  ACTIONS_CREATION_PIECE,
  MESSAGES_REFUS_VIGILANCE,
  codeVigilanceBienForme,
  finValiditeVigilance,
  normaliserCodeVigilance,
  refusVigilance,
  type TraceCreation,
} from "./vigilance";

type ActionResult<T> = { data: T } | { error: string };

const schema = z
  .object({
    trainerDocumentId: z.string().uuid(),
    codeVerification: z.string().max(80),
    /** La case « Authentique : vérifiée sur urssaf.fr » — exigée cochée. */
    authenticiteVerifiee: z.literal(true),
    resultat: z.enum(["valide", "invalide"]),
    /** Exigé pour « invalide » : on ne rejette pas sans le dire. */
    motif: z.string().max(500).optional(),
  })
  .strict();

export async function validerAttestationVigilance(
  input: z.input<typeof schema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireHabilitation("habiliter_formateur");
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      error:
        "Pour valider, saisissez le code de vérification et cochez « authenticité vérifiée sur urssaf.fr ».",
    };
  }
  const v = parsed.data;
  const code = normaliserCodeVigilance(v.codeVerification);
  if (!codeVigilanceBienForme(code)) {
    return { error: "Le code de vérification URSSAF est manquant ou mal formé." };
  }
  const motif = (v.motif ?? "").trim();
  if (v.resultat === "invalide" && motif === "") {
    return { error: "Indiquez pourquoi l'attestation n'est pas authentique." };
  }

  const maintenant = new Date();
  let piece;
  let trace: TraceCreation;
  try {
    piece = await prisma.trainerDocument.findUnique({
      where: { id: v.trainerDocumentId },
      select: {
        id: true,
        trainerId: true,
        type: true,
        numeroPiece: true,
        hashSha256: true,
        dateEmission: true,
        statutValidation: true,
        rejetMotif: true,
        archiveAt: true,
        trainer: { select: { statut: true } },
      },
    });
    const log = await prisma.activityLog.findFirst({
      where: { action: { in: [...ACTIONS_CREATION_PIECE] }, targetId: v.trainerDocumentId },
      orderBy: { createdAt: "asc" },
      select: { action: true, adminUserId: true },
    });
    trace = log === null ? null : { action: log.action, adminUserId: log.adminUserId ?? null };
  } catch {
    return { error: "La pièce n'a pas pu être lue : réessayez." };
  }

  const refus = refusVigilance(
    piece === null
      ? null
      : {
          type: piece.type,
          numeroPiece: piece.numeroPiece,
          dateEmission: piece.dateEmission,
          statutValidation: piece.statutValidation,
          rejetMotif: piece.rejetMotif,
          archiveAt: piece.archiveAt,
          statutFormateur: piece.trainer.statut,
        },
    code,
    session,
    trace,
    maintenant,
  );
  if (refus !== null || piece === null) {
    return { error: MESSAGES_REFUS_VIGILANCE[refus ?? "introuvable"] };
  }

  const emission = piece.dateEmission!;
  const fin = finValiditeVigilance(emission);
  const sha =
    piece.hashSha256 !== null && /^[0-9a-f]{64}$/.test(piece.hashSha256) ? piece.hashSha256 : null;
  const valide = v.resultat === "valide";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.preuveVigilance.create({
        data: {
          trainerId: piece.trainerId,
          trainerDocumentId: piece.id,
          verifieeAt: maintenant,
          resultat: v.resultat,
          codeVerification: code,
          dateAttestation: emission,
          // Une attestation non authentique n'a pas de validité.
          dateFinValidite: valide ? fin : null,
          fichierSha256: sha,
          verifieeParId: session.userId,
        },
      });
      // CONDITIONNELLE : deux validations simultanées → la seconde ne trouve
      // plus la pièce en attente, lève, et sa preuve est annulée avec elle.
      const maj = await tx.trainerDocument.updateMany({
        where: { id: piece.id, statutValidation: "en_attente", archiveAt: null },
        data: valide
          ? {
              statutValidation: "valide",
              valideAt: maintenant,
              valideParUserId: session.userId,
              rejetMotif: null,
              dateExpiration: fin,
              numeroPiece: piece.numeroPiece ?? code,
            }
          : {
              statutValidation: "rejete",
              valideAt: null,
              valideParUserId: null,
              rejetMotif: `Attestation non authentique (vérification urssaf.fr) : ${motif}`,
            },
      });
      if (maj.count !== 1) throw new Error("piece_deja_traitee");
      await journaliser(
        tx,
        {
          action: "qualiopi.formateur.vigilance.verifiee",
          targetType: "TrainerDocument",
          targetId: piece.id,
          changes: { resultat: v.resultat, trainerId: piece.trainerId },
          session: { userId: session.userId },
        },
        { exiger: true },
      );
    });
  } catch {
    return { error: "La vérification n'a pas pu être enregistrée : réessayez." };
  }

  return { data: { id: piece.id } };
}
