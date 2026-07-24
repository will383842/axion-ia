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
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { revoquerTokensInscription } from "@/server/qualiopi/emargement/token-service";
import type { ModaliteFormation, FinancementType } from "@/server/qualiopi/formations/types";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { allocateSessionNumero } from "@/server/qualiopi/formations/numbering";
import { genererJoursParDefaut } from "@/server/qualiopi/presence/jours-defaut";
import type { JourSession } from "@/server/qualiopi/presence/creneaux";
import { parisDateISO } from "@/server/qualiopi/presence/time";
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
/**
 * Fin d'une session : le DERNIER jour généré, à son heure de fin.
 *
 * Repli sur `dateDebut + durée` quand aucune journée n'a pu être générée
 * (durée absente ou absurde) — comportement historique, conservé pour ne pas
 * créer de session sans date de fin.
 */
function finDepuisJours(dateDebut: Date, jours: JourSession[], dureeHeures: number): Date {
  const dernier = jours[jours.length - 1];
  if (dernier === undefined) return addMs(dateDebut, dureeHeures * 60 * 60 * 1000);
  const [h, m] = dernier.heureFin.split(":");
  return new Date(`${dernier.date}T${h}:${m}:00.000Z`);
}

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
  // ⚠️ `dateFin` NE PEUT PAS être `dateDebut + dureeHeures`. C'était le calcul
  // précédent, et il pliait toute session de plus d'une journée sur un seul jour
  // civil : une formation de 14 h partant le 10 juin à 09:00 « finissait » le
  // 10 juin à 23:00. Une formation de 2 jours était donc enregistrée comme
  // tenant sur un seul — et la feuille d'émargement l'aurait montré ainsi.
  //
  // La fin dérive maintenant des journées réellement générées (D14).

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
        const joursOccurrence = genererJoursParDefaut({
          dateDebutIso: parisDateISO(dateDebut),
          dureeHeures: v.dureeHeures,
        });
        const dateFin = finDepuisJours(dateDebut, joursOccurrence, v.dureeHeures);
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

        // Journées PROPOSÉES (D14). Sans elles, `session_jours` resterait vide
        // pour les 52 occurrences et le formateur devrait les saisir 52 fois.
        // `horairesConfirmes` reste à `false` : ce sont des propositions, et
        // l'écran de saisie les présente comme telles.
        if (joursOccurrence.length > 0) {
          await tx.sessionJour.createMany({
            data: joursOccurrence.map((j) => ({
              sessionId: created.id,
              date: new Date(`${j.date}T00:00:00.000Z`),
              heureDebut: j.heureDebut,
              heureFin: j.heureFin,
            })),
          });
        }

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
    formationSnapshot: unknown;
    clientId: string | null;
    financementType: string | null;
    sessionParentId: string | null;
    formation: { dureeHeures: number };
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
        // Snapshot légal (WS5) : la session reportée est la MÊME prestation
        // vendue → on PROPAGE le snapshot figé de l'originale (pas de re-capture
        // du catalogue, qui aurait pu dériver entre-temps).
        formationSnapshot: true,
        clientId: true,
        financementType: true,
        sessionParentId: true,
        // L5 — durée du catalogue, pour proposer les journées de la session
        // reportée (sinon aucun jour → aucun lien d'émargement émissible).
        formation: { select: { dureeHeures: true } },
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
          ...(ancienne!.formationSnapshot != null
            ? { formationSnapshot: ancienne!.formationSnapshot as never }
            : {}),
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

      // 🔴 L5 — proposer les journées de la session reportée, comme à la création.
      // Sans elles, `emettreLiensSessionAction` échoue (`journees_non_declarees`)
      // et l'admin ne peut pas émettre les liens sans re-saisir les jours à la
      // main, sans indication que le report en est la cause. `horairesConfirmes`
      // reste false : ce sont des propositions à vérifier.
      const joursReport = genererJoursParDefaut({
        dateDebutIso: parisDateISO(v.nouvelleDateDebut),
        dureeHeures: ancienne!.formation.dureeHeures,
      });
      if (joursReport.length > 0) {
        await tx.sessionJour.createMany({
          data: joursReport.map((j) => ({
            sessionId: nouvelle.id,
            date: new Date(`${j.date}T00:00:00.000Z`),
            heureDebut: j.heureDebut,
            heureFin: j.heureFin,
          })),
        });
      }

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
      // nouvelle session (cas rare : inscription manuelle préalable), on LAISSE
      // l'inscription source sur la session reportée (L12 : elle peut porter une
      // preuve, non supprimable). Sinon on la transfère.
      for (const enrollment of ancienne!.enrollments) {
        try {
          await tx.enrollment.update({
            where: { id: enrollment.id },
            data: { sessionId: nouvelle.id },
          });
        } catch (enrollErr) {
          const code = (enrollErr as { code?: string })?.code;
          if (code === "P2002") {
            // Doublon : le stagiaire est DÉJÀ inscrit à la nouvelle session.
            // 🔴 L12 — on ne SUPPRIME PAS l'inscription source : elle peut porter
            // une signature ou un jeton d'émargement (FK `Restrict` de T13), et le
            // delete lèverait alors un P2003 non rattrapé qui ferait échouer tout
            // le report. On la LAISSE sur la session reportée : ses preuves y
            // restent rattachées à la session qui a réellement eu lieu, ce qui est
            // correct. Le stagiaire poursuit via son inscription à la nouvelle.
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

  // 🔴 O7 (volet report) — les jetons d'émargement suivent l'INSCRIPTION, qui a
  // migré vers la nouvelle session. Sans révocation, un lien émis pour les dates
  // reportées resterait valide alors que la garde `reportee` du service ne
  // s'applique plus (l'inscription appartient désormais à une session
  // `planifiee`). On révoque : le stagiaire recevra un nouveau lien pour les
  // nouvelles dates. Hors transaction (échec non bloquant), avec trace.
  try {
    for (const e of ancienne.enrollments) {
      await revoquerTokensInscription({
        enrollmentId: e.id,
        motif: `Session reportée (${ancienne.numero})`,
        parAdminId: adminSession.userId,
      });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "reporterSessionAction:revocation_jetons" },
      extra: { ancienneSessionId: ancienne.id, nouvelleSessionId },
    });
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
