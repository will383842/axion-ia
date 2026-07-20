/**
 * Qualiopi — Server Actions formateurs (Trainer) — R9 audit E2E 2026-06-06.
 *
 * createTrainerAction       : crée un formateur (salarié ou sous-traitant).
 * updateTrainerAction       : met à jour les champs éditoriaux.
 * setTrainerHabilitationsAction : remplace la liste des formations habilitées.
 * verifyTrainerSousTraitantAction : marque la vérification data.gouv.fr (off.19/27).
 * setTrainerActifAction     : active / désactive un formateur.
 *
 * Guards RBAC write + audit ActivityLog. Email unique (P2002 → message clair).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  isTrainerHabilite,
  type TrainerHabilitationFields,
} from "@/server/qualiopi/trainers/trainers";
import { getTrainerConformite } from "@/server/qualiopi/trainers/documents";
import { getAllRegionSlugs } from "@/content/regions";

type ActionResult<T> = { data: T } | { error: string };

const TRAINER_STATUTS = ["salarie", "sous_traitant", "dirigeant"] as const;

// Région d'intervention : slug parmi les 13 régions FR + 5 DROM (SSOT regions.ts).
// Phase 2 calendrier (Will 2026-06-10). "" autorisé = non renseigné → null.
const REGION_SLUGS: ReadonlySet<string> = new Set(getAllRegionSlugs());
const regionField = z
  .string()
  .max(60)
  .optional()
  .refine((v) => v === undefined || v === "" || REGION_SLUGS.has(v), {
    message: "Région inconnue",
  });

const createTrainerSchema = z.object({
  nom: z.string().min(1).max(200),
  prenom: z.string().min(1).max(200),
  email: z.string().email(),
  telephone: z.string().max(40).optional(),
  statut: z.enum(TRAINER_STATUTS),
  region: regionField,
  cvUrl: z.string().url().optional(),
  domainesCompetences: z.array(z.unknown()).optional(),
  formationsHabilitees: z.array(z.string().uuid()).optional(),
  dateEmbauche: z.coerce.date().optional(),
  tarifJourneeHtCents: z.number().int().min(0).optional(),
  sousTraitantNda: z.string().max(20).optional(),
});

const updateTrainerSchema = z.object({
  id: z.string().uuid(),
  nom: z.string().min(1).max(200).optional(),
  prenom: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  telephone: z.string().max(40).optional(),
  statut: z.enum(TRAINER_STATUTS).optional(),
  region: regionField,
  cvUrl: z.string().url().optional(),
  domainesCompetences: z.array(z.unknown()).optional(),
  dateEmbauche: z.coerce.date().optional(),
  tarifJourneeHtCents: z.number().int().min(0).optional(),
  sousTraitantNda: z.string().max(20).optional(),
});

const setHabilitationsSchema = z.object({
  id: z.string().uuid(),
  formationsHabilitees: z.array(z.string().uuid()),
});

const verifySousTraitantSchema = z.object({
  id: z.string().uuid(),
  sousTraitantNda: z.string().min(1).max(20),
});

const setActifSchema = z.object({
  id: z.string().uuid(),
  actif: z.boolean(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/** Crée un formateur. Email unique (sinon erreur explicite). */
export async function createTrainerAction(
  input: z.infer<typeof createTrainerSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = createTrainerSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  try {
    const created = await prisma.trainer.create({
      data: {
        nom: v.nom,
        prenom: v.prenom,
        email: v.email,
        statut: v.statut,
        ...(v.region !== undefined ? { region: v.region === "" ? null : v.region } : {}),
        ...(v.telephone !== undefined ? { telephone: v.telephone } : {}),
        ...(v.cvUrl !== undefined ? { cvUrl: v.cvUrl, cvUploadedAt: new Date() } : {}),
        ...(v.domainesCompetences !== undefined
          ? { domainesCompetences: v.domainesCompetences as never }
          : {}),
        ...(v.formationsHabilitees !== undefined
          ? { formationsHabilitees: v.formationsHabilitees }
          : {}),
        ...(v.dateEmbauche !== undefined ? { dateEmbauche: v.dateEmbauche } : {}),
        ...(v.tarifJourneeHtCents !== undefined
          ? { tarifJourneeHtCents: v.tarifJourneeHtCents }
          : {}),
        ...(v.sousTraitantNda !== undefined ? { sousTraitantNda: v.sousTraitantNda } : {}),
      },
      select: { id: true },
    });

    await logQualiopiActivity({
      action: "qualiopi.trainer.create",
      targetType: "Trainer",
      targetId: created.id,
      changes: { nom: v.nom, prenom: v.prenom, email: v.email, statut: v.statut },
      session,
    });

    return { data: { id: created.id } };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { error: "Un formateur avec cet email existe déjà." };
    }
    return { error: "Erreur lors de la création du formateur." };
  }
}

