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
  requireHabilitation,
} from "@/server/actions/qualiopi/_guards";
import { motifPieceNonProbante } from "@/server/qualiopi/trainers/piece-competence";
import {
  echeanceCalculee,
  estPieceArchivee,
  estPieceGardee,
  MARQUE_ARCHIVE,
} from "@/server/qualiopi/formateurs-independants/gardes";

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

  // 🔴 Lot S1 (ADR 0066) — les pièces que lit la garde d'activation (vigilance
  // URSSAF, avis SIRENE) ont une échéance CALCULÉE : émission + durée légale.
  // Une échéance saisie librement (« valable jusqu'en 2099 ») faisait vivre une
  // attestation pour toujours. Sans date d'émission, ou avec une date future,
  // la pièce ne prouve rien : elle est refusée dès la saisie.
  let dateExpiration = v.dateExpiration;
  if (estPieceGardee(v.type)) {
    if (v.dateEmission === undefined) {
      return {
        error: "La date d'émission de cette pièce est obligatoire : son échéance en dépend.",
      };
    }
    if (v.dateEmission.getTime() > Date.now()) {
      return { error: "La date d'émission ne peut pas être dans le futur." };
    }
    dateExpiration = echeanceCalculee(v.type, v.dateEmission) ?? undefined;
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
        dateExpiration: dateExpiration ?? null,
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
  // Acte ENGAGEANT : seule une piece VALIDE compte pour la conformite du formateur.
  const session = await requireHabilitation("habiliter_formateur");
  const parsed = validateSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, statutValidation, rejetMotif } = parsed.data;

  if (statutValidation === "rejete" && (rejetMotif === undefined || rejetMotif.trim() === "")) {
    return { error: "Un motif est requis pour rejeter une pièce." };
  }

  // 🔴 Audit initial 2026-09-14 (constat I21-02). Une pièce de compétence
  // (CV, diplôme, certification) VALIDÉE sans fichier couvrait l'indicateur 21
  // et faisait imprimer « CV joint » sur la fiche formateur versée au dossier.
  // L'auditrice ouvre la pièce : il n'y a rien derrière. On ne valide pas ce
  // qu'on n'a pas pu lire. Le rejet, lui, reste possible sans fichier.
  //
  // Le jugement vient du prédicat PARTAGÉ (`piece-competence.ts`), évalué sur la
  // pièce telle qu'elle serait une fois validée : même liste de types, même
  // définition de « fichier présent » que la couverture et les pièces imprimées.
  // Seul le motif `sans_fichier` bloque : une pièce expirée reste authentique et
  // se valide, elle ne couvre simplement rien (l'écran le signale).
  let echeanceRecalculee: Date | null | undefined;
  if (statutValidation === "valide") {
    let piece: {
      type: string;
      fichierUrl: string | null;
      dateEmission?: Date | null;
      dateExpiration: Date | null;
      rejetMotif?: string | null;
    } | null;
    try {
      piece = await prisma.trainerDocument.findUnique({
        where: { id },
        select: {
          type: true,
          fichierUrl: true,
          dateEmission: true,
          dateExpiration: true,
          rejetMotif: true,
        },
      });
    } catch {
      return { error: "Erreur lors de la validation de la pièce." };
    }
    if (piece === null) return { error: "Pièce introuvable." };
    if (estPieceArchivee(piece.rejetMotif)) {
      return { error: "Cette pièce est archivée : elle ne peut plus être validée." };
    }

    // 🔴 Lot S1 (ADR 0066) — QUATRE YEUX sur les pièces que lit la garde
    // d'activation : celui qui a saisi la pièce ne la valide pas lui-même
    // (sauf `super_admin`). Le créateur est lu dans le journal de création ;
    // introuvable, il est réputé être le validateur — garde FERMÉE.
    if (estPieceGardee(piece.type)) {
      if (session.role !== "super_admin") {
        let createur: string | null = null;
        try {
          const trace = await prisma.activityLog.findFirst({
            where: { action: "qualiopi.trainer_document.create", targetId: id },
            orderBy: { createdAt: "asc" },
            select: { adminUserId: true },
          });
          createur = trace?.adminUserId ?? null;
        } catch {
          createur = null;
        }
        if (createur === null || createur === session.userId) {
          return {
            error:
              "Validation refusée : une attestation de vigilance ou un avis SIRENE est validé par une autre personne que celle qui l'a enregistré.",
          };
        }
      }
      // L'échéance est RECALCULÉE à la validation : une pièce saisie avant ce
      // lot avec une date libre ne la garde pas.
      echeanceRecalculee = echeanceCalculee(piece.type, piece.dateEmission ?? null);
    }
    if (
      motifPieceNonProbante({ ...piece, statutValidation: "valide" }, new Date()) === "sans_fichier"
    ) {
      // Aucune action ne joint un fichier à une pièce EXISTANTE : le message
      // prescrit le seul geste qui existe.
      return {
        error:
          "Validation refusée : aucun fichier n'est joint à cette pièce de compétence, et une pièce enregistrée ne peut pas en recevoir un. Ajoutez une nouvelle pièce avec l'URL de son fichier, puis rejetez celle-ci.",
      };
    }
  }

  try {
    await prisma.trainerDocument.update({
      where: { id },
      data: {
        statutValidation,
        valideAt: statutValidation === "valide" ? new Date() : null,
        valideParUserId: statutValidation === "valide" ? session.userId : null,
        rejetMotif: statutValidation === "rejete" ? (rejetMotif ?? null) : null,
        ...(echeanceRecalculee !== undefined ? { dateExpiration: echeanceRecalculee } : {}),
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
 * ARCHIVE une pièce formateur (diplôme, CV, attestation) — lot S1, ADR 0066.
 *
 * 🔴 C'était un `delete` : le pointeur du fichier, son hash de scellement et son
 * statut de validation disparaissaient, et la preuve des indicateurs 21/22 avec
 * eux. La pièce est désormais CONSERVÉE, passée au statut `rejete` avec un
 * motif marqué {@link MARQUE_ARCHIVE} : elle ne compte plus pour aucune
 * conformité ni pour la garde d'activation, et elle reste lisible.
 *
 * `requireAdminDelete` (super_admin STRICT) est conservé : retirer une pièce du
 * dossier reste un geste réservé, même réversible en base.
 */
export async function deleteTrainerDocumentAction(
  input: z.infer<typeof deleteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminDelete();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id } = parsed.data;

  const le = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  try {
    await prisma.trainerDocument.update({
      where: { id },
      data: {
        statutValidation: "rejete",
        rejetMotif: `${MARQUE_ARCHIVE} Pièce retirée du dossier le ${le}.`,
      },
    });
  } catch {
    return { error: "Erreur lors de l'archivage de la pièce." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer_document.archive",
    targetType: "TrainerDocument",
    targetId: id,
    changes: { archivee: true },
    session,
  });

  return { data: { id } };
}
