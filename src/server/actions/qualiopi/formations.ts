/**
 * Qualiopi — Server Actions Formation (T3 + T17 CLUSTER 3 + T18 CLUSTER B).
 *
 * createFormationAction       : crée une formation intention liée à une offre.
 * updateFormationAction       : met à jour les champs éditoriaux.
 * validateFormationAction     : valide humainement (AI Act art. 50 — bloque la publication).
 * publishFormationAction      : publie (nécessite validation humaine + ratio pratique ≥ plancher).
 * publierIndicateursAction    : publie les indicateurs de résultats (off.1/2 Qualiopi).
 * setCertificationAction      : pose les champs RS/RNCP + recalcule cpfEligible (T18 CLUSTER B).
 * archiveFormationAction      : retire une formation du catalogue actif (WS6).
 * duplicateFormationAction    : clone une formation en brouillon nouvelle version (WS6).
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
import { withNumberRetry } from "@/server/qualiopi/numbering/retry";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { setCertification } from "@/server/qualiopi/formations/certification-service";
import { revalidateFormationPages } from "@/server/actions/qualiopi/_revalidate";
import { enqueueFormationGeneration } from "@/server/queue/queues";
import {
  countLockingSessions,
  appendVersionEntry,
  bumpProgrammeVersion,
  LOCKED_BY_SESSION_ERROR,
  type FormationVersionEntry,
} from "@/server/qualiopi/formations/edit-guard";

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
  // Paramètres pédagogiques (chantier Excellence) — enrichissent la génération IA.
  niveau: z.enum(["debutant", "intermediaire", "avance", "tous_niveaux"]).optional(),
  prerequis: z.string().max(2000).optional(),
  secteurCible: z.string().max(200).optional(),
  outilsClient: z.string().max(2000).optional(),
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

  // Allocation numéro séquentiel + insertion, avec retry sur collision (R7)
  const created = await withNumberRetry(async () => {
    const numero = await allocateFormationNumero();
    return prisma.formation.create({
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
  });

  await logQualiopiActivity({
    action: "qualiopi.formation.create",
    targetType: "Formation",
    targetId: created.id,
    changes: { numero: created.numero, titre: v.titre, slug: v.slug, offreSiteId: v.offreSiteId },
    session,
  });

  revalidateFormationPages({ slug: v.slug });

  return { data: { id: created.id, numero: created.numero } };
}

/**
 * Met à jour les champs éditoriaux d'une formation (contenu, seuils, accessibilité).
 * Ne touche PAS à la numérotation.
 *
 * Gardes de conformité (WS4) :
 *   - BLOQUÉ si une session est en cours/réalisée (contenu figé, cf. WS5/WS6).
 *   - Toute modification substantielle d'une formation VALIDÉE réinitialise la
 *     validation humaine (`validatedBy`/`validatedAt`) et rétrograde
 *     `statutGeneration` hors de `publie` (AI Act art. 50).
 *   - Trace une entrée d'historique (`versionHistorique`) + bump de version.
 */
