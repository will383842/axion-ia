/**
 * Qualiopi — Server Actions Formation (T3 + T17 CLUSTER 3 + T18 CLUSTER B).
 *
 * createFormationAction       : crée une formation intention liée à une offre.
 * updateFormationAction       : met à jour les champs éditoriaux.
 * validateFormationAction     : valide humainement (AI Act art. 50 — bloque la publication).
 * publishFormationAction      : publie (nécessite validation humaine + ratio pratique ≥ plancher).
 * publierIndicateursAction    : publie les indicateurs de résultats (off.1/2 Qualiopi).
 * setCertificationAction      : pose les champs RS/RNCP + recalcule cpfEligible (T18 CLUSTER B).
 *
 * TVA : exonérée 261-4-4° CGI (pas de TVA sur formations).
 * Montants formation : résolus via offre / pricing.ts (jamais hardcodés ici).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAdminWrite,
  requireAdminPublish,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import { allocateFormationNumero } from "@/server/qualiopi/formations/numbering";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { setCertification } from "@/server/qualiopi/formations/certification-service";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Enums Zod (miroir enum Prisma)
// ─────────────────────────────────────────────────────────────────────────────

const MODALITES = ["presentiel", "distanciel", "hybride"] as const;
const TYPES_ACTION_QUALIOPI = [
  "classique",
  "certifiante",
  "foad",
  "alternance_afest",
  "sous_traitance",
  "cpf",
  "opco",
  "france_travail",
  "handicap",
] as const;
const CERTIFICATION_TYPES = ["aucune", "rs", "rncp"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const createFormationSchema = z.object({
  titre: z.string().min(1).max(255),
  slug: z.string().min(1).max(180),
  offreSiteId: z.string().uuid(),
  dureeHeures: z.number().int().positive(),
  modalite: z.enum(MODALITES),
  objectifsPedagogiques: z.unknown().optional(),
  typesActionQualiopi: z.array(z.enum(TYPES_ACTION_QUALIOPI)).optional(),
  estSurMesure: z.boolean().optional(),
  clientId: z.string().uuid().optional(),
});

const updateFormationSchema = z.object({
  id: z.string().uuid(),
  titre: z.string().min(1).max(255).optional(),
  objectifsPedagogiques: z.unknown().optional(),
  programmeDetaille: z.unknown().optional(),
  methodesPedagogiques: z.string().optional(),
  seuilReussitePct: z.number().int().min(0).max(100).optional(),
  ratioPratiquePct: z.number().int().min(0).max(100).optional(),
  accessibleHandicap: z.boolean().optional(),
  certificationType: z.enum(CERTIFICATION_TYPES).optional(),
  codeCpf: z.string().max(20).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une formation liée à une offre du catalogue.
 *
 * Validations métier :
 *   - L'offre doit exister et être active.
 *   - dureeHeures doit être dans [offre.dureeHeuresMin, offre.dureeHeuresMax].
 * Statut initial : statutGeneration='intention', statut='actif'.
 * Numéro alloué via allocateFormationNumero.
 */
