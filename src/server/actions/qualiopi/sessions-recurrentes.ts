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
import { lieuInputSchema, normaliserLieu } from "@/server/qualiopi/lieu/lieu-input";
import type { LieuTypeValue } from "@/server/qualiopi/lieu/format-lieu";
import { isTrainerHabilite, HABILITATION_ACTIVE_WHERE } from "@/server/qualiopi/trainers/trainers";
import { creerOuDedup } from "@/server/qualiopi/alertes/alertes-service";
import {
  parseCoFormateurs,
  type SessionFormateurRoleValue,
} from "@/server/qualiopi/trainers/session-formateurs";

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
  // Le lieu est saisi UNE fois et recopié sur chaque occurrence : une série
  // récurrente se tient par définition au même endroit. Sans cela, le bloc
  // « Lieu » du formulaire serait visible en mode récurrent mais silencieusement
  // ignoré — pire qu'absent.
  ...lieuInputSchema.shape,
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
        Object.assign(createData, normaliserLieu(v));
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
 *   - Le LIEU de déroulement (7 colonnes `lieu*`) et les AFFECTATIONS
 *     formateur suivent la prestation. Le formateur principal repasse par la
 *     garde `isTrainerHabilite` : il n'est reconduit que s'il est ENCORE
 *     habilité (cf. le bloc dédié plus bas).
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
    opcoStatut: string | null;
    conventionTripartiteSigneeAt: Date | null;
    sessionParentId: string | null;
    // 🔴 Lieu de déroulement (off.9 + L.6353-1) — cf. bloc du `select`.
    lieuType: LieuTypeValue | null;
    lieuIntitule: string | null;
    lieuAdresse: string | null;
    lieuCodePostal: string | null;
    lieuVille: string | null;
    lieuSalle: string | null;
    lieuVisioUrl: string | null;
    // 🔴 Formateur — cf. bloc du `select`.
    formateurPrincipalId: string | null;
    coFormateurs: unknown;
    sessionFormateurs: Array<{
      trainerId: string;
      role: SessionFormateurRoleValue;
      tarifHtCents: number | null;
    }>;
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
        // 🔴 `D2-5-01` (2026-08-20) — l'ACCORD de financement ne suit PAS le
        // report, et c'est délibéré : il portait sur les ANCIENNES dates. Le
        // recopier réinstallerait un accord que le financeur n'a jamais donné
        // pour les nouvelles — exactement la famille de défaut que cet audit
        // poursuit. On les lit uniquement pour SAVOIR s'il y en avait un, et le
        // dire.
        opcoStatut: true,
        conventionTripartiteSigneeAt: true,
        sessionParentId: true,
        // 🔴 Vérification du plan 2026-08-19 — LE REPORT PERDAIT LE LIEU.
        //
        // Les 7 colonnes `lieu*` n'étaient ni lues ici, ni écrites au `create`,
        // et `reportSessionSchema` ne les demandait pas en ressaisie. La session
        // de remplacement naissait donc SANS lieu de déroulement, et ses
        // documents se rabattaient sur l'adresse de l'organisme : une convention
        // pour une formation tenue chez le client annonçait l'adresse
        // d'Axion-IA. Or le lieu est une mention de la convention
        // (art. L.6353-1 : conditions de déroulement) et l'objet même de
        // l'indicateur 9. Un report reconduit la MÊME prestation : le lieu suit,
        // au même titre que le montant et le snapshot légal.
        lieuType: true,
        lieuIntitule: true,
        lieuAdresse: true,
        lieuCodePostal: true,
        lieuVille: true,
        lieuSalle: true,
        lieuVisioUrl: true,
        // 🔴 Même vérification — LE REPORT PERDAIT LE FORMATEUR.
        //
        // Sans `formateurPrincipalId`, l'alerte `session_sans_formateur`
        // (`alertes/evaluateur.ts`, qui interroge `formateurPrincipalId: null`)
        // levait sur CHAQUE report — une alerte systématiquement fausse finit
        // par n'être plus lue. `sessionFormateurs` est lu en plus de la FK :
        // l'assignation écrit les DEUX (dual-write), n'en reporter qu'un
        // laisserait la charge et le commissionnement aveugles sur la nouvelle
        // session.
        formateurPrincipalId: true,
        coFormateurs: true,
        sessionFormateurs: {
          select: { trainerId: true, role: true, tarifHtCents: true },
        },
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

  // 🔴 LE FORMATEUR REPASSE PAR LA GARDE — arbitrage du 2026-08-19.
  //
  // Recopier `formateurPrincipalId` tel quel court-circuiterait
  // `isTrainerHabilite` : si l'habilitation a été retirée ENTRE l'ancienne et la
  // nouvelle date, le report la RÉINSTALLERAIT en silence, sur des dates que
  // personne n'a validées. Un report est un acte de continuité administrative,
  // pas une ré-affectation : il ne doit rien installer que l'écran d'affectation
  // refuserait aujourd'hui.
  //
  // Le report n'est pas BLOQUÉ pour autant : les dates ont changé, la session de
  // remplacement doit exister quoi qu'il arrive. Le formateur est simplement
  // omis — et l'alerte `session_sans_formateur` lève alors À BON DROIT : elle
  // NOMME ce qu'il reste à faire, là où une recopie l'aurait tue.
  let formateurRetenuId: string | null = null;
  if (ancienne.formateurPrincipalId !== null) {
    try {
      const trainer = await prisma.trainer.findUnique({
        where: { id: ancienne.formateurPrincipalId },
        select: {
          actif: true,
          statut: true,
          sousTraitantVerifieAt: true,
          // Habilitations ACTIVES seulement : la dé-habilitation historise au
          // lieu de supprimer, lire sans ce filtre serait lire l'historique.
          habilitations: {
            where: { ...HABILITATION_ACTIVE_WHERE },
            select: { formationId: true },
          },
        },
      });
      if (
        trainer !== null &&
        isTrainerHabilite(
          { ...trainer, formationIdsHabilites: trainer.habilitations.map((h) => h.formationId) },
          ancienne.formationId,
        ).ok
      ) {
        formateurRetenuId = ancienne.formateurPrincipalId;
      }
    } catch {
      // Lecture indisponible : on ne DEVINE pas une habilitation. La session part
      // sans formateur et l'alerte le signale — jamais l'inverse.
    }
  }
  /** Le principal que la garde vient d'écarter, s'il y en a un. */
  const formateurEcarteId =
    ancienne.formateurPrincipalId !== null && formateurRetenuId === null
      ? ancienne.formateurPrincipalId
      : null;

  // Le Json `coFormateurs` ne doit pas réinstaller par la porte de derrière le
  // principal que la garde vient d'écarter : `resolvePrincipalTrainerId` retombe
  // dessus quand la FK est nulle, et les documents nominatifs (convention,
  // convocation, émargement) le nommeraient quand même.
  const coFormateursReportes =
    formateurEcarteId !== null
      ? parseCoFormateurs(ancienne.coFormateurs).filter((e) => e.trainerId !== formateurEcarteId)
      : ancienne.coFormateurs;

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
          // 🔴 Le LIEU suit la prestation (off.9 / L.6353-1). Recopié colonne à
          // colonne, `null` compris : un report qui n'emporte pas le lieu produit
          // une convention et une convocation muettes sur les conditions de
          // déroulement, et les documents se rabattent sur l'adresse de
          // l'organisme — c'est-à-dire une mention FAUSSE, pas une mention
          // absente.
          lieuType: ancienne!.lieuType,
          lieuIntitule: ancienne!.lieuIntitule,
          lieuAdresse: ancienne!.lieuAdresse,
          lieuCodePostal: ancienne!.lieuCodePostal,
          lieuVille: ancienne!.lieuVille,
          lieuSalle: ancienne!.lieuSalle,
          lieuVisioUrl: ancienne!.lieuVisioUrl,
          // Co-animateurs reportés (purgés du principal écarté, cf. plus haut).
          coFormateurs: coFormateursReportes as never,
          // Le principal n'est posé que s'il a REPASSÉ la garde d'habilitation.
          ...(formateurRetenuId !== null ? { formateurPrincipalId: formateurRetenuId } : {}),
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

      // 🔴 Dual-write des affectations — `assignTrainerToSessionAction` écrit la
      // FK `formateurPrincipalId` ET la table normalisée `SessionFormateur`
      // (socle de la charge par formateur et du commissionnement). Ne reporter
      // que la FK laisserait la nouvelle session avec un formateur invisible de
      // ces deux lectures : un troisième état où deux tables du même dossier se
      // contredisent.
      const rowsFormateurs = ancienne!.sessionFormateurs.filter(
        (r) => r.trainerId !== formateurEcarteId,
      );
      if (rowsFormateurs.length > 0) {
        await tx.sessionFormateur.createMany({
          data: rowsFormateurs.map((r) => ({
            sessionId: nouvelle.id,
            trainerId: r.trainerId,
            role: r.role,
            // Le tarif est un SNAPSHOT figé à l'affectation : le prix convenu ne
            // se renégocie pas parce que la date bouge, il suit le formateur.
            tarifHtCents: r.tarifHtCents,
            // `heuresAnimees` NE suit PAS : la session reportée n'a pas eu lieu.
            // Recopier ses heures ferait rémunérer deux fois la même journée.
            heuresAnimees: null,
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

  // 🔴 `D2-5-01` — LE DOSSIER DE FINANCEMENT NE SUIT PAS, ET IL FAUT LE DIRE.
  //
  // `financementType` est recopié sur la session de remplacement, mais l'ACCORD
  // ne l'est pas : `opcoStatut` repart à `non_demande`, la convention
  // tripartite à `null`. C'est le bon comportement — l'accord portait sur les
  // anciennes dates, et un OPCO n'accorde pas des dates qu'il n'a pas vues.
  //
  // Mais la conséquence était MUETTE : `validateOpcoAccord` classe l'absence
  // d'accord en `critique`, donc la session de remplacement refuse de démarrer,
  // et l'admin le découvre le jour où il clique — sans savoir que le report en
  // est la cause. C'est ce que le constat décrivait par « la session de
  // remplacement ne peut plus démarrer du tout » : elle le peut, une fois le
  // dossier refait, et personne ne le disait.
  //
  // L'alerte cible la NOUVELLE session : c'est sur elle qu'il y a un acte à
  // poser, et c'est sa fiche qu'on ouvrira.
  const avaitAccord =
    ancienne.opcoStatut === "accord_recu" ||
    ancienne.opcoStatut === "paiement_recu" ||
    ancienne.conventionTripartiteSigneeAt !== null;
  if (avaitAccord) {
    void creerOuDedup({
      code: "report_accord_financement_a_refaire",
      niveau: "important",
      titre: "Accord de financement à refaire après report",
      message:
        `La session ${ancienne.numero} portait un accord de financement obtenu pour ses dates ` +
        `d'origine. Il n'a PAS été reporté sur ${nouvelleSessionNumero} : un financeur n'accorde ` +
        `pas des dates qu'il n'a pas vues. Tant que le nouvel accord n'est pas enregistré, la ` +
        `session de remplacement refusera de démarrer.`,
      cibleType: "TrainingSession",
      cibleId: nouvelleSessionId,
    }).catch(() => {});
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
      // Tracé explicitement : un formateur ÉCARTÉ par la garde d'habilitation
      // est une décision de la machine sur un acte engageant. Elle doit être
      // lisible au journal, sinon l'admin découvre la session sans formateur
      // sans jamais savoir pourquoi.
      formateurReporte: formateurRetenuId,
      ...(formateurEcarteId !== null ? { formateurEcarteNonHabilite: formateurEcarteId } : {}),
    },
    session: adminSession,
  });

  return { data: { nouvelleSessionId, nouvelleSessionNumero } };
}
