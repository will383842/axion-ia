/**
 * Qualiopi — Server Actions registre des incidents (LOT 4 — pilotage réel).
 *
 * creerIncidentAction       : déclare un incident (nature, déclarant, origine).
 * updateIncidentAction      : COMPLÈTE ce qui manque ou DÉCIDE d'un statut, avec
 *                             un motif — jamais une réécriture (L09).
 * ajouterNoteIncidentAction : note de suivi, en ajout seul.
 *
 * 🔴 Chantier QNC, L09 — `supprimerIncidentAction` n'existe plus, et
 * `updateIncidentAction` n'accepte plus titre, description, type, gravité ni
 * date : un incident déclaré est une pièce du registre. Chaque geste accepté
 * écrit une note signée du nom réel de la personne connectée.
 *
 * Délègue au service incidents-service (stub-aware).
 */

"use server";

import { z } from "zod";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  creerIncident,
  completerIncident,
  ajouterNoteIncident,
  getIncident,
} from "@/server/qualiopi/registres/incidents-service";
import {
  CHAMPS_FIGES_INCIDENT,
  DECLARANTS_INCIDENT,
  NATURES_INCIDENT,
  ORIGINES_INCIDENT,
} from "@/server/qualiopi/registres/incident-complement";
import { auteurAdministrateur } from "@/server/qualiopi/registres/auteur";

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

const qualificationFields = {
  nature: z.enum(NATURES_INCIDENT).optional(),
  declarant: z.enum(DECLARANTS_INCIDENT).optional(),
  origine: z.enum(ORIGINES_INCIDENT).optional(),
};

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
  ...qualificationFields,
});

/**
 * L09 — ce que `updateIncidentAction` accepte encore : compléter un champ
 * vide, ou décider d'un statut avec son motif. `strict()` : un champ figé
 * (titre, gravité…) envoyé quand même est refusé, pas ignoré en silence.
 */
const updateIncidentSchema = z
  .object({
    id: z.string().uuid(),
    statut: z.enum(INCIDENT_STATUTS).optional(),
    motif: z.string().trim().max(4000).optional(),
    sessionId: z.string().uuid().optional(),
    trainerId: z.string().uuid().optional(),
    sousTraitantId: z.string().uuid().optional(),
    faitIntervenant: z.enum(INCIDENT_FAITS_INTERVENANT).optional(),
    actionCorrective: z.string().max(10000).optional(),
    ...qualificationFields,
  })
  .strict();

const noteIncidentSchema = z.object({
  id: z.string().uuid(),
  texte: z.string().trim().min(3).max(4000),
});

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
  nature?: (typeof NATURES_INCIDENT)[number];
  declarant?: (typeof DECLARANTS_INCIDENT)[number];
  origine?: (typeof ORIGINES_INCIDENT)[number];
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
      declareParId: session.userId,
      ...(v.description !== undefined ? { description: v.description } : {}),
      ...(v.sessionId !== undefined ? { sessionId: v.sessionId } : {}),
      ...(v.actionCorrective !== undefined ? { actionCorrective: v.actionCorrective } : {}),
      ...(v.statut !== undefined ? { statut: v.statut } : {}),
      ...(v.trainerId !== undefined ? { trainerId: v.trainerId } : {}),
      ...(v.sousTraitantId !== undefined ? { sousTraitantId: v.sousTraitantId } : {}),
      ...(v.faitIntervenant !== undefined ? { faitIntervenant: v.faitIntervenant } : {}),
      ...(v.nature !== undefined ? { nature: v.nature } : {}),
      ...(v.declarant !== undefined ? { declarant: v.declarant } : {}),
      ...(v.origine !== undefined ? { origine: v.origine } : {}),
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

/**
 * Complète un incident ou décide de son statut (statut resolu → resoluAt posé
 * à la date du serveur). Le geste est écrit dans une note signée, dans la même
 * transaction ; rien de ce qui est renseigné ne se réécrit.
 */
export async function updateIncidentAction(input: {
  id: string;
  statut?: (typeof INCIDENT_STATUTS)[number];
  motif?: string;
  sessionId?: string;
  trainerId?: string;
  sousTraitantId?: string;
  faitIntervenant?: (typeof INCIDENT_FAITS_INTERVENANT)[number];
  actionCorrective?: string;
  nature?: (typeof NATURES_INCIDENT)[number];
  declarant?: (typeof DECLARANTS_INCIDENT)[number];
  origine?: (typeof ORIGINES_INCIDENT)[number];
}): Promise<ActionResult<{ id: string; note: string }>> {
  const session = await requireAdminWrite();
  const figes = CHAMPS_FIGES_INCIDENT.filter((c) => c in (input as object));
  if (figes.length > 0) {
    return {
      error:
        "Un incident déclaré ne se réécrit pas (titre, description, type, gravité, date) : ajoutez une note pour le corriger.",
    };
  }
  const parsed = updateIncidentSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...demande } = parsed.data;

  const auteur = await auteurAdministrateur(session);
  let resultat: Awaited<ReturnType<typeof completerIncident>>;
  try {
    resultat = await completerIncident(id, demande, auteur);
  } catch {
    return { error: "Incident introuvable ou erreur d'enregistrement" };
  }
  if (!resultat.ok) return { error: resultat.erreur };

  await logQualiopiActivity({
    action: "qualiopi.incident.complete",
    targetType: "Incident",
    targetId: id,
    changes: { ...demande, auteurNom: auteur.nom },
    session,
  });

  return { data: { id, note: resultat.note } };
}

/** Ajoute une note de suivi à un incident (ajout seul, auteur réel). */
export async function ajouterNoteIncidentAction(input: {
  id: string;
  texte: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = noteIncidentSchema.safeParse(input);
  if (!parsed.success) return { error: "Une note fait au moins 3 caractères" };
  const { id, texte } = parsed.data;

  const existe = await getIncident(id);
  if (existe === null) return { error: "Incident introuvable" };

  const auteur = await auteurAdministrateur(session);
  try {
    await ajouterNoteIncident(id, texte, auteur);
  } catch {
    return { error: "Erreur lors de l'enregistrement de la note" };
  }

  await logQualiopiActivity({
    action: "qualiopi.incident.note",
    targetType: "Incident",
    targetId: id,
    changes: { auteurNom: auteur.nom },
    session,
  });

  return { data: { id } };
}
