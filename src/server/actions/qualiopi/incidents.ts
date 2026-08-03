/**
 * Qualiopi — Server Actions registre des incidents (LOT 4 — pilotage réel).
 *
 * creerIncidentAction     : déclare un incident.
 * updateIncidentAction    : met à jour un incident (dont statut/action corrective).
 * supprimerIncidentAction : supprime un incident (requireAdminDelete).
 *
 * Délègue au service incidents-service (stub-aware).
 */

"use server";

import { z } from "zod";
import {
  requireAdminWrite,
  requireAdminDelete,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import {
  creerIncident,
  updateIncident,
  supprimerIncident,
  getIncident,
} from "@/server/qualiopi/registres/incidents-service";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const INCIDENT_TYPES = ["pedagogique", "administratif", "technique", "autre"] as const;
const INCIDENT_GRAVITES = ["mineur", "majeur", "critique"] as const;
const INCIDENT_STATUTS = ["ouvert", "en_cours", "resolu"] as const;

/**
 * Faits reprochables à un intervenant externe (art. 7 de la procédure de
 * sous-traitance). Des FAITS observables, jamais un jugement.
 */
const INCIDENT_FAITS_INTERVENANT = [
  "annulation_tardive",
  "desistement",
  "retard",
  "preuve_manquante",
  "qualite_insuffisante",
  "autre",
] as const;

const miseEnCauseFields = {
  trainerId: z.string().uuid().nullable().optional(),
  sousTraitantId: z.string().uuid().nullable().optional(),
  faitIntervenant: z.enum(INCIDENT_FAITS_INTERVENANT).nullable().optional(),
};

interface EtatMiseEnCause {
  trainerId?: string | null | undefined;
  sousTraitantId?: string | null | undefined;
  faitIntervenant?: string | null | undefined;
}

/**
 * Une mise en cause doit être complète et univoque.
 *
 * Vérifié ici plutôt que laissé à la contrainte Postgres : le message doit dire
 * à Will ce qui manque. Un incident qui désigne un formateur sans dire ce qui lui
 * est reproché serait une accusation sans motif — inopposable à sa reconduction
 * (art. 8), donc inutile au registre.
 *
 * Retourne le message d'erreur, ou `null` si l'état est cohérent.
 */
function verifierCoherenceMiseEnCause(v: EtatMiseEnCause): string | null {
  if (v.trainerId && v.sousTraitantId) {
    return "Un incident met en cause un formateur OU un organisme, pas les deux";
  }
  if ((v.trainerId || v.sousTraitantId) && !v.faitIntervenant) {
    return "Précisez le fait reproché à l'intervenant";
  }
  return null;
}

const creerIncidentSchema = z.object({
  type: z.enum(INCIDENT_TYPES),
  gravite: z.enum(INCIDENT_GRAVITES),
  titre: z.string().min(1).max(300),
  description: z.string().max(10000).optional(),
  sessionId: z.string().uuid().nullable().optional(),
  dateIncident: z.coerce.date(),
  actionCorrective: z.string().max(10000).optional(),
  statut: z.enum(INCIDENT_STATUTS).optional(),
  ...miseEnCauseFields,
});

const updateIncidentSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(INCIDENT_TYPES).optional(),
  gravite: z.enum(INCIDENT_GRAVITES).optional(),
  titre: z.string().min(1).max(300).optional(),
  description: z.string().max(10000).optional(),
  sessionId: z.string().uuid().nullable().optional(),
  dateIncident: z.coerce.date().optional(),
  actionCorrective: z.string().max(10000).optional(),
  statut: z.enum(INCIDENT_STATUTS).optional(),
  ...miseEnCauseFields,
});

