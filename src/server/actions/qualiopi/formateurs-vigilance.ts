/**
 * Qualiopi — validation de l'attestation de vigilance URSSAF d'un formateur
 * indépendant (lot L4b, ADR 0066 (d) 4).
 *
 * Une validation = UNE ligne `PreuveVigilance` (ajout seul) ET la pièce passée
 * à `valide` (ou `rejete`), dans la MÊME transaction, avec sa trace au journal.
 * Sans preuve, pas de validation ; sans trace, pas de preuve.
 *
 * Livré ÉTEINT : aucun écran ne l'appelle encore (l'écran « Vérifier et
 * contresigner » arrive avec L9). La validation générique des pièces reste
 * inchangée.
 */

"use server";

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
} from "@/server/qualiopi/formateurs-independants/vigilance";

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

export async function validerAttestationVigilanceAction(
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
      select: { adminUserId: true },
    });
    trace = log === null ? null : { adminUserId: log.adminUserId ?? null };
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
          dateFinValidite: fin,
          fichierSha256: sha,
          verifieeParId: session.userId,
        },
      });
      await tx.trainerDocument.update({
        where: { id: piece.id },
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
