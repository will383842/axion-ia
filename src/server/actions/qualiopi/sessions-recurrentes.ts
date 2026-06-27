/**
 * Qualiopi — Server Actions Sessions récurrentes & Report (T6).
 *
 * createRecurringSessionsAction : crée N occurrences liées par sessionParentId.
 * reportSessionAction            : reporte une session, migre les inscriptions.
 *
 * Ces actions sont DISTINCTES de createSessionAction/transitionSessionAction (T3)
 * pour éviter de grossir sessions.ts (SRP). Elles réutilisent :
 *   - writeSessionTransition (formations/transition-helper.ts)
 *   - allocateSessionNumero (formations/numbering.ts)
 *   - canCreateSessionFor (formations/formations.ts)
 *   - assertSessionTransition (formations/state-machine.ts)
 *   - requireAdminWrite, logQualiopiActivity (actions/qualiopi/_guards.ts)
 *
 * Règles métier T6 :
 *   - Sessions récurrentes : 2..52 occurrences (borne stricte), espacées de 7j
 *     (hebdomadaire) ou ~30j (mensuelle). Chaque occurrence = session indépendante
 *     (sessionParentId → parent) numérotée R01..R(N-1). Parent sans suffixe R.
 *   - Report : session planifiee|en_cours → statut reportee ; nouvelle session
 *     créée (sessionReporteeId = ancienne.id) ; enrollments migrés (@@unique
 *     gérée : si doublons → l'enrollment source est supprimé, cible conservée).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ModaliteFormation, FinancementType } from "@/server/qualiopi/formations/types";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { allocateSessionNumero } from "@/server/qualiopi/formations/numbering";
import { canCreateSessionFor } from "@/server/qualiopi/formations/formations";
import { assertSessionTransition } from "@/server/qualiopi/formations/state-machine";
import { writeSessionTransition } from "@/server/qualiopi/formations/transition-helper";
import {
  FORMATION_SNAPSHOT_SELECT,
  buildFormationSnapshot,
} from "@/server/qualiopi/formations/formation-snapshot";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const MIN_OCCURRENCES = 2;
const MAX_OCCURRENCES = 52;

/** Espacement hebdomadaire en ms (7 jours). */
const HEBDO_MS = 7 * 24 * 60 * 60 * 1000;
/** Espacement mensuel en ms (~30 jours — approximation ISO, pas calendaire exact). */
const MENSUEL_MS = 30 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const MODALITES = ["presentiel", "distanciel", "hybride"] as const;
const FINANCEMENT_TYPES = ["direct", "opco", "cpf", "france_travail", "mixte"] as const;

const createRecurringSessionsSchema = z.object({
  formationId: z.string().uuid(),
  premiereDateDebut: z.coerce.date(),
  dureeHeures: z.number().int().min(1).max(10000),
  frequence: z.enum(["hebdomadaire", "mensuelle"]),
  occurrences: z.number().int().min(MIN_OCCURRENCES).max(MAX_OCCURRENCES),
  modalite: z.enum(MODALITES),
  montantHtCents: z.number().int().min(0),
  nbParticipantsPrevus: z.number().int().min(1),
  titreSession: z.string().min(1).max(300).optional(),
  clientId: z.string().uuid().optional(),
  financementType: z.enum(FINANCEMENT_TYPES).optional(),
});

