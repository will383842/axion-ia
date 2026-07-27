/**
 * Qualiopi — Server Actions sur les pièces justificatives d'un formateur.
 *
 * Alimentent le moteur de conformité (`server/qualiopi/trainers/conformite.ts`)
 * qui décide si un formateur peut être envoyé chez un client : contrat de
 * travail (salarié), NDA / Kbis / contrat de sous-traitance (indépendant),
 * attestation de vigilance URSSAF, RC pro, CV.
 *
 * Guards RBAC write + audit ActivityLog, comme les autres actions Qualiopi.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAdminWrite,
  requireAdminDelete,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";

type ActionResult<T> = { data: T } | { error: string };

const DOCUMENT_TYPES = [
  "contrat_travail",
  "dpae",
  "attestation_vigilance_urssaf",
  "kbis_avis_sirene",
  "nda_sous_traitant",
  "attestation_qualiopi",
  "assurance_rc_pro",
  "contrat_sous_traitance",
  "cv",
  "diplome",
  "certification",
  "autre",
] as const;

const uuid = z.string().uuid();

/** Une date ISO facultative : "" (champ vide du formulaire) → absente. */
const dateFacultative = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : new Date(v)))
  .refine((d) => d === undefined || !Number.isNaN(d.getTime()), { message: "Date invalide" });

const createSchema = z.object({
  trainerId: uuid,
  type: z.enum(DOCUMENT_TYPES),
  numeroPiece: z.string().max(60).optional(),
  fichierUrl: z.string().url().max(2000).optional().or(z.literal("")),
  dateEmission: dateFacultative,
  dateExpiration: dateFacultative,
  notes: z.string().max(2000).optional(),
});

/**
 * Enregistre une pièce. Elle démarre en `en_attente` : une pièce n'est prise en
 * compte par le moteur de conformité qu'une fois VALIDÉE par un humain.
 */
export async function createTrainerDocumentAction(
  // `z.input` et non `z.infer` : le schéma TRANSFORME les dates (string → Date).
  // L'action reçoit ce qu'un formulaire envoie (des chaînes), Zod convertit.
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  if (v.dateExpiration !== undefined && v.dateEmission !== undefined) {
    if (v.dateExpiration <= v.dateEmission) {
      return { error: "La date d'expiration doit suivre la date d'émission." };
    }
  }

  let id: string;
  try {
    const created = await prisma.trainerDocument.create({
      data: {
        trainerId: v.trainerId,
        type: v.type,
        numeroPiece: v.numeroPiece ?? null,
        fichierUrl: v.fichierUrl !== undefined && v.fichierUrl !== "" ? v.fichierUrl : null,
        dateEmission: v.dateEmission ?? null,
        dateExpiration: v.dateExpiration ?? null,
        notes: v.notes ?? null,
      },
      select: { id: true },
    });
    id = created.id;
  } catch {
    return { error: "Erreur lors de l'enregistrement de la pièce." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer_document.create",
    targetType: "TrainerDocument",
    targetId: id,
    changes: { trainerId: v.trainerId, type: v.type },
    session,
  });

  return { data: { id } };
}

const validateSchema = z.object({
  id: uuid,
  /** `rejete` exige un motif : on ne rejette pas une pièce sans le dire. */
  statutValidation: z.enum(["valide", "rejete"]),
  rejetMotif: z.string().max(500).optional(),
});

/** Valide ou rejette une pièce. Seule une pièce `valide` compte pour la conformité. */
export async function validateTrainerDocumentAction(
  input: z.infer<typeof validateSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = validateSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, statutValidation, rejetMotif } = parsed.data;

  if (statutValidation === "rejete" && (rejetMotif === undefined || rejetMotif.trim() === "")) {
    return { error: "Un motif est requis pour rejeter une pièce." };
  }

  try {
    await prisma.trainerDocument.update({
      where: { id },
      data: {
        statutValidation,
        valideAt: statutValidation === "valide" ? new Date() : null,
        valideParUserId: statutValidation === "valide" ? session.userId : null,
        rejetMotif: statutValidation === "rejete" ? (rejetMotif ?? null) : null,
      },
    });
  } catch {
    return { error: "Erreur lors de la validation de la pièce." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer_document.validate",
    targetType: "TrainerDocument",
    targetId: id,
    changes: { statutValidation },
    session,
  });

  return { data: { id } };
}

const deleteSchema = z.object({ id: uuid });

/**
 * Supprime une piece formateur (diplome, CV, attestation).
 *
 * ⚠️ Le commentaire precedent disait « l'historique reste dans ActivityLog ».
 * C'est trompeur : ActivityLog conserve la trace de L'ACTE, pas la PIECE. Apres
 * cet appel, le fichier reste orphelin dans le storage mais son pointeur, son
 * hash de scellement et son statut de validation sont perdus — la preuve des
 * indicateurs 21/22 devient inexploitable devant un auditeur.
 *
 * D'ou `requireAdminDelete` (super_admin STRICT) et non `requireAdminWrite`
 * (qui autorise le role `editor`). `TrainerDocument` n'a ni `deletedAt` ni
 * `archivedAt` : il n'y a pas de corbeille, la garde est la seule protection.
 *
 * ⚠️ CE QUI RESTE A FAIRE, et que cette garde ne couvre PAS : `changes` n'est
 * pas alimente ici, donc rien ne permet de reconstituer la piece supprimee. Un
 * `findUnique` avant le `delete`, verse dans `changes`, protegerait tous les
 * roles y compris `super_admin` (le seul compte existant a ce jour). Non fait
 * dans ce lot : c'est un changement de comportement qui demande de reprendre
 * les mocks Prisma des specs concernees. A traiter avec le soft-delete.
 */
export async function deleteTrainerDocumentAction(
  input: z.infer<typeof deleteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminDelete();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id } = parsed.data;

  try {
    await prisma.trainerDocument.delete({ where: { id } });
  } catch {
    return { error: "Erreur lors de la suppression de la pièce." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer_document.delete",
    targetType: "TrainerDocument",
    targetId: id,
    session,
  });

  return { data: { id } };
}