export async function updateFormationAction(
  input: z.infer<typeof updateFormationSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateFormationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...fields } = parsed.data;

  const formation = await prisma.formation.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      statutGeneration: true,
      validatedBy: true,
      versionProgramme: true,
      versionHistorique: true,
    },
  });
  if (!formation) return { error: "Formation introuvable" };

  // Garde 1 — sessions verrouillantes (contenu figé).
  if ((await countLockingSessions(prisma, id)) > 0) {
    return { error: LOCKED_BY_SESSION_ERROR };
  }

  const dataChanges: Record<string, unknown> = {};
  if (fields.titre !== undefined) dataChanges.titre = fields.titre;
  if (fields.objectifsPedagogiques !== undefined)
    dataChanges.objectifsPedagogiques = fields.objectifsPedagogiques as never;
  if (fields.programmeDetaille !== undefined)
    dataChanges.programmeDetaille = fields.programmeDetaille as never;
  if (fields.methodesPedagogiques !== undefined)
    dataChanges.methodesPedagogiques = fields.methodesPedagogiques;
  if (fields.seuilReussitePct !== undefined) dataChanges.seuilReussitePct = fields.seuilReussitePct;
  if (fields.ratioPratiquePct !== undefined) dataChanges.ratioPratiquePct = fields.ratioPratiquePct;
  if (fields.accessibleHandicap !== undefined)
    dataChanges.accessibleHandicap = fields.accessibleHandicap;
  if (fields.niveau !== undefined) dataChanges.niveau = fields.niveau;
  if (fields.prerequis !== undefined) dataChanges.prerequis = fields.prerequis;
  if (fields.secteurCible !== undefined) dataChanges.secteurCible = fields.secteurCible;
  if (fields.outilsClient !== undefined) dataChanges.outilsClient = fields.outilsClient;
  if (fields.certificationType !== undefined)
    dataChanges.certificationType = fields.certificationType;
  if (fields.codeCpf !== undefined) dataChanges.codeCpf = fields.codeCpf;

  const changedFields = Object.keys(dataChanges);
  if (changedFields.length === 0) return { data: { id } };

  // Garde 2 — toute édition substantielle d'une formation PUBLIÉE ou VALIDÉE
  // invalide la validation et la dépublie (AI Act art.50). On dépublie même si
  // `validatedBy` est null : une formation peut atteindre `publie` via le moteur
  // (FileValidation) sans poser validatedBy ; sinon elle resterait publique avec
  // un contenu modifié non re-validé.
  const wasValidated = formation.validatedBy !== null;
  const wasPublished = formation.statutGeneration === "publie";
  const requiresRevalidation = wasValidated || wasPublished;
  const nextVersion = bumpProgrammeVersion(formation.versionProgramme);
  const entry: FormationVersionEntry = {
    version: nextVersion,
    at: new Date().toISOString(),
    by: session.userId,
    action: "update",
    fields: changedFields,
    ...(requiresRevalidation ? { revalidationRequired: true } : {}),
  };

  await prisma.formation.update({
    where: { id },
    data: {
      ...dataChanges,
      versionProgramme: nextVersion,
      versionHistorique: appendVersionEntry(formation.versionHistorique, entry) as never,
      ...(wasValidated ? { validatedBy: null, validatedAt: null } : {}),
      ...(wasPublished ? { statutGeneration: "assemble" } : {}),
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.formation.update",
    targetType: "Formation",
    targetId: id,
    changes: { ...fields, revalidationRequired: wasValidated, version: nextVersion },
    session,
  });

  revalidateFormationPages({ slug: formation.slug });

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
    select: { id: true, statutGeneration: true, slug: true },
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

  revalidateFormationPages({ slug: formation.slug });

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
      slug: true,
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

  // Auto-génération : la formation est validée + publiée → on enfile la
  // production de TOUS les supports + le diaporama (fail-soft, en tâche de fond).
  // Les documents apparaissent seuls dans la console, sans clic manuel.
  await enqueueFormationGeneration({ formationId: idParsed.data, generateSupports: true });

  await logQualiopiActivity({
    action: "qualiopi.formation.publish",
    targetType: "Formation",
    targetId: idParsed.data,
    changes: { statutGeneration: "publie", autoSupports: true },
    session,
  });

  revalidateFormationPages({ slug: formation.slug });

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
 * Gardes de conformité (WS4) : bloqué si une session est en cours/réalisée (la
 * finançabilité CPF/EDOF d'une prestation livrée ne peut être modifiée
 * rétroactivement) ; réinitialise la validation humaine si la formation était
 * validée + trace l'historique de version.
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
    select: {
      id: true,
      slug: true,
      statutGeneration: true,
      validatedBy: true,
      versionProgramme: true,
      versionHistorique: true,
    },
  });
  if (!formation) return { error: "Formation introuvable" };

  // Garde — sessions verrouillantes (finançabilité figée).
  if ((await countLockingSessions(prisma, formationId)) > 0) {
    return { error: LOCKED_BY_SESSION_ERROR };
  }

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

  // Audit + invalidation de la validation humaine (WS4) : le changement de
  // certification est substantiel (impacte la finançabilité CPF).
  const changedCertFields = Object.keys(certFields).filter(
    (k) => (certFields as Record<string, unknown>)[k] !== undefined,
  );
  if (changedCertFields.length > 0) {
    const wasValidated = formation.validatedBy !== null;
    const wasPublished = formation.statutGeneration === "publie";
    const requiresRevalidation = wasValidated || wasPublished;
    const nextVersion = bumpProgrammeVersion(formation.versionProgramme);
    const entry: FormationVersionEntry = {
      version: nextVersion,
      at: new Date().toISOString(),
      by: session.userId,
      action: "certification",
      fields: changedCertFields,
      ...(requiresRevalidation ? { revalidationRequired: true } : {}),
    };
    await prisma.formation.update({
      where: { id: formationId },
      data: {
        versionProgramme: nextVersion,
        versionHistorique: appendVersionEntry(formation.versionHistorique, entry) as never,
        ...(wasValidated ? { validatedBy: null, validatedAt: null } : {}),
        ...(wasPublished ? { statutGeneration: "assemble" } : {}),
      },
    });
  }

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

  revalidateFormationPages({ slug: formation.slug });

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
    select: { id: true, titre: true, slug: true },
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

  revalidateFormationPages({ slug: formation.slug });

  return { data: { id: formationId, indicateursPubliesAt: now } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Archivage + duplication (WS6) — chemin prescrit quand une session verrouille
// l'édition (cf. WS4 : « archivez puis dupliquez pour une nouvelle version »).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Archive une formation (statut + statutGeneration → `archive`).
 *
 * Non destructif : les sessions et documents existants conservent leur snapshot
 * légal (WS5). Autorisé même avec des sessions en cours/réalisées — archiver ne
 * modifie aucun contenu engageant, ça retire seulement la formation du catalogue
 * actif (plus de nouvelle session possible, cf. canCreateSessionFor).
 *
 * Requiert ADMIN_PUBLISH (modification de la disponibilité du référentiel).
 */
export async function archiveFormationAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminPublish();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  const formation = await prisma.formation.findUnique({
    where: { id: idParsed.data },
    select: { id: true, slug: true, statut: true },
  });
  if (!formation) return { error: "Formation introuvable" };
  if (formation.statut === "archive") return { data: { id: idParsed.data } };

  await prisma.formation.update({
    where: { id: idParsed.data },
    data: { statut: "archive", statutGeneration: "archive" },
  });

  await logQualiopiActivity({
    action: "qualiopi.formation.archive",
    targetType: "Formation",
    targetId: idParsed.data,
    changes: { statut: "archive" },
    session,
  });

  revalidateFormationPages({ slug: formation.slug });

  return { data: { id: idParsed.data } };
}