const reportSessionSchema = z.object({
  sessionId: z.string().uuid(),
  nouvelleDateDebut: z.coerce.date(),
  nouvelleDateFin: z.coerce.date(),
  motif: z.string().min(1).max(500),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers locaux
// ─────────────────────────────────────────────────────────────────────────────

/** Ajoute `deltaMs` à une date et retourne la nouvelle date UTC. */
function addMs(d: Date, deltaMs: number): Date {
  return new Date(d.getTime() + deltaMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée N occurrences d'une session récurrente rattachées à la même formation.
 *
 * - Occurrence 1 (parent) : pas de sessionParentId, numéro standard (AXI-SESS-YYYY-NNN).
 * - Occurrences 2..N (enfants) : sessionParentId = parent.id, numéro suffixé R01..R(N-1).
 * - Chaque occurrence a ses propres dates, statut `planifiee`, FormationTransition initiale.
 * - La transaction crée tout en atomique. En cas de collision de numéro (P2002), retour error.
 *
 * @param input Paramètres de la récurrence.
 */
export async function createRecurringSessionsAction(
  input: z.infer<typeof createRecurringSessionsSchema>,
): Promise<ActionResult<{ parentId: string; parentNumero: string; count: number }>> {
  const adminSession = await requireAdminWrite();
  const parsed = createRecurringSessionsSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Borne des occurrences (doublement vérifié par Zod + guard explicite pour clarté message)
  if (v.occurrences < MIN_OCCURRENCES || v.occurrences > MAX_OCCURRENCES) {
    return {
      error: `Le nombre d'occurrences doit être compris entre ${MIN_OCCURRENCES} et ${MAX_OCCURRENCES}`,
    };
  }

  // Vérifier que la formation est publiée et active. On lit aussi les champs du
  // snapshot légal (WS5) pour les figer dans chaque occurrence créée.
  let formation:
    | ({ id: string; statutGeneration: string; statut: string; titre: string } & {
        dureeHeures: number;
        modalite: string;
        objectifsPedagogiques: unknown;
        programmeDetaille: unknown;
        methodesPedagogiques: string;
        certificationType: string;
        versionProgramme: string;
      })
    | null;
  try {
    formation = await prisma.formation.findUnique({
      where: { id: v.formationId },
      select: { id: true, statutGeneration: true, statut: true, ...FORMATION_SNAPSHOT_SELECT },
    });
  } catch {
    return { error: "Erreur lors de la vérification de la formation" };
  }
  if (!formation) return { error: "Formation introuvable" };

  if (
    !canCreateSessionFor({
      statutGeneration: formation.statutGeneration as Parameters<
        typeof canCreateSessionFor
      >[0]["statutGeneration"],
      statut: formation.statut as Parameters<typeof canCreateSessionFor>[0]["statut"],
    })
  ) {
    return {
      error: `Impossible de créer des sessions récurrentes : la formation doit être publiée et active`,
    };
  }

  const titreSession = v.titreSession ?? formation.titre;
  // Snapshot légal (WS5) — fige la formation pour TOUTES les occurrences (elles
  // partagent la même prestation vendue au moment de la planification).
  const formationSnapshot = buildFormationSnapshot(formation, new Date());
  const deltaMs = v.frequence === "hebdomadaire" ? HEBDO_MS : MENSUEL_MS;
  const dureeDeltaMs = v.dureeHeures * 60 * 60 * 1000;

  // Pré-allouer les numéros avant la transaction (count+1 hors tx, acceptable car
  // @unique numéro reste le garde-fou final — collision P2002 → retry côté action).
  const numeros: string[] = [];
  for (let i = 0; i < v.occurrences; i++) {
    // Occurrence 0 (parent) : pas de suffixe de récurrence.
    // Occurrences 1..N-1 (enfants) : suffixe R01..R(N-1).
    const recurrenceOpt = i === 0 ? undefined : { recurrence: i };
    const numero = await allocateSessionNumero(recurrenceOpt);
    numeros.push(numero);
  }

  let parentId: string;
  let parentNumero: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      let parent: { id: string; numero: string } | null = null;

      for (let i = 0; i < v.occurrences; i++) {
        const dateDebut = addMs(v.premiereDateDebut, i * deltaMs);
        const dateFin = addMs(dateDebut, dureeDeltaMs);
        const numero = numeros[i]!;

        // Construire data de façon explicite pour éviter TS7022 (spread conditionnel
        // dans create data + exactOptionalPropertyTypes → inférence circulaire).
        type CreateData = Parameters<typeof tx.trainingSession.create>[0]["data"];
        const createData: CreateData = {
          numero,
          titreSession,
          formationId: v.formationId,
          dateDebut,
          dateFin,
          modalite: v.modalite as ModaliteFormation,
          nbParticipantsPrevus: v.nbParticipantsPrevus,
          montantHtCents: v.montantHtCents,
          formationSnapshot: formationSnapshot as never,
          statut: "planifiee",
        };
        if (i > 0 && parent !== null) {
          createData.sessionParentId = parent.id;
        }
        if (v.clientId !== undefined) {
          createData.clientId = v.clientId;
        }
        if (v.financementType !== undefined) {
          createData.financementType = v.financementType as FinancementType;
        }
        const created: { id: string; numero: string } = await tx.trainingSession.create({
          data: createData,
          select: { id: true, numero: true },
        });

        // FormationTransition initiale null → planifiee pour chaque occurrence.
        await writeSessionTransition(tx, {
          sessionId: created.id,
          from: null,
          to: "planifiee",
          trigger: i === 0 ? "admin.create.recurrent.parent" : `admin.create.recurrent.enfant`,
          triggeredBy: "admin",
          triggeredById: adminSession.userId,
        });

        if (i === 0) {
          parent = created;
        }
      }

      if (!parent) throw new Error("Création parent échouée");
      return parent;
    });

    parentId = result.id;
    parentNumero = result.numero;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return { error: "Conflit de numéro détecté, veuillez réessayer" };
    }
    return { error: "Erreur lors de la création des sessions récurrentes" };
  }

  await logQualiopiActivity({
    action: "qualiopi.session.create_recurrentes",
    targetType: "TrainingSession",
    targetId: parentId,
    changes: {
      parentNumero,
      formationId: v.formationId,
      occurrences: v.occurrences,
      frequence: v.frequence,
      premiereDateDebut: v.premiereDateDebut,
    },
    session: adminSession,
  });

  return { data: { parentId, parentNumero, count: v.occurrences } };
}

