/**
 * Qualiopi — Server Actions formateurs (Trainer) — R9 audit E2E 2026-06-06.
 *
 * createTrainerAction       : crée un formateur (salarié, dirigeant ou sous-traitant).
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
import {
  requireAdminWrite,
  requireHabilitation,
  requireAdminDelete,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import {
  isTrainerHabilite,
  type TrainerHabilitationFields,
} from "@/server/qualiopi/trainers/trainers";
import { avertissementsAffectation } from "@/server/qualiopi/trainers/avertissements-affectation";
import {
  proposerMissionFormateur,
  retirerMissionsOuvertes,
} from "@/server/qualiopi/trainers/mission-formateur";
import {
  archiverAffectationsRetirees,
  lireAffectationsAvantRetrait,
} from "@/server/qualiopi/trainers/affectation-retiree";
import {
  detecterIndisponibiliteFormateur,
  formulerConflit,
} from "@/server/qualiopi/trainers/conflits-indisponibilite";
import { getTrainerConflicts } from "@/features/admin-planning/queries";
import type { PlanningStatut } from "@/features/admin-planning/types";
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

/**
 * Régions d'intervention MULTIPLES. `region` (mono-valeur) reste écrit en
 * parallèle avec la première du tableau : le calendrier et les filtres
 * existants la lisent, et une migration d'écrans ne doit pas casser une lecture
 * qui marchait.
 */
const regionsField = z
  .array(z.string().max(60))
  .max(13)
  .optional()
  .refine((v) => v === undefined || v.every((s) => REGION_SLUGS.has(s)), {
    message: "Région inconnue",
  });

/**
 * Domaine de compétence AVEC son niveau de maîtrise et la date à laquelle il a
 * été vérifié.
 *
 * 🔴 C'est la preuve que l'indicateur 21 réclame — « le prestataire détermine,
 * mobilise et ÉVALUE les compétences des intervenants ». La structure existait
 * en base et le PDF l'affichait déjà, mais AUCUN écran ne permettait de la
 * remplir : toute fiche formateur imprimait « — » en niveau et « Non vérifié »
 * en date, sur chaque ligne. Un auditeur lit ça comme une non-conformité, et il
 * a raison : rien ne prouvait la moindre évaluation.
 */
const NIVEAUX_MAITRISE = ["a_developper", "maitrise", "expert"] as const;
const domaineCompetenceSchema = z.object({
  domaine: z.string().min(1).max(120),
  niveauMaitrise: z.enum(NIVEAUX_MAITRISE).or(z.literal("")).optional(),
  /** ISO ou "" — la date à laquelle la maîtrise a été constatée. */
  verifiedAt: z.string().max(40).optional(),
});

