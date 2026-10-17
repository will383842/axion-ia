/**
 * Qualiopi — Server Actions Moyens pédagogiques (LOT 2 — off.17/18/19, doc A14).
 *
 * creerMoyenAction    : ajoute un moyen à l'inventaire.
 * updateMoyenAction   : met à jour un moyen (dont la date de vérification).
 * setMoyenActifAction : active/désactive un moyen (pas de suppression physique).
 *
 * Délègue au service moyens-service (stub-aware).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  creerMoyen,
  updateMoyen,
  setMoyenActif,
  getMoyen,
} from "@/server/qualiopi/moyens/moyens-service";
import {
  MESSAGES_REFUS_MOYEN,
  MoyenRefuse,
  modifierMoyenMotive,
  type ChampsMoyen,
} from "@/server/qualiopi/moyens/moyens-historique";
import { validerDateVerification } from "@/server/qualiopi/moyens/moyens-regles";
import { estActifPour, lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES_MOYEN = ["salle", "materiel", "plateforme", "humain"] as const;

// Une vérification de moyen atteste un contrôle DÉJÀ effectué : une date dans le
// futur n'a pas de sens et fausserait la preuve Qualiopi (off.17/18/19). On
// borne au présent, évalué à chaque requête.
const dateVerificationSchema = z.coerce
  .date()
  .nullable()
  .optional()
  .refine((d) => d == null || d.getTime() <= Date.now(), {
    message: "La date de vérification ne peut pas être dans le futur.",
  });

const creerMoyenSchema = z.object({
  categorie: z.enum(CATEGORIES_MOYEN),
  libelle: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  localisation: z.string().max(250).optional(),
  dateVerification: dateVerificationSchema,
});

// Chantier QNC L07 : le motif voyage avec la modification. Il n'est EXIGÉ que
// lorsque `qualiopi.moyens.actif` est allumé ; éteint, il est ignoré.
const motifSchema = z.string().max(2000).optional();

const updateMoyenSchema = z.object({
  id: z.string().uuid(),
  categorie: z.enum(CATEGORIES_MOYEN).optional(),
  libelle: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  localisation: z.string().max(250).optional(),
  dateVerification: dateVerificationSchema,
  motif: motifSchema,
});

const setMoyenActifSchema = z.object({
  id: z.string().uuid(),
  actif: z.boolean(),
  motif: z.string().max(2000).optional(),
});

/** Le lot « moyens » agit-il ? Pas de session ciblée : `essai` n'agit pas. */
async function lotMoyensAllume(): Promise<boolean> {
  return estActifPour(await lireInterrupteurQualiopi("moyens"), null);
}

/** Nom lisible de l'auteur, figé dans l'historique (jamais un identifiant). */
async function nomAuteur(userId: string, role: string): Promise<string> {
  const a = await prisma.adminUser.findUnique({ where: { id: userId }, select: { name: true } });
  return typeof a?.name === "string" && a.name.trim() !== "" ? a.name.trim() : role;
}