export async function createFormationAction(
  input: z.infer<typeof createFormationSchema>,
): Promise<ActionResult<{ id: string; numero: string }>> {
  const session = await requireAdminWrite();
  const parsed = createFormationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Vérifier que l'offre existe et est active
  let offre: { id: string; actif: boolean; dureeHeuresMin: number; dureeHeuresMax: number } | null;
  try {
    offre = await prisma.offreSite.findUnique({
      where: { id: v.offreSiteId },
      select: { id: true, actif: true, dureeHeuresMin: true, dureeHeuresMax: true },
    });
  } catch {
    return { error: "Erreur lors de la vérification de l'offre" };
  }
  if (!offre) return { error: "Offre introuvable" };
  if (!offre.actif) return { error: "L'offre n'est pas active" };

  // Valider la durée dans la plage de l'offre
  if (v.dureeHeures < offre.dureeHeuresMin || v.dureeHeures > offre.dureeHeuresMax) {
    return {
      error: `La durée (${v.dureeHeures}h) doit être comprise entre ${offre.dureeHeuresMin}h et ${offre.dureeHeuresMax}h pour cette offre`,
    };
  }

  // Allouer le numéro séquentiel
  const numero = await allocateFormationNumero();

  const created = await prisma.formation.create({
    data: {
      numero,
      titre: v.titre,
      slug: v.slug,
      offreSiteId: v.offreSiteId,
      dureeHeures: v.dureeHeures,
      modalite: v.modalite,
      statutGeneration: "intention",
      statut: "actif",
      ...(v.objectifsPedagogiques !== undefined
        ? { objectifsPedagogiques: v.objectifsPedagogiques as never }
        : {}),
      ...(v.typesActionQualiopi !== undefined
        ? { typesActionQualiopi: v.typesActionQualiopi }
        : {}),
      ...(v.estSurMesure !== undefined ? { estSurMesure: v.estSurMesure } : {}),
      ...(v.clientId !== undefined ? { clientId: v.clientId } : {}),
    },
    select: { id: true, numero: true },
  });

  await logQualiopiActivity({
    action: "qualiopi.formation.create",
    targetType: "Formation",
    targetId: created.id,
    changes: { numero, titre: v.titre, slug: v.slug, offreSiteId: v.offreSiteId },
    session,
  });

  return { data: { id: created.id, numero: created.numero } };
}

/**
 * Met à jour les champs éditoriaux d'une formation (contenu, seuils, accessibilité).
 * Ne touche PAS au statut ni à la numérotation.
 */
export async function updateFormationAction(
  input: z.infer<typeof updateFormationSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateFormationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...fields } = parsed.data;

  await prisma.formation.update({
    where: { id },
    data: {
      ...(fields.titre !== undefined ? { titre: fields.titre } : {}),
      ...(fields.objectifsPedagogiques !== undefined
        ? { objectifsPedagogiques: fields.objectifsPedagogiques as never }
        : {}),
      ...(fields.programmeDetaille !== undefined
        ? { programmeDetaille: fields.programmeDetaille as never }
        : {}),
      ...(fields.methodesPedagogiques !== undefined
        ? { methodesPedagogiques: fields.methodesPedagogiques }
        : {}),
      ...(fields.seuilReussitePct !== undefined
        ? { seuilReussitePct: fields.seuilReussitePct }
        : {}),
      ...(fields.ratioPratiquePct !== undefined
        ? { ratioPratiquePct: fields.ratioPratiquePct }
        : {}),
      ...(fields.accessibleHandicap !== undefined
        ? { accessibleHandicap: fields.accessibleHandicap }
        : {}),
      ...(fields.certificationType !== undefined
        ? { certificationType: fields.certificationType }
        : {}),
      ...(fields.codeCpf !== undefined ? { codeCpf: fields.codeCpf } : {}),
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.formation.update",
    targetType: "Formation",
    targetId: id,
    changes: fields,
    session,
  });

  return { data: { id } };
}

/**
 * Valide humainement une formation (AI Act art. 50 — traçabilité obligatoire).
 *
 * Pose `validatedBy` = session.userId et `validatedAt` = now.
 * Condition préalable à publishFormationAction.
 */
export async function validateFormationAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  const formation = await prisma.formation.findUnique({
    where: { id: idParsed.data },
    select: { id: true, statutGeneration: true },
  });
  if (!formation) return { error: "Formation introuvable" };

  await prisma.formation.update({
    where: { id: idParsed.data },
    data: {
      validatedBy: session.userId,
      validatedAt: new Date(),
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.formation.validate",
    targetType: "Formation",
    targetId: idParsed.data,
    changes: { validatedBy: session.userId },
    session,
  });

  return { data: { id: idParsed.data } };
}