/** Construit un slug libre dérivé de `base` (`-copie`, `-copie-2`, …). */
async function allocateCopySlug(base: string): Promise<string> {
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? `${base}-copie` : `${base}-copie-${i}`;
    const exists = await prisma.formation.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  // Repli improbable : suffixe horodaté pour garantir l'unicité.
  return `${base}-copie-${Date.now()}`;
}

/**
 * Duplique une formation en un nouveau brouillon éditable (nouvelle version).
 *
 * Copie le CONTENU pédagogique (titre, durée, objectifs, programme, méthodes,
 * moyens, ressources, accessibilité, ratio, seuil, types d'action, offre). NE
 * COPIE PAS les éléments propres à l'original : numéro, certification RS/RNCP
 * (réenregistrement requis), indicateurs de résultats, validation humaine,
 * historique de version, lien de synchro catalogue. La copie sort en
 * `intention`/`actif`, non validée, version `1.0` → repasse par le cycle
 * validation/publication.
 *
 * Requiert ADMIN_WRITE.
 */
export async function duplicateFormationAction(
  id: string,
): Promise<ActionResult<{ id: string; numero: string; slug: string }>> {
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  const source = await prisma.formation.findUnique({
    where: { id: idParsed.data },
    select: {
      titre: true,
      slug: true,
      offreSiteId: true,
      clientId: true,
      estSurMesure: true,
      dureeHeures: true,
      modalite: true,
      objectifsPedagogiques: true,
      programmeDetaille: true,
      methodesPedagogiques: true,
      moyensTechniques: true,
      ressourcesPedagogiques: true,
      seuilReussitePct: true,
      ratioPratiquePct: true,
      accessibleHandicap: true,
      niveau: true,
      prerequis: true,
      secteurCible: true,
      outilsClient: true,
      typesActionQualiopi: true,
      langueGeneration: true,
    },
  });
  if (!source) return { error: "Formation introuvable" };

  const newSlug = await allocateCopySlug(source.slug);

  let created: { id: string; numero: string };
  try {
    created = await withNumberRetry(async () => {
      const numero = await allocateFormationNumero();
      return prisma.formation.create({
        data: {
          numero,
          titre: `${source.titre} (copie)`,
          slug: newSlug,
          offreSiteId: source.offreSiteId,
          clientId: source.clientId,
          estSurMesure: source.estSurMesure,
          dureeHeures: source.dureeHeures,
          modalite: source.modalite,
          objectifsPedagogiques: source.objectifsPedagogiques as never,
          programmeDetaille: source.programmeDetaille as never,
          methodesPedagogiques: source.methodesPedagogiques,
          moyensTechniques: source.moyensTechniques,
          ressourcesPedagogiques: source.ressourcesPedagogiques as never,
          seuilReussitePct: source.seuilReussitePct,
          niveau: source.niveau,
          prerequis: source.prerequis,
          secteurCible: source.secteurCible,
          outilsClient: source.outilsClient,
          ...(source.ratioPratiquePct !== null
            ? { ratioPratiquePct: source.ratioPratiquePct }
            : {}),
          accessibleHandicap: source.accessibleHandicap,
          typesActionQualiopi: source.typesActionQualiopi,
          langueGeneration: source.langueGeneration,
          // Réinitialisations : nouveau cycle de vie, non certifié, non validé.
          statutGeneration: "intention",
          statut: "actif",
          versionProgramme: "1.0",
        },
        select: { id: true, numero: true },
      });
    });
  } catch {
    return { error: "Erreur lors de la duplication de la formation" };
  }

  await logQualiopiActivity({
    action: "qualiopi.formation.duplicate",
    targetType: "Formation",
    targetId: created.id,
    changes: { sourceId: idParsed.data, numero: created.numero, slug: newSlug },
    session,
  });

  revalidateFormationPages({ slug: newSlug });

  return { data: { id: created.id, numero: created.numero, slug: newSlug } };
}