/**
 * Reporte une session de formation vers de nouvelles dates.
 *
 * Règles :
 *   - La session reportée doit être en statut `planifiee` ou `en_cours`.
 *   - Une nouvelle session est créée (sessionReporteeId = ancienne.id).
 *   - L'ancienne session passe à `reportee` (via assertSessionTransition).
 *   - Les Enrollment de l'ancienne session sont migrés vers la nouvelle.
 *     Gestion @@unique [sessionId, traineeId] : si un enrollment cible existe
 *     déjà (stagiaire déjà inscrit), l'enrollment source est supprimé (le
 *     stagiaire reste inscrit via l'enrollment cible existant).
 *   - Tout est dans une seule transaction.
 *
 * @param input Paramètres du report.
 */
export async function reportSessionAction(
  input: z.infer<typeof reportSessionSchema>,
): Promise<ActionResult<{ nouvelleSessionId: string; nouvelleSessionNumero: string }>> {
  const adminSession = await requireAdminWrite();
  const parsed = reportSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  if (v.nouvelleDateFin <= v.nouvelleDateDebut) {
    return { error: "La nouvelle date de fin doit être postérieure à la nouvelle date de début" };
  }

  // Charger la session à reporter avec ses enrollments
  let ancienne: {
    id: string;
    numero: string;
    statut: string;
    titreSession: string;
    formationId: string;
    modalite: string;
    nbParticipantsPrevus: number;
    montantHtCents: number;
    clientId: string | null;
    financementType: string | null;
    sessionParentId: string | null;
    enrollments: Array<{ id: string; traineeId: string; statut: string }>;
  } | null;

  try {
    ancienne = await prisma.trainingSession.findUnique({
      where: { id: v.sessionId },
      select: {
        id: true,
        numero: true,
        statut: true,
        titreSession: true,
        formationId: true,
        modalite: true,
        nbParticipantsPrevus: true,
        montantHtCents: true,
        clientId: true,
        financementType: true,
        sessionParentId: true,
        enrollments: {
          select: { id: true, traineeId: true, statut: true },
        },
      },
    });
  } catch {
    return { error: "Erreur lors de la lecture de la session" };
  }
  if (!ancienne) return { error: "Session introuvable" };

  // Valider que la session peut être reportée
  const statutAncienne = ancienne.statut as Parameters<typeof assertSessionTransition>[0];
  try {
    assertSessionTransition(statutAncienne, "reportee");
  } catch (err) {
    return {
      error: `Impossible de reporter cette session : ${err instanceof Error ? err.message : "transition interdite"}`,
    };
  }

  // Allouer le numéro de la nouvelle session (sans suffixe de récurrence)
  const nouveauNumero = await allocateSessionNumero();

  let nouvelleSessionId: string;
  let nouvelleSessionNumero: string;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Créer la session de remplacement
      const nouvelle = await tx.trainingSession.create({
        data: {
          numero: nouveauNumero,
          titreSession: ancienne!.titreSession,
          formationId: ancienne!.formationId,
          dateDebut: v.nouvelleDateDebut,
          dateFin: v.nouvelleDateFin,
          modalite: ancienne!.modalite as ModaliteFormation,
          nbParticipantsPrevus: ancienne!.nbParticipantsPrevus,
          montantHtCents: ancienne!.montantHtCents,
          statut: "planifiee",
          sessionReporteeId: ancienne!.id,
          ...(ancienne!.clientId !== null ? { clientId: ancienne!.clientId } : {}),
          ...(ancienne!.financementType !== null
            ? { financementType: ancienne!.financementType as FinancementType }
            : {}),
          ...(ancienne!.sessionParentId !== null
            ? { sessionParentId: ancienne!.sessionParentId }
            : {}),
        },
        select: { id: true, numero: true },
      });

      // FormationTransition initiale pour la nouvelle session (null → planifiee)
      await writeSessionTransition(tx, {
        sessionId: nouvelle.id,
        from: null,
        to: "planifiee",
        trigger: "admin.create.report",
        triggeredBy: "admin",
        triggeredById: adminSession.userId,
        reason: v.motif,
      });

      // 2. Passer l'ancienne session à `reportee`
      await writeSessionTransition(tx, {
        sessionId: ancienne!.id,
        from: statutAncienne,
        to: "reportee",
        trigger: "admin.report",
        triggeredBy: "admin",
        triggeredById: adminSession.userId,
        reason: v.motif,
      });
      await tx.trainingSession.update({
        where: { id: ancienne!.id },
        data: { statut: "reportee" },
      });

      // 3. Migrer les enrollments
      // @@unique [sessionId, traineeId] — si le stagiaire est déjà inscrit à la
      // nouvelle session (cas rare : inscription manuelle préalable), on supprime
      // l'enrollment source pour éviter le doublon. Sinon on transfère.
      for (const enrollment of ancienne!.enrollments) {
        try {
          await tx.enrollment.update({
            where: { id: enrollment.id },
            data: { sessionId: nouvelle.id },
          });
        } catch (enrollErr) {
          const code = (enrollErr as { code?: string })?.code;
          if (code === "P2002") {
            // Doublons : stagiaire déjà inscrit dans la nouvelle session.
            // On supprime l'enrollment source (l'enrollment cible reste).
            await tx.enrollment.delete({ where: { id: enrollment.id } });
          } else {
            throw enrollErr;
          }
        }
      }

      return nouvelle;
    });

    nouvelleSessionId = result.id;
    nouvelleSessionNumero = result.numero;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return { error: "Conflit de numéro détecté, veuillez réessayer" };
    }
    return { error: "Erreur lors du report de la session" };
  }

  await logQualiopiActivity({
    action: "qualiopi.session.report",
    targetType: "TrainingSession",
    targetId: ancienne.id,
    changes: {
      ancienNumero: ancienne.numero,
      nouvelleSessionId,
      nouvelleSessionNumero,
      nouvelleDateDebut: v.nouvelleDateDebut,
      nouvelleDateFin: v.nouvelleDateFin,
      motif: v.motif,
      enrollmentsMigres: ancienne.enrollments.length,
    },
    session: adminSession,
  });

  return { data: { nouvelleSessionId, nouvelleSessionNumero } };
}