const createTrainerSchema = z.object({
  nom: z.string().min(1).max(200),
  prenom: z.string().min(1).max(200),
  email: z.string().email(),
  telephone: z.string().max(40).optional(),
  statut: z.enum(TRAINER_STATUTS),
  region: regionField,
  regionsIntervention: regionsField,
  interventionFranceEntiere: z.boolean().optional(),
  adresseProfessionnelle: z.string().max(500).optional(),
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
  regionsIntervention: regionsField,
  interventionFranceEntiere: z.boolean().optional(),
  adresseProfessionnelle: z.string().max(500).optional(),
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

/**
 * Pièces de sous-traitance (art. 4 et 8). Tous les champs sont `.nullable()` :
 * `null` retire une pièce, `undefined` la laisse intacte. Sans cette distinction,
 * enregistrer la RC pro effacerait la date du contrat-cadre.
 */
const sousTraitancePiecesSchema = z.object({
  id: z.string().uuid(),
  sousTraitantContratSigneAt: z.coerce.date().nullable().optional(),
  sousTraitantScreenshotUrl: z.string().url().max(2000).nullable().optional(),
  sousTraitantProchaineVerifAt: z.coerce.date().nullable().optional(),
  rcProAttestationUrl: z.string().url().max(2000).nullable().optional(),
  rcProEcheanceAt: z.coerce.date().nullable().optional(),
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
        // `region` (mono) reste alimentée par la PREMIÈRE région retenue :
        // le calendrier et les filtres la lisent encore.
        ...(v.regionsIntervention !== undefined
          ? {
              regionsIntervention: v.regionsIntervention,
              ...(v.region === undefined && v.regionsIntervention[0] !== undefined
                ? { region: v.regionsIntervention[0] }
                : {}),
            }
          : {}),
        ...(v.interventionFranceEntiere !== undefined
          ? { interventionFranceEntiere: v.interventionFranceEntiere }
          : {}),
        ...(v.adresseProfessionnelle !== undefined
          ? { adresseProfessionnelle: v.adresseProfessionnelle }
          : {}),
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
        // `region` (mono) suit la PREMIÈRE région retenue : le calendrier et les
        // filtres existants la lisent encore, une saisie multi ne doit pas les
        // laisser sur une valeur périmée.
        ...(fields.regionsIntervention !== undefined
          ? {
              regionsIntervention: fields.regionsIntervention,
              ...(fields.region === undefined
                ? { region: fields.regionsIntervention[0] ?? null }
                : {}),
            }
          : {}),
        ...(fields.interventionFranceEntiere !== undefined
          ? { interventionFranceEntiere: fields.interventionFranceEntiere }
          : {}),
        ...(fields.adresseProfessionnelle !== undefined
          ? { adresseProfessionnelle: fields.adresseProfessionnelle }
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
  // Acte ENGAGEANT : habiliter un formateur engage la qualite de l'action (ind. 21/22).
  const session = await requireHabilitation("habiliter_formateur");
  const parsed = setHabilitationsSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, formationsHabilitees: demandees } = parsed.data;

  // 🔴 Constaté EN PRODUCTION le 2026-07-26. Le tableau legacy tolère des ids de
  // formations supprimées ; celui du dirigeant en portait 33, tous orphelins.
  // Le formulaire les renvoyait sans pouvoir les afficher, la clé étrangère les
  // rejetait, et la transaction entière était annulée — plus AUCUNE habilitation
  // ne pouvait être enregistrée, sans aucune issue par l'interface. Le
  // commentaire ci-dessous décrivait déjà le risque ; il s'était réalisé.
  //
  // On écarte donc les ids qui n'existent plus, plutôt que de faire échouer
  // l'enregistrement entier. Refuser en bloc n'apporte aucune sécurité ici : une
  // formation supprimée n'est pas une habilitation à conserver, c'est une
  // habilitation devenue sans objet.
  const existantes = await prisma.formation.findMany({
    where: { id: { in: demandees } },
    select: { id: true },
  });
  const connues = new Set(existantes.map((f) => f.id));
  const formationsHabilitees = demandees.filter((fid) => connues.has(fid));
  const ecartees = demandees.length - formationsHabilitees.length;

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
      // 🔴 RETIRER, jamais SUPPRIMER (2026-08-17).
      //
      // C'était un `deleteMany` : la ligne disparaissait, et avec elle la
      // réponse à « depuis quand n'est-il plus habilité ? ». Pire — si une
      // session a été ANIMÉE alors que le formateur était habilité, la
      // supprimer aujourd'hui détruisait la preuve de conformité de cette
      // session PASSÉE (ind. 21/22).
      //
      // `retireAt: null` dans le `where` : on ne re-retire pas ce qui l'est
      // déjà, sinon chaque enregistrement du formulaire réécrirait la date de
      // retrait et ferait mentir l'historique.
      await tx.trainerHabilitation.updateMany({
        where: {
          trainerId: id,
          formationId: { notIn: formationsHabilitees },
          retireAt: null,
        },
        data: { retireAt: new Date(), retireById: session.userId },
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
          //
          // ⚠️ L'unicité est désormais PARTIELLE (`WHERE retire_at IS NULL`) :
          // `skipDuplicates` ne saute donc que les habilitations ACTIVES. Une
          // formation retirée puis re-cochée crée une NOUVELLE ligne — c'est
          // voulu, la re-prononciation est un acte daté, et l'ancienne reste au
          // registre avec son retrait.
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
    changes: { formationsHabilitees, orphelinsEcartes: ecartees },
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
  // Acte ENGAGEANT : lever la reserve d'un sous-traitant l'autorise a animer (ind. 27).
  const session = await requireHabilitation("habiliter_formateur");
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

/**
 * Enregistre les pièces de sous-traitance d'un formateur indépendant — art. 4
 * et 8 de la procédure de sous-traitance (2026-08-03).
 *
 * 🔴 Sans cette action, les six colonnes posées par la migration du 2026-08-03
 * n'auraient AUCUN écrivain : les alertes les liraient, la carte de conformité
 * les compterait, et un sous-traitant afficherait « contrat-cadre manquant »
 * en critique à vie sans qu'aucune manipulation puisse y changer quoi que ce
 * soit. C'est le défaut « code complet sans appelant » relevé six fois dans
 * l'audit du 2026-08-03.
 *
 * Tous les champs sont optionnels et écrits par spread conditionnel : Will
 * enregistre les pièces au fil de leur arrivée, sans effacer les précédentes.
 * `null` efface explicitement (pièce retirée), `undefined` laisse en l'état.
 */
export async function updateTrainerSousTraitancePiecesAction(
  input: z.infer<typeof sousTraitancePiecesSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = sousTraitancePiecesSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...v } = parsed.data;

  try {
    await prisma.trainer.update({
      where: { id },
      data: {
        ...(v.sousTraitantContratSigneAt !== undefined
          ? { sousTraitantContratSigneAt: v.sousTraitantContratSigneAt }
          : {}),
        ...(v.sousTraitantScreenshotUrl !== undefined
          ? {
              sousTraitantScreenshotUrl: v.sousTraitantScreenshotUrl,
              // La capture et sa date sont une seule preuve : une URL sans date
              // ne dirait pas QUAND la vérification a eu lieu, ce qui est
              // précisément ce que l'auditeur regarde.
              sousTraitantScreenshotDate: v.sousTraitantScreenshotUrl === null ? null : new Date(),
            }
          : {}),
        ...(v.sousTraitantProchaineVerifAt !== undefined
          ? { sousTraitantProchaineVerifAt: v.sousTraitantProchaineVerifAt }
          : {}),
        ...(v.rcProAttestationUrl !== undefined
          ? { rcProAttestationUrl: v.rcProAttestationUrl }
          : {}),
        ...(v.rcProEcheanceAt !== undefined ? { rcProEcheanceAt: v.rcProEcheanceAt } : {}),
      },
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement des pièces de sous-traitance." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer.sous_traitance_pieces",
    targetType: "Trainer",
    targetId: id,
    changes: v,
    session,
  });

  return { data: { id } };
}

/**
 * Remplace les domaines de compétences AVEC leur niveau de maîtrise et la date
 * à laquelle chacun a été vérifié.
 *
 * 🔴 C'est la preuve de l'indicateur 21 — « déterminer, mobiliser et ÉVALUER
 * les compétences ». La structure `{domaine, niveauMaitrise, verifiedAt}`
 * existait en base, la fiche formateur l'affichait déjà, et AUCUN écran ne
 * permettait de la remplir : chaque fiche sortait avec « — » en niveau et
 * « Non vérifié » en date, sur toutes ses lignes. Ce n'était pas un défaut
 * d'affichage, c'était une absence de preuve.
 *
 * ⚠️ Remplacement intégral, pas fusion : l'écran envoie la liste complète, et
 * une fusion rendrait impossible la SUPPRESSION d'un domaine — un formateur qui
 * cesse d'intervenir sur un sujet doit pouvoir le retirer.
 */
export async function setTrainerCompetencesAction(input: {
  id: string;
  domaines: Array<{ domaine: string; niveauMaitrise?: string; verifiedAt?: string }>;
}): Promise<ActionResult<{ id: string; nbDomaines: number }>> {
  const session = await requireAdminWrite();
  const parsed = z
    .object({ id: z.string().uuid(), domaines: z.array(domaineCompetenceSchema).max(50) })
    .safeParse(input);
  if (!parsed.success) return { error: "Données invalides (domaine, niveau ou date)" };
  const { id, domaines } = parsed.data;

  // Normalisation : on stocke toujours les trois clés, même vides. Un objet à
  // géométrie variable obligerait chaque lecteur à re-tester l'existence des
  // champs — c'est ce que `parseDomainesCompetences` compense aujourd'hui.
  const payload = domaines.map((d) => ({
    domaine: d.domaine.trim(),
    niveauMaitrise: d.niveauMaitrise ?? "",
    verifiedAt: d.verifiedAt ?? "",
  }));

  try {
    await prisma.trainer.update({
      where: { id },
      data: { domainesCompetences: payload as never },
    });
  } catch {
    return { error: "Formateur introuvable ou mise à jour impossible." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer.competences.set",
    targetType: "Trainer",
    targetId: id,
    changes: {
      nbDomaines: payload.length,
      // Traçabilité de l'ÉVALUATION : combien de domaines sont réellement
      // vérifiés, c'est la question que pose l'indicateur 21.
      nbVerifies: payload.filter((d) => d.verifiedAt !== "").length,
    },
    session,
  });

  return { data: { id, nbDomaines: payload.length } };
}

// 2026-08-10 (décision Will) : `setTrainerAfestHabiliteAction` supprimée — le
// coaching 1-to-1 est une prestation de conseil hors Qualiopi, l'habilitation
// AFEST n'a plus de surface d'écriture (le champ `afestHabiliteAt` reste au
// schéma, étape ultérieure).

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
): Promise<
  ActionResult<{ sessionId: string; avertissements: string[]; missionProposee: boolean }>
> {
  const session = await requireAdminWrite();
  const parsed = assignTrainerSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, trainerId } = parsed.data;

  let trainingSession: {
    formationId: string;
    dateDebut: Date;
    dateFin: Date | null;
    statut: string;
  } | null;
  try {
    trainingSession = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      // Dates et statut : necessaires au controle de conflit ci-dessous.
      select: { formationId: true, dateDebut: true, dateFin: true, statut: true },
    });
  } catch {
    return { error: "Erreur lors de la lecture de la session" };
  }
  if (!trainingSession) return { error: "Session introuvable" };

  // Snapshot du tarif du formateur à l'affectation (figé sur la ligne SessionFormateur).
  let tarifSnapshot: number | null = null;

  if (trainerId !== null) {
    // Les habilitations viennent de `TrainerHabilitation`, jamais de la colonne
    // legacy `formationsHabilitees` : celle-ci contenait des slugs en production
    // et la garde y comparait des UUID, donc refusait tout le monde (F11).
    let trainer:
      | (Omit<TrainerHabilitationFields, "formationIdsHabilites"> & {
          tarifJourneeHtCents: number | null;
          habilitations: { formationId: string }[];
        })
      | null;
    try {
      trainer = await prisma.trainer.findUnique({
        where: { id: trainerId },
        select: {
          actif: true,
          statut: true,
          sousTraitantVerifieAt: true,
          tarifJourneeHtCents: true,
          // 🔴 `retireAt: null` — même correctif que la garde de création, et
          // pour la même raison. Le passage du `deleteMany` à l'`updateMany`
          // daté (2026-08-17) a filtré `listTrainers` et
          // `getFormationIdsHabilites`, mais PAS cette lecture-ci, qui interroge
          // `prisma.trainer` en direct. L'assignation depuis la fiche session
          // acceptait donc encore un formateur dont l'habilitation venait d'être
          // retirée : le registre disait « retirée », la garde lisait « présente ».
          habilitations: { where: { retireAt: null }, select: { formationId: true } },
        },
      });
    } catch {
      return { error: "Erreur lors de la lecture du formateur" };
    }
    if (!trainer) return { error: "Formateur introuvable" };

    const check = isTrainerHabilite(
      { ...trainer, formationIdsHabilites: trainer.habilitations.map((h) => h.formationId) },
      trainingSession.formationId,
    );
    if (!check.ok) {
      return { error: `Assignation refusée : ${check.raison}` };
    }

    // 🔴 DOUBLE-AFFECTATION — le contrôle existait, personne ne l'appelait.
    //
    // `getTrainerConflicts` était écrit, testé, et son propre commentaire posait
    // le diagnostic : « rien n'empêchait jusqu'ici d'affecter un formateur à
    // deux prestations simultanées ; la garde `isTrainerHabilite` ne vérifie que
    // l'habilitation, jamais la disponibilité ». Mais il n'avait qu'UN appelant
    // — une page de DÉTAIL du planning. Le conflit s'affichait donc APRÈS
    // l'affectation, à qui ouvrait cette page. À un formateur on l'ouvre ; à
    // cent, personne ne l'ouvre.
    //
    // Le contrôle est déplacé là où la décision se prend. Il est en `try` :
    // une lecture de planning qui échoue ne doit pas bloquer une affectation
    // légitime — c'est un garde-fou d'ordonnancement, pas un acte engageant.
    try {
      const conflits = await getTrainerConflicts(trainerId, {
        key: `formation:${sessionId}`,
        debut: trainingSession.dateDebut,
        fin: trainingSession.dateFin,
        statut: trainingSession.statut as PlanningStatut,
      });
      if (conflits.length > 0) {
        const premier = conflits[0];
        const autres = conflits.length > 1 ? ` (et ${conflits.length - 1} autre(s))` : "";
        return {
          error:
            `Assignation refusée : ce formateur est déjà mobilisé sur « ${premier?.titre ?? "une autre prestation"} »` +
            ` du ${premier?.debut.toLocaleDateString("fr-FR")} au ${(premier?.fin ?? premier?.debut)?.toLocaleDateString("fr-FR")}${autres}.` +
            ` Libérez d'abord cette prestation, ou choisissez un autre formateur.`,
        };
      }
    } catch (err) {
      console.error(
        `[trainers] contrôle de conflit indisponible pour ${trainerId} sur ${sessionId}:`,
        err instanceof Error ? err.message : String(err),
      );
    }

    tarifSnapshot = trainer.tarifJourneeHtCents ?? null;
  }

  // 🔴 D6 (2026-09-05) — CE QUE LA SUPPRESSION CI-DESSOUS DÉTRUISAIT.
  //
  // Le `deleteMany` qui suit fait disparaître la ligne de l'ancien formateur, et
  // avec elle `tarifHtCents` (le tarif SNAPSHOTÉ à SON affectation, celui que sa
  // lettre de mission a repris), `heuresAnimees`, `convocationJ7EnvoyeeAt` et
  // `rappelJ1EnvoyeAt`. Après un remplacement, plus rien ne disait qu'une
  // personne avait un jour été le formateur de cette session — ni à quel tarif,
  // ni ce qu'on lui avait déjà envoyé. Sur un dossier qui doit se raconter
  // devant un auditeur, c'est une preuve perdue.
  //
  // On lit le snapshot AVANT la transaction (après, il n'y a plus rien à lire)
  // et on l'archive APRÈS son succès (avant, on écrirait un retrait qui n'a
  // peut-être pas eu lieu). Le choix d'une table d'archive plutôt qu'un
  // `retireAt` en place est motivé dans `affectation-retiree.ts` : ~20 lectures
  // de `SessionFormateur` signifient « qui anime MAINTENANT », et une ligne
  // conservée sans les filtrer paierait et convoquerait un formateur écarté.
  const ecartes = await lireAffectationsAvantRetrait({
    sessionId,
    role: "principal",
    saufTrainerId: trainerId,
  });

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

  // L'archive suit le succès. `remplacement` quand quelqu'un prend la place,
  // `desaffectation` quand l'organisme retire sans désigner personne : ce ne
  // sont pas les mêmes faits, et un auditeur ne lit pas le second comme le
  // premier.
  //
  // 🔴 CET APPEL AVAIT DISPARU. Un agent l'a remplacé par le marqueur
  // `// MUTATION` pour éprouver sa garde, puis est mort avant de le restaurer —
  // tué par le plafond de session à 10:20. Le code compilait, les tests
  // passaient, et l'archive n'était simplement JAMAIS écrite : la fonction
  // restait importée, jamais appelée. Un import inutilisé est le seul indice
  // qu'une mutation a survécu à son auteur.
  //
  // ⚠️ Fail-soft assumé : `archiverAffectationsRetirees` avale ses erreurs et
  // rend 0. Le remplacement a DÉJÀ eu lieu et il est juste ; refuser
  // l'affectation parce que le journal n'a pas pu s'écrire punirait
  // l'utilisateur pour une panne d'archive. C'est aussi ce qui rend cet appel
  // sûr pendant la fenêtre où le worker tourne du code plus récent que la
  // migration appliquée par l'app.
  await archiverAffectationsRetirees(ecartes, {
    motif: trainerId !== null ? "remplacement" : "desaffectation",
    retireById: session.userId,
  });

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
  //
  // 🔑 `D2-5-06` (2026-08-20) — le calcul est EXTRAIT dans
  // `avertissementsAffectation`. Il vivait ici, en ligne, et c'est pour ça que
  // l'autre voie d'affectation — la création de session — ne l'a jamais eu. Une
  // règle qui ne vit qu'à l'endroit où on l'a écrite ne protège que cet endroit.
  const avertissements = await avertissementsAffectation(trainerId);

  // 2026-09-03 — cycle de vie du formateur. L'affectation lui est PROPOSÉE :
  // un e-mail avec un lien pour accepter ou refuser (motif obligatoire). Les
  // sollicitations encore ouvertes des formateurs écartés sont retirées, sinon
  // l'un d'eux pourrait « accepter » une session qui n'est plus la sienne.
  // Fail-soft : l'affectation est faite, la proposition suit.
  //
  // 🔴 D1 (2026-09-05) — CE RETRAIT NE COUVRAIT QUE LES MISSIONS `en_attente`.
  //
  // La mission d'un formateur qui avait DÉJÀ ACCEPTÉ survivait au remplacement :
  // sa ligne `SessionFormateur` était supprimée trois lignes plus haut, mais son
  // accord restait `acceptee` en base, pour toujours. Trois règles d'alerte s'en
  // servent comme preuve que quelqu'un tient la place — A accepte, on le
  // remplace par B, B ne répond jamais, et la mission fantôme de A les fait
  // toutes taire. Cf. `retirerMissionsOuvertes`, qui porte le raisonnement.
  await retirerMissionsOuvertes(sessionId, { saufTrainerId: trainerId, role: "principal" });
  let missionProposee = false;
  if (trainerId !== null) {
    const proposition = await proposerMissionFormateur({ sessionId, trainerId, role: "principal" });
    missionProposee = proposition.proposee;
    if (!proposition.proposee && proposition.raison !== "stub") {
      console.warn(
        `[trainers] mission non proposée (${sessionId} → ${trainerId}) : ${proposition.raison}`,
      );
    }
    // Les congés du formateur, croisés avec les dates vendues. Non bloquant —
    // le système informe, Will arbitre — mais dit dès l'affectation.
    const conflit = await detecterIndisponibiliteFormateur(trainerId, {
      dateDebut: trainingSession.dateDebut,
      dateFin: trainingSession.dateFin,
    });
    if (conflit !== null) {
      avertissements.push(
        `Ce formateur s'est déclaré indisponible sur ${formulerConflit(conflit)}. Vérifiez avec lui avant de maintenir les dates.`,
      );
    }
  }

  await logQualiopiActivity({
    action: "qualiopi.session.assign_formateur",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: {
      formateurPrincipalId: trainerId,
      avertissements: avertissements.length,
      missionProposee,
    },
    session,
  });

  return { data: { sessionId, avertissements, missionProposee } };
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
  // `requireAdminDelete` (super_admin strict) et non `requireAdminWrite` :
  // `prisma.trainerDevelopmentAction.delete()` est un hard delete et le modele
  // n'a pas de `deletedAt`. C'est la preuve de l'indicateur 22 (entretien et
  // developpement des competences des formateurs) qui disparait sans recours.
  const session = await requireAdminDelete();
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