const supprimerIncidentSchema = z.object({ id: z.string().uuid() });

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/** Déclare un incident dans le registre (alimente M7/M9 du pilotage). */
export async function creerIncidentAction(input: {
  type: (typeof INCIDENT_TYPES)[number];
  gravite: (typeof INCIDENT_GRAVITES)[number];
  titre: string;
  description?: string;
  sessionId?: string | null;
  dateIncident: Date;
  actionCorrective?: string;
  statut?: (typeof INCIDENT_STATUTS)[number];
  trainerId?: string | null;
  sousTraitantId?: string | null;
  faitIntervenant?: (typeof INCIDENT_FAITS_INTERVENANT)[number] | null;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = creerIncidentSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const incoherence = verifierCoherenceMiseEnCause(v);
  if (incoherence !== null) return { error: incoherence };

  let incident: { id: string };
  try {
    incident = await creerIncident({
      type: v.type,
      gravite: v.gravite,
      titre: v.titre,
      dateIncident: v.dateIncident,
      ...(v.description !== undefined ? { description: v.description } : {}),
      ...(v.sessionId !== undefined ? { sessionId: v.sessionId } : {}),
      ...(v.actionCorrective !== undefined ? { actionCorrective: v.actionCorrective } : {}),
      ...(v.statut !== undefined ? { statut: v.statut } : {}),
      ...(v.trainerId !== undefined ? { trainerId: v.trainerId } : {}),
      ...(v.sousTraitantId !== undefined ? { sousTraitantId: v.sousTraitantId } : {}),
      ...(v.faitIntervenant !== undefined ? { faitIntervenant: v.faitIntervenant } : {}),
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement de l'incident" };
  }

  await logQualiopiActivity({
    action: "qualiopi.incident.create",
    targetType: "Incident",
    targetId: incident.id,
    changes: { type: v.type, gravite: v.gravite, titre: v.titre },
    session,
  });

  return { data: { id: incident.id } };
}

/** Met à jour un incident (statut resolu → resoluAt posé automatiquement). */
export async function updateIncidentAction(input: {
  id: string;
  type?: (typeof INCIDENT_TYPES)[number];
  gravite?: (typeof INCIDENT_GRAVITES)[number];
  titre?: string;
  description?: string;
  sessionId?: string | null;
  dateIncident?: Date;
  actionCorrective?: string;
  statut?: (typeof INCIDENT_STATUTS)[number];
  trainerId?: string | null;
  sousTraitantId?: string | null;
  faitIntervenant?: (typeof INCIDENT_FAITS_INTERVENANT)[number] | null;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateIncidentSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...fields } = parsed.data;

  const existe = await getIncident(id);
  if (existe === null) return { error: "Incident introuvable" };

  // Cohérence évaluée sur l'état FUSIONNÉ, pas sur les seuls champs envoyés :
  // corriger le titre d'un incident déjà rattaché à un formateur n'a pas à
  // renvoyer le fait reproché pour être accepté.
  const incoherence = verifierCoherenceMiseEnCause({
    trainerId: fields.trainerId !== undefined ? fields.trainerId : existe.trainerId,
    sousTraitantId:
      fields.sousTraitantId !== undefined ? fields.sousTraitantId : existe.sousTraitantId,
    faitIntervenant:
      fields.faitIntervenant !== undefined ? fields.faitIntervenant : existe.faitIntervenant,
  });
  if (incoherence !== null) return { error: incoherence };

  try {
    await updateIncident(id, {
      ...(fields.trainerId !== undefined ? { trainerId: fields.trainerId } : {}),
      ...(fields.sousTraitantId !== undefined ? { sousTraitantId: fields.sousTraitantId } : {}),
      ...(fields.faitIntervenant !== undefined ? { faitIntervenant: fields.faitIntervenant } : {}),
      ...(fields.type !== undefined ? { type: fields.type } : {}),
      ...(fields.gravite !== undefined ? { gravite: fields.gravite } : {}),
      ...(fields.titre !== undefined ? { titre: fields.titre } : {}),
      ...(fields.description !== undefined ? { description: fields.description } : {}),
      ...(fields.sessionId !== undefined ? { sessionId: fields.sessionId } : {}),
      ...(fields.dateIncident !== undefined ? { dateIncident: fields.dateIncident } : {}),
      ...(fields.actionCorrective !== undefined
        ? { actionCorrective: fields.actionCorrective }
        : {}),
      ...(fields.statut !== undefined ? { statut: fields.statut } : {}),
    });
  } catch {
    return { error: "Incident introuvable ou erreur de mise à jour" };
  }

  await logQualiopiActivity({
    action: "qualiopi.incident.update",
    targetType: "Incident",
    targetId: id,
    changes: fields,
    session,
  });

  return { data: { id } };
}

/** Supprime un incident du registre. */
export async function supprimerIncidentAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminDelete();
  const parsed = supprimerIncidentSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id } = parsed.data;

  const existe = await getIncident(id);
  if (existe === null) return { error: "Incident introuvable" };

  try {
    await supprimerIncident(id);
  } catch {
    return { error: "Erreur lors de la suppression de l'incident" };
  }

  await logQualiopiActivity({
    action: "qualiopi.incident.delete",
    targetType: "Incident",
    targetId: id,
    changes: { titre: existe.titre },
    session,
  });

  return { data: { id } };
}