/** Met à jour les champs éditoriaux d'un formateur. */
export async function updateTrainerAction(
  input: z.infer<typeof updateTrainerSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateTrainerSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...fields } = parsed.data;

  try {
    await prisma.trainer.update({
      where: { id },
      data: {
        ...(fields.nom !== undefined ? { nom: fields.nom } : {}),
        ...(fields.prenom !== undefined ? { prenom: fields.prenom } : {}),
        ...(fields.email !== undefined ? { email: fields.email } : {}),
        ...(fields.telephone !== undefined ? { telephone: fields.telephone } : {}),
        ...(fields.statut !== undefined ? { statut: fields.statut } : {}),
        ...(fields.region !== undefined
          ? { region: fields.region === "" ? null : fields.region }
          : {}),
        ...(fields.cvUrl !== undefined ? { cvUrl: fields.cvUrl, cvUploadedAt: new Date() } : {}),
        ...(fields.domainesCompetences !== undefined
          ? { domainesCompetences: fields.domainesCompetences as never }
          : {}),
        ...(fields.dateEmbauche !== undefined ? { dateEmbauche: fields.dateEmbauche } : {}),
        ...(fields.tarifJourneeHtCents !== undefined
          ? { tarifJourneeHtCents: fields.tarifJourneeHtCents }
          : {}),
        ...(fields.sousTraitantNda !== undefined
          ? { sousTraitantNda: fields.sousTraitantNda }
          : {}),
      },
    });

    await logQualiopiActivity({
      action: "qualiopi.trainer.update",
      targetType: "Trainer",
      targetId: id,
      changes: fields,
      session,
    });

    return { data: { id } };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { error: "Un formateur avec cet email existe déjà." };
    }
    return { error: "Erreur lors de la mise à jour du formateur." };
  }
}

/** Remplace la liste des formations habilitées d'un formateur. */
export async function setTrainerHabilitationsAction(
  input: z.infer<typeof setHabilitationsSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = setHabilitationsSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, formationsHabilitees } = parsed.data;

  // ── Dual-write : le tableau legacy ET la table normalisée ────────────────────
  // `Trainer.formationsHabilitees` (`String[]`) reste la source lue par
  // `isTrainerHabilite` tant que le backfill n'a pas tourné en production. On
  // écrit les deux dans UNE transaction : si la table diverge du tableau, la
  // garde d'habilitation deviendrait incohérente selon le lecteur.
  //
  // La table est reconstruite en entier (delete + createMany) plutôt que
  // patchée : un `set` remplace la liste, et rejouer un diff sur une liste courte
  // coûterait plus en complexité qu'en écritures.
  //
  // ⚠️ La table porte une FK vers `formations` : un id de formation supprimée,
  // toléré par le `String[]`, fait ÉCHOUER l'insert. C'est le but — mais cela
  // signifie qu'un formateur habilité sur une formation supprimée ne pourra plus
  // enregistrer ses habilitations tant qu'on ne l'aura pas retirée de la liste.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.trainer.update({ where: { id }, data: { formationsHabilitees } });
      await tx.trainerHabilitation.deleteMany({
        where: { trainerId: id, formationId: { notIn: formationsHabilitees } },
      });
      if (formationsHabilitees.length > 0) {
        await tx.trainerHabilitation.createMany({
          data: formationsHabilitees.map((formationId) => ({
            trainerId: id,
            formationId,
            habiliteById: session.userId,
          })),
          // Réhabiliter une formation déjà habilitée ne doit ni échouer sur
          // l'unicité, ni réécrire `habiliteAt` (la traçabilité Qualiopi date de
          // la PREMIÈRE habilitation, pas du dernier enregistrement du formulaire).
          skipDuplicates: true,
        });
      }
    });
  } catch {
    return { error: "Erreur lors de la mise à jour des habilitations." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer.habilitations",
    targetType: "Trainer",
    targetId: id,
    changes: { formationsHabilitees },
    session,
  });

  return { data: { id } };
}

