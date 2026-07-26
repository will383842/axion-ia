/**
 * Qualiopi — Server Actions Appréciations + Traitement RGPD (AGENT B — T14).
 *
 * Actions ADMIN (requireAdminWrite + audit) :
 *   creerAppreciationAction    : crée une appréciation multi-parties (off.30)
 *                               Accessible aussi depuis le portail (via cookie).
 *   traiterDemandeRgpdAction   : traite une demande RGPD (export effectif ou suppression).
 *
 * off.30 : recueil structuré des retours stagiaire/entreprise/financeur/formateur
 *          (≠ réclamations off.31 dans registres/reclamations.ts).
 *
 * Règles non négociables :
 * - Suppression RGPD = soft-delete + anonymisation PII (jamais DELETE physique).
 * - Export RGPD = JSON complet via exporterDonneesStagiaire.
 * - exactOptionalPropertyTypes.
 */

"use server";

import { z } from "zod";
import {
  requireAdminWrite,
  requireAdminPublish,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import {
  creerAppreciation,
  listAppreciations,
  statsAppreciations,
} from "@/server/qualiopi/portail/appreciation-service";
import {
  exporterDonneesStagiaire,
  supprimerStagiaire,
} from "@/server/qualiopi/portail/rgpd-service";
import { prisma } from "@/lib/prisma";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const APPRECIATION_SOURCES = ["stagiaire", "entreprise", "financeur", "formateur"] as const;

const creerAppreciationSchema = z.object({
  source: z.enum(APPRECIATION_SOURCES),
  enrollmentId: z.string().uuid().optional(),
  traineeId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  /** Note /5 (entier 1..5, optionnel). */
  note: z.number().int().min(1).max(5).optional(),
  commentaire: z.string().max(5000).optional(),
  dateAppreciation: z.coerce.date(),
});

const traiterDemandeRgpdSchema = z.object({
  demandeId: z.string().uuid(),
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — creerAppreciationAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une appréciation multi-parties (off.30).
 *
 * Admin : requireAdminWrite + audit log.
 */
export async function creerAppreciationAction(input: {
  source: (typeof APPRECIATION_SOURCES)[number];
  enrollmentId?: string;
  traineeId?: string;
  clientId?: string;
  note?: number;
  commentaire?: string;
  dateAppreciation: Date;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();

  const parsed = creerAppreciationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const created = await creerAppreciation({
    source: v.source,
    ...(v.enrollmentId !== undefined ? { enrollmentId: v.enrollmentId } : {}),
    ...(v.traineeId !== undefined ? { traineeId: v.traineeId } : {}),
    ...(v.clientId !== undefined ? { clientId: v.clientId } : {}),
    ...(v.note !== undefined ? { note: v.note } : {}),
    ...(v.commentaire !== undefined ? { commentaire: v.commentaire } : {}),
    dateAppreciation: v.dateAppreciation,
  });

  await logQualiopiActivity({
    action: "qualiopi.appreciations.creer",
    targetType: "Appreciation",
    targetId: created.id,
    changes: {
      source: v.source,
      ...(v.traineeId !== undefined ? { traineeId: v.traineeId } : {}),
      ...(v.enrollmentId !== undefined ? { enrollmentId: v.enrollmentId } : {}),
      ...(v.note !== undefined ? { note: v.note } : {}),
    },
    session,
  });

  return { data: { id: created.id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — traiterDemandeRgpdAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Traite une demande RGPD en attente :
 *   - type=export    → retourne le JSON de toutes les données du stagiaire.
 *   - type=suppression → anonymise PII + deletedAt.
 *
 * Marque la demande comme "traitee" dans les deux cas.
 *
 * Règle RGPD : la suppression effective = soft-delete + anonymisation PII.
 * Jamais de DELETE physique (intégrité comptable + obligations légales art.17§3b).
 */
export async function traiterDemandeRgpdAction(input: {
  demandeId: string;
}): Promise<ActionResult<{ type: string; exportData?: object }>> {
  // 🔴 F45 — clore une demande RGPD (accès ou effacement) engage la
  // responsabilité du responsable de traitement : ce n'est pas une opération
  // d'édition courante. Réservé à `admin` / `super_admin`.
  const session = await requireAdminPublish();

  const parsed = traiterDemandeRgpdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { demandeId } = parsed.data;

  // Récupérer la demande
  const demande = await prisma.rgpdDemande.findUnique({
    where: { id: demandeId },
    select: { id: true, traineeId: true, type: true, statut: true },
  });

  if (!demande) return { error: "Demande RGPD introuvable" };
  if (demande.statut !== "demandee") return { error: "Demande déjà traitée ou refusée" };

  let exportData: object | undefined;

  if (demande.type === "export") {
    exportData = await exporterDonneesStagiaire(demande.traineeId);
  } else {
    // type === "suppression"
    await supprimerStagiaire(demande.traineeId);
  }

  // Marquer comme traitée
  await prisma.rgpdDemande.update({
    where: { id: demandeId },
    data: {
      statut: "traitee",
      traiteeAt: new Date(),
    },
  });

  await logQualiopiActivity({
    action: `qualiopi.rgpd.traiter.${demande.type}`,
    targetType: "RgpdDemande",
    targetId: demandeId,
    changes: { traineeId: demande.traineeId, type: demande.type },
    session,
  });

  return {
    data: {
      type: demande.type,
      ...(exportData !== undefined ? { exportData } : {}),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ré-exports des services pour consommation directe par l'UI admin
// ─────────────────────────────────────────────────────────────────────────────

export { listAppreciations, statsAppreciations };