/**
 * Publie une formation (passe statutGeneration → 'publie').
 *
 * Prérequis bloquants (AI Act art. 50 + Qualiopi) :
 *   1. `validatedBy` non null — validation humaine obligatoire.
 *   2. `ratioPratiquePct` >= ratio_pratique_min * 100 (depuis SiteSetting).
 *
 * Retourne une erreur explicite si l'un des prérequis n'est pas satisfait.
 */
export async function publishFormationAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminPublish();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  const formation = await prisma.formation.findUnique({
    where: { id: idParsed.data },
    select: {
      id: true,
      statutGeneration: true,
      statut: true,
      validatedBy: true,
      ratioPratiquePct: true,
    },
  });
  if (!formation) return { error: "Formation introuvable" };

  // Prérequis 1 : validation humaine (AI Act art. 50)
  if (!formation.validatedBy) {
    return {
      error:
        "Publication bloquée : la formation doit être validée humainement avant publication (AI Act art. 50)",
    };
  }

  // Prérequis 2 : ratio pratique ≥ plancher (SiteSetting qualiopi.ratio_pratique_min)
  const ratioPratiqueMin = await getQualiopiConfig("ratio_pratique_min");
  const ratioPratiqueMinPct = Math.round(ratioPratiqueMin * 100);

  if (formation.ratioPratiquePct == null || formation.ratioPratiquePct < ratioPratiqueMinPct) {
    return {
      error: `Publication bloquée : le ratio pratique (${formation.ratioPratiquePct ?? "non défini"}%) doit être ≥ ${ratioPratiqueMinPct}% (plancher Qualiopi)`,
    };
  }

  await prisma.formation.update({
    where: { id: idParsed.data },
    data: { statutGeneration: "publie" },
  });

  await logQualiopiActivity({
    action: "qualiopi.formation.publish",
    targetType: "Formation",
    targetId: idParsed.data,
    changes: { statutGeneration: "publie" },
    session,
  });

  return { data: { id: idParsed.data } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Schéma certification RS/RNCP (T18 CLUSTER B)
// ─────────────────────────────────────────────────────────────────────────────

const setCertificationSchema = z.object({
  formationId: z.string().uuid(),
  certificationType: z.enum(CERTIFICATION_TYPES).optional(),
  codeRncp: z.string().max(20).nullable().optional(),
  codeRs: z.string().max(20).nullable().optional(),
  numeroEnregistrementFc: z.string().max(40).nullable().optional(),
  certificateurNom: z.string().max(250).nullable().optional(),
  estCertificateur: z.boolean().optional(),
  numeroHabilitation: z.string().max(60).nullable().optional(),
  dateEnregistrementCertif: z.coerce.date().nullable().optional(),
  dateEcheanceCertif: z.coerce.date().nullable().optional(),
  blocsCompetences: z.unknown().optional(),
});

/**
 * Met à jour les champs certification RS/RNCP d'une formation et recalcule
 * automatiquement cpfEligible (T18 CLUSTER B).
 *
 * Requiert ADMIN_PUBLISH (publication du référentiel certifiant).
 * Trace dans ActivityLog pour auditabilité Qualiopi.
 *
 * Stub-aware : le service setCertification retourne early si stub.invalid
 * (aucune mutation au build SSG).
 */
export async function setCertificationAction(
  input: z.infer<typeof setCertificationSchema>,
): Promise<ActionResult<{ id: string; cpfEligible: boolean }>> {
  const session = await requireAdminPublish();
  const parsed = setCertificationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { formationId, ...certFields } = parsed.data;

  const formation = await prisma.formation.findUnique({
    where: { id: formationId },
    select: { id: true },
  });
  if (!formation) return { error: "Formation introuvable" };

  // exactOptionalPropertyTypes : construire l'objet SetCertificationInput
  // explicitement pour éviter le spread de champs undefined.
  const {
    certificationType,
    codeRncp,
    codeRs,
    numeroEnregistrementFc,
    certificateurNom,
    estCertificateur,
    numeroHabilitation,
    dateEnregistrementCertif,
    dateEcheanceCertif,
    blocsCompetences,
  } = certFields;

  const serviceInput: import("@/server/qualiopi/formations/certification-service").SetCertificationInput =
    { formationId };
  if (certificationType !== undefined) serviceInput.certificationType = certificationType;
  if (codeRncp !== undefined) serviceInput.codeRncp = codeRncp;
  if (codeRs !== undefined) serviceInput.codeRs = codeRs;
  if (numeroEnregistrementFc !== undefined)
    serviceInput.numeroEnregistrementFc = numeroEnregistrementFc;
  if (certificateurNom !== undefined) serviceInput.certificateurNom = certificateurNom;
  if (estCertificateur !== undefined) serviceInput.estCertificateur = estCertificateur;
  if (numeroHabilitation !== undefined) serviceInput.numeroHabilitation = numeroHabilitation;
  if (dateEnregistrementCertif !== undefined)
    serviceInput.dateEnregistrementCertif = dateEnregistrementCertif;
  if (dateEcheanceCertif !== undefined) serviceInput.dateEcheanceCertif = dateEcheanceCertif;
  if (blocsCompetences !== undefined) serviceInput.blocsCompetences = blocsCompetences;

  const result = await setCertification(serviceInput);

  await logQualiopiActivity({
    action: "qualiopi.formation.certification.set",
    targetType: "Formation",
    targetId: formationId,
    changes: {
      ...certFields,
      cpfEligible: result.cpfEligible,
    },
    session,
  });

  return { data: result };
}

// ─────────────────────────────────────────────────────────────────────────────
// Schéma publication indicateurs (off.1/2 Qualiopi)
// ─────────────────────────────────────────────────────────────────────────────

const indicateurItemSchema = z.object({
  libelle: z.string().min(1).max(200),
  valeur: z.number(),
  unite: z.string().min(1).max(50),
  annee: z.number().int().min(2020).max(2100),
});

const publierIndicateursSchema = z.object({
  formationId: z.string().uuid(),
  indicateurs: z.array(indicateurItemSchema).min(1).max(20),
  methodeCalcul: z.string().min(1).max(2000),
});

/**
 * Publie les indicateurs de résultats d'une formation (off.1/2 Qualiopi).
 *
 * Enregistre `indicateursPublies` (Json), `methodeCalculIndicateurs` (String)
 * et `indicateursPubliesAt` (DateHeure de publication) sur la Formation.
 * Requiert ADMIN_PUBLISH (rôle publish).
 *
 * Stub-aware : le proxy Prisma stub short-circuit l'update au build sans
 * muter de données (les mutations throw côté stub — normal, aucun appel mutant
 * n'est fait au build puisqu'on nécessite une session admin authentifiée).
 */
export async function publierIndicateursAction(
  input: z.infer<typeof publierIndicateursSchema>,
): Promise<ActionResult<{ id: string; indicateursPubliesAt: Date }>> {
  const session = await requireAdminPublish();
  const parsed = publierIndicateursSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { formationId, indicateurs, methodeCalcul } = parsed.data;

  const formation = await prisma.formation.findUnique({
    where: { id: formationId },
    select: { id: true, titre: true },
  });
  if (!formation) return { error: "Formation introuvable" };

  const now = new Date();

  await prisma.formation.update({
    where: { id: formationId },
    data: {
      indicateursPublies: indicateurs as never,
      methodeCalculIndicateurs: methodeCalcul,
      indicateursPubliesAt: now,
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.formation.indicateurs.publier",
    targetType: "Formation",
    targetId: formationId,
    changes: {
      indicateursCount: indicateurs.length,
      methodeCalcul,
      indicateursPubliesAt: now.toISOString(),
    },
    session,
  });

  return { data: { id: formationId, indicateursPubliesAt: now } };
}