/**
 * Marque un sous-traitant comme vérifié (data.gouv.fr) — off.19/27.
 * Pose `sousTraitantVerifieAt = now` et enregistre le NDA.
 */
export async function verifyTrainerSousTraitantAction(
  input: z.infer<typeof verifySousTraitantSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = verifySousTraitantSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, sousTraitantNda } = parsed.data;

  try {
    await prisma.trainer.update({
      where: { id },
      data: { sousTraitantNda, sousTraitantVerifieAt: new Date() },
    });
  } catch {
    return { error: "Erreur lors de la vérification du sous-traitant." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer.verify_sous_traitant",
    targetType: "Trainer",
    targetId: id,
    changes: { sousTraitantNda },
    session,
  });

  return { data: { id } };
}

/** Active / désactive un formateur (un inactif ne peut plus être assigné). */
export async function setTrainerActifAction(
  input: z.infer<typeof setActifSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = setActifSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, actif } = parsed.data;

  try {
    await prisma.trainer.update({ where: { id }, data: { actif } });
  } catch {
    return { error: "Erreur lors du changement de statut du formateur." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer.set_actif",
    targetType: "Trainer",
    targetId: id,
    changes: { actif },
    session,
  });

  return { data: { id } };
}

const assignTrainerSchema = z.object({
  sessionId: z.string().uuid(),
  /** null = retirer le formateur principal de la session. */
  trainerId: z.string().uuid().nullable(),
});

/**
 * Assigne (ou retire) le formateur principal d'une session — R9.
 *
 * BLOCAGE D'HABILITATION (off.6/19) : refuse si le formateur n'est pas habilité
 * sur la formation de la session, inactif, ou sous-traitant non vérifié.
 * `trainerId = null` retire l'assignation (toujours autorisé).
 */