async function modifierAvecHistorique(
  session: { userId: string; role: string },
  id: string,
  champs: ChampsMoyen,
  motif: string | undefined,
): Promise<{ error: string } | null> {
  try {
    await modifierMoyenMotive(prisma as never, id, champs, {
      motif,
      auteur: { id: session.userId, nom: await nomAuteur(session.userId, session.role) },
      maintenant: new Date(),
    });
    return null;
  } catch (e) {
    if (e instanceof MoyenRefuse) return { error: MESSAGES_REFUS_MOYEN[e.code] };
    return { error: "Moyen pédagogique introuvable ou erreur de mise à jour" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ajoute un moyen pédagogique à l'inventaire (off.17/18/19).
 */
export async function creerMoyenAction(input: {
  categorie: (typeof CATEGORIES_MOYEN)[number];
  libelle: string;
  description?: string;
  localisation?: string;
  dateVerification?: Date | null;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = creerMoyenSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // QNC L07 : la ligne naît maintenant ; une vérification antérieure à sa
  // création est refusée (laisser vide, la vérification se date ensuite).
  if (v.dateVerification instanceof Date && (await lotMoyensAllume())) {
    const maintenant = new Date();
    if (!validerDateVerification(v.dateVerification, maintenant, maintenant).ok) {
      return { error: MESSAGES_REFUS_MOYEN.date_anterieure_creation };
    }
  }

  let moyen: { id: string };
  try {
    moyen = await creerMoyen({
      categorie: v.categorie,
      libelle: v.libelle,
      ...(v.description !== undefined ? { description: v.description } : {}),
      ...(v.localisation !== undefined ? { localisation: v.localisation } : {}),
      ...(v.dateVerification !== undefined ? { dateVerification: v.dateVerification } : {}),
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement du moyen pédagogique" };
  }

  await logQualiopiActivity({
    action: "qualiopi.moyen.create",
    targetType: "MoyenPedagogique",
    targetId: moyen.id,
    changes: { categorie: v.categorie, libelle: v.libelle },
    session,
  });

  return { data: { id: moyen.id } };
}

/**
 * Met à jour un moyen pédagogique existant (dont la date de vérification —
 * `dateVerification: null` efface la vérification).
 */
export async function updateMoyenAction(input: {
  id: string;
  categorie?: (typeof CATEGORIES_MOYEN)[number];
  libelle?: string;
  description?: string;
  localisation?: string;
  dateVerification?: Date | null;
  /** Motif de la modification — exigé quand `qualiopi.moyens.actif` est allumé. */
  motif?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateMoyenSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, motif, ...fields } = parsed.data;

  const existe = await getMoyen(id);
  if (existe === null) return { error: "Moyen pédagogique introuvable" };

  if (await lotMoyensAllume()) {
    const refus = await modifierAvecHistorique(
      session,
      id,
      {
        ...(fields.categorie !== undefined ? { categorie: fields.categorie } : {}),
        ...(fields.libelle !== undefined ? { libelle: fields.libelle } : {}),
        ...(fields.description !== undefined ? { description: fields.description } : {}),
        ...(fields.localisation !== undefined ? { localisation: fields.localisation } : {}),
        ...(fields.dateVerification !== undefined
          ? { dateVerification: fields.dateVerification }
          : {}),
      },
      motif,
    );
    if (refus !== null) return refus;
    await logQualiopiActivity({
      action: "qualiopi.moyen.update",
      targetType: "MoyenPedagogique",
      targetId: id,
      changes: fields,
      session,
    });
    return { data: { id } };
  }

  try {
    await updateMoyen(id, {
      ...(fields.categorie !== undefined ? { categorie: fields.categorie } : {}),
      ...(fields.libelle !== undefined ? { libelle: fields.libelle } : {}),
      ...(fields.description !== undefined ? { description: fields.description } : {}),
      ...(fields.localisation !== undefined ? { localisation: fields.localisation } : {}),
      ...(fields.dateVerification !== undefined
        ? { dateVerification: fields.dateVerification }
        : {}),
    });
  } catch {
    return { error: "Moyen pédagogique introuvable ou erreur de mise à jour" };
  }

  await logQualiopiActivity({
    action: "qualiopi.moyen.update",
    targetType: "MoyenPedagogique",
    targetId: id,
    changes: fields,
    session,
  });

  return { data: { id } };
}

/**
 * Active/désactive un moyen pédagogique (l'inventaire reste traçable —
 * jamais de suppression physique).
 */
export async function setMoyenActifAction(input: {
  id: string;
  actif: boolean;
  /** Motif — exigé quand `qualiopi.moyens.actif` est allumé. */
  motif?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = setMoyenActifSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, actif, motif } = parsed.data;

  const existe = await getMoyen(id);
  if (existe === null) return { error: "Moyen pédagogique introuvable" };

  if (await lotMoyensAllume()) {
    const refus = await modifierAvecHistorique(session, id, { actif }, motif);
    if (refus !== null) return refus;
    await logQualiopiActivity({
      action: "qualiopi.moyen.set_actif",
      targetType: "MoyenPedagogique",
      targetId: id,
      changes: { actif },
      session,
    });
    return { data: { id } };
  }

  try {
    await setMoyenActif(id, actif);
  } catch {
    return { error: "Moyen pédagogique introuvable ou erreur de mise à jour" };
  }

  await logQualiopiActivity({
    action: "qualiopi.moyen.set_actif",
    targetType: "MoyenPedagogique",
    targetId: id,
    changes: { actif },
    session,
  });

  return { data: { id } };
}