export async function assignTrainerToSessionAction(
  input: z.infer<typeof assignTrainerSchema>,
): Promise<ActionResult<{ sessionId: string; avertissements: string[] }>> {
  const session = await requireAdminWrite();
  const parsed = assignTrainerSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, trainerId } = parsed.data;

  let trainingSession: { formationId: string } | null;
  try {
    trainingSession = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: { formationId: true },
    });
  } catch {
    return { error: "Erreur lors de la lecture de la session" };
  }
  if (!trainingSession) return { error: "Session introuvable" };

  // Snapshot du tarif du formateur à l'affectation (figé sur la ligne SessionFormateur).
  let tarifSnapshot: number | null = null;

  if (trainerId !== null) {
    let trainer: (TrainerHabilitationFields & { tarifJourneeHtCents: number | null }) | null;
    try {
      trainer = await prisma.trainer.findUnique({
        where: { id: trainerId },
        select: {
          actif: true,
          statut: true,
          formationsHabilitees: true,
          sousTraitantVerifieAt: true,
          tarifJourneeHtCents: true,
        },
      });
    } catch {
      return { error: "Erreur lors de la lecture du formateur" };
    }
    if (!trainer) return { error: "Formateur introuvable" };

    const check = isTrainerHabilite(trainer, trainingSession.formationId);
    if (!check.ok) {
      return { error: `Assignation refusée : ${check.raison}` };
    }
    tarifSnapshot = trainer.tarifJourneeHtCents ?? null;
  }

  // Dual-write transactionnel : la FK `formateurPrincipalId` (source de vérité,
  // lue par la garde d'habilitation) ET la table normalisée `SessionFormateur`
  // (rôle principal, snapshot tarif) restent synchrones. Un seul principal par
  // session (index partiel SQL) → on retire l'ancien avant de poser le nouveau.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.trainingSession.update({
        where: { id: sessionId },
        data: { formateurPrincipalId: trainerId },
      });
      await tx.sessionFormateur.deleteMany({
        where: {
          sessionId,
          role: "principal",
          ...(trainerId !== null ? { trainerId: { not: trainerId } } : {}),
        },
      });
      if (trainerId !== null) {
        await tx.sessionFormateur.upsert({
          where: { sessionId_trainerId: { sessionId, trainerId } },
          create: { sessionId, trainerId, role: "principal", tarifHtCents: tarifSnapshot },
          update: { role: "principal", tarifHtCents: tarifSnapshot },
        });
      }
    });
  } catch {
    return { error: "Erreur lors de l'assignation du formateur" };
  }

  // ── Conformité documentaire : AVERTISSEMENT, jamais blocage ──────────────────
  // L'habilitation (ci-dessus) est un refus dur : un formateur non habilité sur
  // une formation ne doit pas l'animer. La conformité documentaire, elle, est un
  // signal : le seuil de vigilance URSSAF (art. L.8222-1) s'apprécie-t-il par
  // mission ou sur le cumul annuel ? Tant qu'un juriste n'a pas tranché, bloquer
  // une affectation sur ce fondement empêcherait de travailler à tort. On assigne,
  // et on dit ce qui manque. Cf. `conformite.ts` (`vigilanceBloquante: false`).
  //
  // Une conformité illisible (formateur introuvable, base en erreur) ne bloque ni
  // n'invente : `getTrainerConformite` rend `null`, on n'avertit de rien.
  const avertissements: string[] = [];
  if (trainerId !== null) {
    const maintenant = new Date();
    try {
      const conformite = await getTrainerConformite(
        trainerId,
        maintenant.getFullYear(),
        maintenant,
      );
      if (conformite !== null) {
        for (const m of conformite.manquements) {
          if (m.gravite === "bloquant") avertissements.push(m.message);
        }
      }
    } catch {
      // Ne jamais faire échouer une affectation déjà écrite en base pour un
      // avertissement qu'on n'a pas su calculer.
    }
  }

  await logQualiopiActivity({
    action: "qualiopi.session.assign_formateur",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { formateurPrincipalId: trainerId, avertissements: avertissements.length },
    session,
  });

  return { data: { sessionId, avertissements } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions de développement des compétences (indicateur 22)
// ─────────────────────────────────────────────────────────────────────────────

const DEV_ACTION_TYPES = [
  "entretien_professionnel",
  "formation_suivie",
  "veille",
  "autre",
] as const;

const addTrainerDevelopmentActionSchema = z.object({
  trainerId: z.string().uuid(),
  type: z.enum(DEV_ACTION_TYPES),
  dateAction: z.coerce.date(),
  description: z.string().trim().max(2000).optional(),
});

/**
 * Enregistre une action de développement des compétences d'un formateur
 * (entretien professionnel / formation suivie / veille) — trace DATÉE distincte
 * du CV (indicateur 22). Sans ce write-path, off.22 serait incouvrable.
 */
export async function addTrainerDevelopmentActionAction(input: {
  trainerId: string;
  type: (typeof DEV_ACTION_TYPES)[number];
  dateAction: Date;
  description?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = addTrainerDevelopmentActionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const created = await prisma.trainerDevelopmentAction.create({
    data: {
      trainerId: v.trainerId,
      type: v.type,
      dateAction: v.dateAction,
      description: v.description ?? "",
    },
    select: { id: true },
  });

  await logQualiopiActivity({
    action: "qualiopi.trainer.development_action.create",
    targetType: "Trainer",
    targetId: v.trainerId,
    changes: { type: v.type, dateAction: v.dateAction.toISOString() },
    session,
  });

  return { data: { id: created.id } };
}

const deleteTrainerDevelopmentActionSchema = z.object({ id: z.string().uuid() });

/** Supprime une action de développement des compétences. */
export async function deleteTrainerDevelopmentActionAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = deleteTrainerDevelopmentActionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id } = parsed.data;

  const found = await prisma.trainerDevelopmentAction.findUnique({
    where: { id },
    select: { trainerId: true },
  });
  if (!found) return { error: "Action introuvable" };

  await prisma.trainerDevelopmentAction.delete({ where: { id } });

  await logQualiopiActivity({
    action: "qualiopi.trainer.development_action.delete",
    targetType: "Trainer",
    targetId: found.trainerId,
    changes: { deletedId: id },
    session,
  });

  return { data: { id } };
}
