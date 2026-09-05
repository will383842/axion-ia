/**
 * Qualiopi — Server Actions Session de formation (T3).
 *
 * createSessionAction      : crée une session planifiée (validation canCreateSessionFor).
 * setSessionLieuAction     : corrige le lieu de déroulement.
 * setSessionDatesAction    : corrige les dates de déroulement (garde de motif si
 *                            des pièces s'appuient déjà dessus). ⚠️ Ce n'est PAS
 *                            un report — voir son en-tête.
 * transitionSessionAction  : applique une transition de statut (machine à états).
 *
 * Chaque création/transition écrit une FormationTransition (event sourcing).
 * Idempotence via @@unique [sessionId, toStatus, trigger] — P2002 = déjà fait → ok.
 *
 * T6 — writeSessionTransition déplacé dans formations/transition-helper.ts
 * (module sans "use server", importable par workers BullMQ et tests sans conflit).
 */

"use server";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { avertissementsAffectation } from "@/server/qualiopi/trainers/avertissements-affectation";
import { proposerMissionFormateur } from "@/server/qualiopi/trainers/mission-formateur";
import {
  detecterIndisponibiliteFormateur,
  formulerConflit,
} from "@/server/qualiopi/trainers/conflits-indisponibilite";
import { revoquerTokensInscription } from "@/server/qualiopi/emargement/token-service";
import type {
  TrainingSessionStatut,
  TransitionTriggeredBy,
} from "@/server/qualiopi/formations/types";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { allocateSessionNumero } from "@/server/qualiopi/formations/numbering";
import { genererJoursParDefaut } from "@/server/qualiopi/presence/jours-defaut";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import { withNumberRetry } from "@/server/qualiopi/numbering/retry";
import { canCreateSessionFor } from "@/server/qualiopi/formations/formations";
import { assertSessionTransition } from "@/server/qualiopi/formations/state-machine";
import { writeSessionTransition } from "@/server/qualiopi/formations/transition-helper";
import { getFinancementValidations } from "@/server/qualiopi/financements/validation-service";
import {
  FORMATION_SNAPSHOT_SELECT,
  buildFormationSnapshot,
} from "@/server/qualiopi/formations/formation-snapshot";
import { lieuInputSchema, normaliserLieu } from "@/server/qualiopi/lieu/lieu-input";
import {
  compterJoursHorsPlage,
  messageRefusDates,
  verdictDates,
} from "@/server/qualiopi/sessions/requalification-dates";
import { resoudreDureeReelleACloture } from "@/server/qualiopi/presence/duree-reelle";
import {
  mesurerTraceCloture,
  clotureSansAucuneTrace,
} from "@/server/qualiopi/presence/trace-cloture";
import { refusMotif } from "@/server/qualiopi/formations/transition-motif";
import { signalerClotureIncomplete } from "@/server/qualiopi/alertes/signal-cloture";
import {
  isTrainerHabilite,
  type TrainerHabilitationFields,
} from "@/server/qualiopi/trainers/trainers";

// NB : le type `WriteSessionTransitionInput` n'est PAS ré-exporté ici (aucun
// caller externe). Un `export type { … }` dans un module "use server" est
// mal compilé par Turbopack (Next 16.2) en Server Action runtime → 500.
// Source du type : @/server/qualiopi/formations/transition-helper.

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Enums Zod (miroir enum Prisma)
// ─────────────────────────────────────────────────────────────────────────────

const MODALITES = ["presentiel", "distanciel", "hybride"] as const;
const FINANCEMENT_TYPES = ["direct", "opco", "cpf", "france_travail", "mixte"] as const;
const SESSION_STATUTS = ["planifiee", "en_cours", "realisee", "annulee", "reportee"] as const;
const TRANSITION_TRIGGERED_BY = ["admin", "cron", "webhook", "system", "client", "user"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const createSessionSchema = z.object({
  formationId: z.string().uuid(),
  titreSession: z.string().min(1).max(300).optional(),
  dateDebut: z.coerce.date(),
  dateFin: z.coerce.date(),
  modalite: z.enum(MODALITES),
  nbParticipantsPrevus: z.number().int().min(1),
  montantHtCents: z.number().int().min(0),
  clientId: z.string().uuid().optional(),
  devisId: z.string().uuid().optional(),
  // Formateur principal — FACULTATIF : une session se planifie souvent avant que
  // l'on sache qui l'animera, et la fiche session permet de l'assigner ensuite.
  // Mais dès qu'il est fourni, il subit EXACTEMENT le contrôle d'habilitation de
  // l'assignation (garde plus bas) : accepter ici ce que la fiche refuse
  // ouvrirait une porte dérobée vers un formateur non habilité.
  trainerId: z.string().uuid().optional(),
  financementType: z.enum(FINANCEMENT_TYPES).optional(),
  recurrence: z.number().int().min(1).optional(),
  // Lieu de déroulement — facultatif, mais imprimé sur la convention, la
  // convocation et la feuille d'émargement dès qu'il est renseigné.
  ...lieuInputSchema.shape,
});

const setSessionLieuSchema = z.object({
  id: z.string().uuid(),
  ...lieuInputSchema.shape,
  /**
   * 🔴 La MODALITÉ n'était modifiable NULLE PART après la création (constat du
   * 2026-09-04). `createSessionAction` était sa seule écriture.
   *
   * Ce n'est pas un manque de confort : elle décide de ce que les documents
   * impriment, et le formulaire de lieu, lui, permettait déjà de passer de
   * « distanciel » à « nos locaux ». On pouvait donc obtenir une session
   * `modalite = distanciel` **et** `lieuType = nos_locaux` — deux affirmations
   * contradictoires sur la même prestation, qu'aucun écran ne signalait. C'est
   * exactement l'état dans lequel AXI-SESS-2026-001 s'est retrouvée.
   *
   * Elle se corrige donc AVEC le lieu, dans le même geste : les deux disent la
   * même chose et doivent bouger ensemble.
   */
  modalite: z.enum(["presentiel", "distanciel", "hybride"]).optional(),
});

/**
 * 🔴 Le MONTANT n'était écrit qu'à la création (constat du 2026-09-04).
 *
 * `createSessionAction` était sa seule écriture : il existait
 * `setSessionLieuAction` et `setSessionDatesAction`, mais rien pour le prix. La
 * page Financement l'affichait en lecture seule. Un montant saisi de travers
 * était donc gelé pour toujours — et il part sur la CONVENTION et sur la
 * FACTURE. Sur AXI-SESS-2026-001, il a fallu une écriture SQL directe en
 * production pour corriger 1 900 € en 100 €.
 *
 * Le motif est exigé dès qu'une pièce financière existe : un prix qui bouge
 * après qu'une convention l'a annoncé, ou qu'une facture l'a réclamé, doit
 * pouvoir s'expliquer devant un contrôle.
 */
const setSessionMontantSchema = z.object({
  id: z.string().uuid(),
  /** En CENTIMES, comme la colonne — jamais en euros flottants. */
  montantHtCents: z.number().int().min(0),
  motif: z.string().trim().min(10).max(500).optional(),
});

const setSessionDatesSchema = z.object({
  id: z.string().uuid(),
  dateDebut: z.coerce.date(),
  dateFin: z.coerce.date(),
  /**
   * 🔴 Motif de CORRECTION — exigé seulement quand des pièces s'appuient déjà
   * sur ces dates (émargement signé, signature, convocation partie, document
   * émis, créneau généré).
   *
   * Sur une session vierge il reste absent : corriger une coquille ne doit pas
   * devenir une cérémonie. Voir `sessions/requalification-dates.ts`.
   */
  motifRequalification: z.string().trim().min(10).max(500).optional(),
});

const transitionSessionSchema = z.object({
  id: z.string().uuid(),
  toStatus: z.enum(SESSION_STATUTS),
  trigger: z.string().max(80).optional(),
  reason: z.string().max(500).optional(),
  triggeredBy: z.enum(TRANSITION_TRIGGERED_BY).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une session planifiée rattachée à une formation publiée.
 *
 * Validations métier :
 *   - La formation doit pouvoir accueillir des sessions (canCreateSessionFor).
 *   - dateFin doit être strictement postérieure à dateDebut.
 * Statut initial : 'planifiee'.
 * Écrit une FormationTransition initiale (null → planifiee, trigger 'admin.create').
 */
export async function createSessionAction(
  input: z.infer<typeof createSessionSchema>,
): Promise<ActionResult<{ id: string; numero: string; avertissements: string[] }>> {
  const session = await requireAdminWrite();
  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Valider dateFin > dateDebut
  if (v.dateFin <= v.dateDebut) {
    return { error: "La date de fin doit être postérieure à la date de début" };
  }

  // Vérifier que la formation est publiée et active. On lit aussi les champs du
  // snapshot légal (WS5) pour les figer dans la session dès sa création.
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
      error: `Impossible de créer une session : la formation doit être publiée et active (statut actuel : ${formation.statut} / ${formation.statutGeneration})`,
    };
  }

  // Titre par défaut si non fourni
  const titreSession = v.titreSession ?? formation.titre;

  // 🔴 F8 — contrôle d'existence et d'APPARTENANCE du devis rattaché.
  //
  // `devisId` était accepté au schéma et écrit tel quel : rien ne vérifiait que
  // le devis existe, ni qu'il appartienne au client de la session. Un identifiant
  // périmé passait donc (FK `SetNull` : le lien disparaissait silencieusement au
  // lieu d'échouer), et surtout RIEN n'interdisait de rattacher le devis d'un
  // AUTRE client. La convention générée depuis ce devis aurait alors porté le
  // prix et les conditions de quelqu'un d'autre — sur une pièce contractuelle.
  //
  // Le formulaire filtre déjà par client, mais une garde d'interface ne protège
  // que les usages ordinaires : l'action est appelable directement.
  if (v.devisId !== undefined) {
    const devisLie = await prisma.devis.findUnique({
      where: { id: v.devisId },
      select: { id: true, clientId: true, statut: true },
    });
    if (!devisLie) {
      return { error: "Devis introuvable : impossible de rattacher la session." };
    }
    if (v.clientId === undefined || devisLie.clientId !== v.clientId) {
      return {
        error:
          "Le devis rattaché appartient à un autre client. Une convention générée depuis ce devis porterait le prix et les conditions d'un tiers.",
      };
    }
    // Un devis en brouillon ou refusé n'a pas à engendrer de session ; un devis
    // déjà transformé a la sienne. On tolère `transforme_convention` pour rester
    // idempotent si la session est recréée après une erreur.
    if (devisLie.statut !== "accepte" && devisLie.statut !== "transforme_convention") {
      return {
        error: `Seul un devis accepté peut être rattaché à une session (statut actuel : ${devisLie.statut}).`,
      };
    }
  }

  // 🔴 Le formateur ne pouvait PAS être choisi à la création d'une session.
  //
  // `formateurPrincipalId` n'avait qu'un seul écrivain — `assignTrainerToSession`
  // depuis la FICHE de la session, donc APRÈS coup. Or c'est au moment où l'on
  // planifie que l'on sait qui anime : le champ était réclamé au mauvais moment,
  // et une session partait sans formateur jusqu'à ce que quelqu'un rouvre la
  // fiche. Entre-temps, les documents nominatifs retombaient sur la raison
  // sociale de l'organisme au lieu du nom de l'intervenant.
  //
  // La garde ici est la MÊME que celle de l'assignation, et pour la même raison :
  // le formulaire ne propose que des formateurs habilités, mais une garde
  // d'interface ne protège que les usages ordinaires — une Server Action est
  // appelable directement. `isTrainerHabilite` est RÉUTILISÉ, jamais réécrit :
  // deux formulations de la même règle divergent au premier amendement.
  //
  // ⚠️ Les habilitations viennent de la relation `TrainerHabilitation`, JAMAIS de
  // la colonne legacy `Trainer.formationsHabilitees` : celle-ci contient des
  // SLUGS en production alors que la garde compare des UUID (constat F11), donc
  // `includes()` n'y serait jamais vrai et tout formateur serait refusé.
  let tarifFormateurCents: number | null = null;
  if (v.trainerId !== undefined) {
    let trainer:
      | (Omit<TrainerHabilitationFields, "formationIdsHabilites"> & {
          tarifJourneeHtCents: number | null;
          habilitations: { formationId: string }[];
        })
      | null;
    try {
      trainer = await prisma.trainer.findUnique({
        where: { id: v.trainerId },
        select: {
          actif: true,
          statut: true,
          sousTraitantVerifieAt: true,
          tarifJourneeHtCents: true,
          // 🔴 `retireAt: null` — la dé-habilitation ne SUPPRIME plus la ligne
          // depuis le 2026-08-17 (migration `trainer_habilitation_retrait`) :
          // elle la DATE, pour que la preuve de conformité d'une session déjà
          // animée survive au retrait (ind. 21/22). Conséquence directe pour
          // toute garde : lire les habilitations sans ce filtre, c'est lire
          // l'HISTORIQUE et déclarer habilité un formateur qui ne l'est plus.
          // `listTrainers` porte le même filtre — l'écran ne le proposerait
          // donc pas, mais une Server Action s'appelle sans passer par l'écran.
          habilitations: { where: { retireAt: null }, select: { formationId: true } },
        },
      });
    } catch {
      return { error: "Erreur lors de la lecture du formateur" };
    }
    if (!trainer) return { error: "Formateur introuvable" };

    const check = isTrainerHabilite(
      { ...trainer, formationIdsHabilites: trainer.habilitations.map((h) => h.formationId) },
      v.formationId,
    );
    if (!check.ok) {
      return { error: `Assignation refusée : ${check.raison}` };
    }

    // Tarif FIGÉ à l'affectation, comme le fait l'assignation depuis la fiche :
    // la rémunération due se calcule sur le prix convenu ce jour-là, pas sur le
    // barème du formateur au moment où l'on édite le relevé.
    tarifFormateurCents = trainer.tarifJourneeHtCents ?? null;
  }

  // Snapshot légal (WS5) — fige la formation telle que vendue à cette session.
  const formationSnapshot = buildFormationSnapshot(formation, new Date());

  // Créer la session + FormationTransition initiale dans une transaction,
  // avec retry sur collision de numéro (R7 : numéro ré-alloué à chaque tentative).
  let created: { id: string; numero: string };
  try {
    created = await withNumberRetry(async () => {
      // 🔴 2026-08-23 — L'ALLOCATION SORT DE LA TRANSACTION, ET CE N'EST PAS UN
      // CHOIX PERSONNEL : C'EST LE PATRON DÉJÀ ÉCRIT DEUX FOIS À CÔTÉ.
      //
      // Elle vivait DANS la transaction, et y appelait le client GLOBAL `prisma`
      // — pas le `tx`. Deux ennuis, cumulés :
      //
      //   1. la transaction tenait une connexion pendant que ce `findMany` en
      //      demandait une AUTRE au pool. Sous charge, c'est le scénario
      //      d'épuisement du pool : la transaction attend une connexion que la
      //      transaction empêche de libérer ;
      //   2. le balayage de tous les `AXI-SESS-<année>-*` était facturé au budget
      //      de la transaction — 5 000 ms par défaut, jamais déclaré. Mesuré le
      //      2026-08-23 par le parcours E2E 02 : `P2028` à 5 605 ms, écran rendu
      //      « Erreur lors de la création de la session ».
      //
      // `sessions-recurrentes.ts:200-208` et `:526` allouent tous deux HORS
      // transaction, et disent pourquoi c'est acceptable : « @unique numéro reste
      // le garde-fou final — collision P2002 → retry côté action ». C'est
      // exactement ce que `withNumberRetry` fait ici, et le numéro reste
      // ré-alloué à chaque tentative puisque l'appel est DANS le rappel du retry.
      //
      // 🔑 Ce site était le seul des trois à diverger. Un prédicat recopié
      // diverge toujours : les trois disent maintenant la même chose.
      const numero = await allocateSessionNumero(
        v.recurrence !== undefined ? { recurrence: v.recurrence } : undefined,
      );
      return prisma.$transaction(
        async (tx) => {
          const newSession = await tx.trainingSession.create({
            data: {
              numero,
              titreSession,
              formationId: v.formationId,
              dateDebut: v.dateDebut,
              dateFin: v.dateFin,
              modalite: v.modalite,
              nbParticipantsPrevus: v.nbParticipantsPrevus,
              montantHtCents: v.montantHtCents,
              formationSnapshot: formationSnapshot as never,
              statut: "planifiee",
              ...(v.clientId !== undefined ? { clientId: v.clientId } : {}),
              ...(v.devisId !== undefined ? { devisId: v.devisId } : {}),
              // Le champ Prisma s'appelle `formateurPrincipalId` : il n'existe pas
              // de `trainerId` sur `TrainingSession`. Le nom d'entrée reste
              // `trainerId` pour coller à celui de l'assignation.
              ...(v.trainerId !== undefined ? { formateurPrincipalId: v.trainerId } : {}),
              // 🔴 Audit certification 2026-07-26 (F58). `financementType` était
              // facultatif ET sans valeur par défaut : une session créée sans le
              // préciser restait à NULL. Le BPF s'en sortait par un repli
              // silencieux (`?? "direct"`), donc le chiffre d'affaires n'était pas
              // perdu — mais une session réellement financée par un OPCO et laissée
              // à NULL était comptée en « financement direct » dans un bilan
              // déclaré à la DREETS, sans qu'aucun écran ne le signale.
              //
              // Le défaut explicite vaut mieux que le repli caché : « direct » est
              // le cas majoritaire, il est visible en base, et il se corrige d'un
              // clic si un OPCO entre en jeu.
              financementType: v.financementType ?? "direct",
              // Lieu de déroulement. `normaliserLieu` n'émet que les clés
              // réellement fournies : une création sans bloc lieu laisse les
              // colonnes à NULL, et les documents retombent alors sur l'adresse de
              // l'organisme comme avant — aucune régression pour l'existant.
              ...normaliserLieu(v),
            },
            select: { id: true, numero: true },
          });

          // 🔴 DUAL-WRITE, dans la MÊME transaction que la session.
          //
          // Le formateur d'une session est rattaché par DEUX voies concurrentes que
          // le schéma porte toutes les deux : la FK `formateurPrincipalId` et une
          // ligne `session_formateurs`. Écrire la FK seule ne serait pas une demi-
          // mesure, ce serait une INCOHÉRENCE : la fiche session et les documents
          // liraient bien le formateur (ils lisent la FK), pendant que tout ce qui
          // AGRÈGE lirait zéro — `fiabilite-service` compte les missions par
          // `sessionFormateur.count`, `remuneration/marge` ventile par
          // `sessionFormateur.groupBy`. Un formateur affiché sur ses sessions mais
          // crédité d'aucune mission et d'aucune marge : l'écart ne se voit qu'en
          // recoupant deux écrans, donc il ne se voit pas.
          //
          // `create` et non `upsert` : la session vient d'être créée dans cette
          // transaction, aucune ligne ne peut préexister.
          if (v.trainerId !== undefined) {
            await tx.sessionFormateur.create({
              data: {
                sessionId: newSession.id,
                trainerId: v.trainerId,
                role: "principal",
                tarifHtCents: tarifFormateurCents,
              },
            });
          }

          // Journées PROPOSÉES (D14), dérivées de la durée de la formation.
          //
          // Volontairement calculées depuis `dateDebut` et `dureeHeures`, SANS
          // tenir compte de `dateFin` : c'est tout le propos de D14, la plage de
          // dates ne décrit pas les journées. Une session étalée sur 3 mois pour
          // 4 journées produirait sinon 66 jours ouvrés. Si le résultat déborde
          // `dateFin`, l'admin le voit à l'écran et corrige.
          //
          // `horairesConfirmes` reste à `false` : ce sont des propositions.
          const joursProposes = genererJoursParDefaut({
            dateDebutIso: parisDateISO(v.dateDebut),
            dureeHeures: formation.dureeHeures,
          });
          if (joursProposes.length > 0) {
            await tx.sessionJour.createMany({
              data: joursProposes.map((j) => ({
                sessionId: newSession.id,
                date: new Date(`${j.date}T00:00:00.000Z`),
                heureDebut: j.heureDebut,
                heureFin: j.heureFin,
              })),
            });
          }

          // Transition initiale null → planifiee
          await writeSessionTransition(tx, {
            sessionId: newSession.id,
            from: null,
            to: "planifiee",
            trigger: "admin.create",
            triggeredBy: "admin",
            triggeredById: session.userId,
          });

          return newSession;
        },
        {
          // ⚠️ BUDGET DÉCLARÉ, ET NON HÉRITÉ. Sans ces deux lignes, Prisma applique
          // `timeout: 5_000` / `maxWait: 2_000` — des valeurs que personne n'a
          // choisies pour CETTE écriture, et qui ne se lisent nulle part dans le
          // fichier. Ce qui se passe ici : création de la session, du formateur,
          // de TOUS les jours de session (`sessionJour.createMany`) et de la
          // transition initiale.
          //
          // 15 s, et pas davantage : au-delà, une transaction qui traîne tient une
          // connexion et en prive les autres écritures. Mesuré le 2026-08-23 —
          // dépassement à 5 605 ms sur une machine qui paginait, et 442 ms sur la
          // même écriture dix minutes plus tôt. Le budget couvre donc largement le
          // cas nominal tout en restant une borne qui veut dire quelque chose.
          //
          // 🔑 Le vrai gain n'est pas là : c'est l'allocation du numéro qui est
          // sortie de la transaction (voir plus haut). Ce budget est la ceinture,
          // pas les bretelles.
          timeout: 15_000,
          maxWait: 5_000,
        },
      );
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002")
      return { error: "Un conflit de numéro a été détecté, veuillez réessayer" };

    // 🔴 2026-08-23 — LE MESSAGE EFFAÇAIT SA CAUSE, ET RIEN D'AUTRE NE LA PORTAIT.
    //
    // Toute erreur autre que P2002 rendait « Erreur lors de la création de la
    // session ». Mesuré ce jour-là par le parcours E2E 02 : la transaction
    // ci-dessus a expiré (`P2028` — budget interactif par défaut de 5 000 ms,
    // dépassé à 5 605 ms pendant `sessionJour.createMany()`), et l'écran a rendu
    // ce texte générique. L'opératrice ne pouvait pas savoir que l'écriture avait
    // été ANNULÉE faute de temps, ni que réessayer avait une chance d'aboutir :
    // elle voyait la même phrase que pour une panne réseau ou une contrainte.
    //
    // 🔑 On ne relâche pas le budget de la transaction ici — ce serait changer la
    // sémantique d'une écriture Qualiopi sans l'avoir prouvée nécessaire en
    // production (la mesure a été prise sur une machine qui paginait). On rend
    // seulement la cause DISCERNABLE, et on la remonte à Sentry, ce que le code
    // précédent ne faisait pas non plus.
    Sentry.captureException(err);
    if (code === "P2028")
      return {
        error:
          "La création a dépassé le temps imparti et a été annulée : rien n'a été enregistré. " +
          "Réessayez — si cela se reproduit, la base est probablement saturée.",
      };
    return { error: "Erreur lors de la création de la session" };
  }

  await logQualiopiActivity({
    action: "qualiopi.session.create",
    targetType: "TrainingSession",
    targetId: created.id,
    changes: {
      numero: created.numero,
      formationId: v.formationId,
      dateDebut: v.dateDebut,
      dateFin: v.dateFin,
      // Tracé même à `null` : « aucun formateur choisi à la création » est un
      // fait d'audit, pas une absence d'information. Sans lui, impossible de
      // distinguer plus tard une session partie sans intervenant d'une session
      // dont le journal aurait simplement omis le champ.
      formateurPrincipalId: v.trainerId ?? null,
    },
    session,
  });

  // 🔴 `D2-5-06` (2026-08-20) — les avertissements de conformité N'EXISTAIENT
  // PAS sur cette voie. `assignerFormateurAction` les calculait, pas la
  // création : un sous-traitant sans contrat de sous-traitance — pièce classée
  // `bloquant` par `trainers/conformite.ts` — pouvait être posé dès la création
  // et traverser tout le cycle sans qu'un écran ne le signale.
  //
  // L'habilitation, elle, était bien contrôlée plus haut : c'est ce qui rendait
  // le trou invisible. On voyait un contrôle, on en concluait qu'il couvrait le
  // sujet.
  //
  // ⚠️ AVERTISSEMENT, jamais blocage — même arbitrage qu'à l'affectation. La
  // session EXISTE déjà en base à ce point : la faire échouer pour un Kbis qui
  // arrive demain empêcherait de planifier, et une garde qui empêche de
  // travailler finit par être retirée.
  const avertissements = await avertissementsAffectation(v.trainerId ?? null);

  // 2026-09-03 — seconde voie d'affectation : la mission est PROPOSÉE au
  // formateur ici aussi, sinon une session créée avec son formateur ne lui
  // demanderait jamais son accord (cf. `assignTrainerToSessionAction`).
  if (v.trainerId !== undefined) {
    await proposerMissionFormateur({
      sessionId: created.id,
      trainerId: v.trainerId,
      role: "principal",
    });
    const conflit = await detecterIndisponibiliteFormateur(v.trainerId, {
      dateDebut: v.dateDebut,
      dateFin: v.dateFin,
    });
    if (conflit !== null) {
      avertissements.push(
        `Ce formateur s'est déclaré indisponible sur ${formulerConflit(conflit)}. Vérifiez avec lui avant de maintenir les dates.`,
      );
    }
  }

  return { data: { id: created.id, numero: created.numero, avertissements } };
}

/**
 * Enregistre (ou corrige) le lieu de déroulement d'une session.
 *
 * Pourquoi une action dédiée plutôt qu'un champ de plus dans une hypothétique
 * « édition de session » : il n'en existe aucune. `createSessionAction` et
 * `transitionSessionAction` étaient jusqu'ici les deux seules écritures sur une
 * session — autrement dit, une salle saisie de travers à la création restait
 * fausse pour toujours, y compris sur la convention déjà remise au client.
 *
 * Le statut n'est PAS un verrou ici. On peut vouloir rectifier le lieu d'une
 * session déjà réalisée (adresse mal saisie, salle changée le matin même) : le
 * refuser figerait une erreur dans une pièce d'audit sans rien protéger. La
 * traçabilité est assurée par le journal d'activité, qui enregistre l'ancienne
 * et la nouvelle valeur.
 *
 * ⚠️ Les documents DÉJÀ générés ne sont pas régénérés : un PDF émis est figé, et
 * c'est voulu. Après correction, il faut réémettre la pièce concernée.
 */
export async function setSessionLieuAction(
  input: z.infer<typeof setSessionLieuSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = setSessionLieuSchema.safeParse(input);
  if (!parsed.success) {
    // Le message de zod est utile ici (URL de visio invalide) : le renvoyer
    // plutôt qu'un « Données invalides » opaque devant lequel l'admin ne peut
    // rien faire.
    const premier = parsed.error.issues[0];
    return { error: premier?.message ?? "Données invalides" };
  }
  const { id, modalite, ...lieuBrut } = parsed.data;
  const lieu = normaliserLieu(lieuBrut);

  const LIEU_SELECT = {
    lieuType: true,
    lieuIntitule: true,
    lieuAdresse: true,
    lieuCodePostal: true,
    lieuVille: true,
    lieuSalle: true,
    lieuVisioUrl: true,
    contactSurPlaceNom: true,
    contactSurPlaceTelephone: true,
    consignesAcces: true,
  } as const;

  let avant: Record<string, unknown> | null;
  try {
    avant = await prisma.trainingSession.findUnique({
      where: { id },
      select: { ...LIEU_SELECT, modalite: true },
    });
  } catch {
    return { error: "Erreur lors de la lecture de la session" };
  }
  if (!avant) return { error: "Session introuvable" };

  try {
    await prisma.trainingSession.update({
      where: { id },
      // La modalité voyage AVEC le lieu : elles disent la même chose, et les
      // laisser diverger produit une session « distancielle » qui se tient dans
      // nos locaux. Absente de l'entrée = inchangée, comme les champs de lieu.
      data: { ...(lieu as object), ...(modalite !== undefined ? { modalite } : {}) } as never,
    });
  } catch (err) {
    Sentry.captureException(err);
    return { error: "Erreur lors de l'enregistrement du lieu" };
  }

  await logQualiopiActivity({
    action: "qualiopi.session.lieu.set",
    targetType: "TrainingSession",
    targetId: id,
    changes: {
      avant,
      apres: { ...lieu, ...(modalite !== undefined ? { modalite } : {}) },
    },
    session,
  });

  return { data: { id } };
}

/**
 * Corrige le MONTANT HT d'une session. Cf. `setSessionMontantSchema` pour le
 * défaut que cette action ferme.
 *
 * ⚠️ Ce qui NE SUIT PAS, volontairement, et qu'il faut donc dire à l'écran :
 * les documents DÉJÀ émis sont figés. Une convention qui annonce 1 900 € reste
 * à 1 900 € tant qu'on ne la refait pas. Corriger le montant sans réémettre
 * laisserait la pièce contredire la base — c'est-à-dire la situation que cette
 * action existe pour rendre réparable, pas pour masquer.
 */
export async function setSessionMontantAction(
  input: z.infer<typeof setSessionMontantSchema>,
): Promise<ActionResult<{ id: string; piecesFinancieres: number; motifRequis: boolean }>> {
  const session = await requireAdminWrite();
  const parsed = setSessionMontantSchema.safeParse(input);
  if (!parsed.success) {
    const premier = parsed.error.issues[0];
    return { error: premier?.message ?? "Données invalides" };
  }
  const { id, montantHtCents, motif } = parsed.data;

  let avant: { montantHtCents: number } | null;
  try {
    avant = await prisma.trainingSession.findUnique({
      where: { id },
      select: { montantHtCents: true },
    });
  } catch {
    return { error: "Erreur lors de la lecture de la session" };
  }
  if (!avant) return { error: "Session introuvable" };
  if (avant.montantHtCents === montantHtCents) return { error: "Le montant est déjà celui-ci." };

  // Une pièce FINANCIÈRE vivante (convention, facture, devis non annulés) porte
  // déjà ce prix. Le changer sans un mot laisserait un écart inexpliqué entre
  // la pièce et le registre — c'est précisément ce qu'un contrôle relève.
  const piecesFinancieres = await prisma.documentGenere.count({
    where: {
      sessionId: id,
      type: { in: ["convention", "convention_tripartite", "facture", "devis"] },
      annuleeAt: null,
    },
  });
  if (piecesFinancieres > 0 && (motif === undefined || motif.length < 10)) {
    return {
      error:
        `${piecesFinancieres} pièce(s) financière(s) annoncent déjà l'ancien montant. ` +
        "Indiquez pourquoi il change (10 caractères au moins) : le motif est porté au registre, " +
        "et il faudra réémettre ces pièces — elles ne se corrigent pas toutes seules.",
    };
  }

  try {
    await prisma.trainingSession.update({ where: { id }, data: { montantHtCents } });
  } catch (err) {
    Sentry.captureException(err);
    return { error: "Erreur lors de l'enregistrement du montant" };
  }

  await logQualiopiActivity({
    action: "qualiopi.session.montant.set",
    targetType: "TrainingSession",
    targetId: id,
    changes: {
      avant: avant.montantHtCents,
      apres: montantHtCents,
      ...(motif !== undefined ? { motif } : {}),
      piecesFinancieresConcernees: piecesFinancieres,
    },
    session,
  });

  return { data: { id, piecesFinancieres, motifRequis: piecesFinancieres > 0 } };
}

/**
 * Corrige les DATES de déroulement d'une session (`dateDebut` / `dateFin`).
 *
 * Pourquoi une action dédiée : il n'existait aucune écriture capable de toucher
 * ces deux champs après la création. `createSessionAction`, `setSessionLieuAction`
 * et `transitionSessionAction` étaient les seules écritures sur une session —
 * autrement dit, un « 09 » saisi pour un « 10 » restait faux pour toujours.
 *
 * Le seul contournement était « Reporter » : il crée une SECONDE session et
 * laisse la première au registre en statut « Reportée ». Pour une faute de
 * frappe, cela verse au registre légal la trace d'un report qui n'a jamais eu
 * lieu — et l'auditeur qui lit « session reportée » cherche un motif qui
 * n'existe pas. ⚠️ « Reporter » n'est d'ailleurs pas la porte sûre qu'on croit :
 * `reportSessionAction` (sessions-recurrentes.ts) n'a AUCUNE garde de preuves et
 * reporte sans un mot une session dont la feuille d'émargement est signée.
 *
 * Le statut n'est PAS un verrou ici, même raisonnement que pour le lieu : une
 * session réalisée dont la plage est fausse doit pouvoir être rectifiée, sinon
 * l'erreur est figée dans une pièce d'audit sans que rien ne soit protégé.
 *
 * 🔴 La garde n'INTERDIT pas — elle exige un MOTIF quand des pièces s'appuient
 * déjà sur ces dates, et le verse au journal. Règle pure et testée dans
 * `@/server/qualiopi/sessions/requalification-dates`. Un refus dur renverrait
 * vers « Reporter », c'est-à-dire vers le défaut lui-même.
 *
 * ⚠️ Ce qui NE SUIT PAS cette correction, volontairement :
 *   · les documents DÉJÀ générés — un PDF émis est figé, il faut le réémettre ;
 *   · les `PresenceCreneau` déjà générés — ils peuvent porter une signature ;
 *   · les `SessionJour` — voir la décision détaillée plus bas.
 */
export async function setSessionDatesAction(input: {
  id: string;
  dateDebut: Date;
  dateFin: Date;
  /** Exigé seulement si des pièces s'appuient déjà sur les dates. */
  motifRequalification?: string;
}): Promise<
  ActionResult<{
    id: string;
    /** Journées déclarées qui tombent HORS de la nouvelle plage. 0 = rien à faire. */
    joursHorsPlage: number;
    /** Total des journées déclarées, pour situer le chiffre ci-dessus. */
    nbJours: number;
  }>
> {
  const session = await requireAdminWrite();
  const parsed = setSessionDatesSchema.safeParse(input);
  if (!parsed.success) {
    // Le message de zod est utile ici (motif trop court) : le renvoyer plutôt
    // qu'un « Données invalides » opaque devant lequel l'admin ne peut rien.
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const v = parsed.data;

  // Même invariant qu'à la création (cf. `createSessionAction`). Le dupliquer
  // est voulu : une plage inversée produit une durée négative sur la convention.
  if (v.dateFin <= v.dateDebut) {
    return { error: "La date de fin doit être postérieure à la date de début" };
  }

  let avantSession: { dateDebut: Date; dateFin: Date } | null;
  try {
    avantSession = await prisma.trainingSession.findUnique({
      where: { id: v.id },
      select: { dateDebut: true, dateFin: true },
    });
  } catch {
    return { error: "Erreur lors de la lecture de la session" };
  }
  if (!avantSession) return { error: "Session introuvable" };

  // 🔴 GARDE DE REQUALIFICATION.
  //
  // On compte ce qui s'appuie déjà sur ces dates AVANT d'écrire. Aucun de ces
  // compteurs n'interdit quoi que ce soit : ils déterminent si un motif écrit
  // est exigé, et ils nourrissent le texte rendu à l'écran.
  //
  // ⚠️ Sur `DocumentGenere`, la relation vers la session s'appelle `session`
  // (pas `trainingSession`). `PresenceCreneau` n'a pas de `sessionId` : on y
  // arrive par `enrollment`.
  let compteurs: [number, number, number, number, number, number, Array<{ date: Date }>];
  try {
    compteurs = await Promise.all([
      prisma.documentGenere.count({ where: { sessionId: v.id, annuleeAt: null } }),
      prisma.enrollment.count({
        where: { sessionId: v.id, convocationEnvoyeeAt: { not: null } },
      }),
      prisma.emargementToken.count({
        where: { enrollment: { sessionId: v.id }, revokedAt: null },
      }),
      prisma.documentSignature.count({
        where: { documentGenere: { sessionId: v.id }, revokedAt: null },
      }),
      prisma.enrollment.count({ where: { sessionId: v.id, emargementSigneAt: { not: null } } }),
      prisma.presenceCreneau.count({ where: { enrollment: { sessionId: v.id } } }),
      prisma.sessionJour.findMany({ where: { sessionId: v.id }, select: { date: true } }),
    ]);
  } catch (err) {
    Sentry.captureException(err);
    return { error: "Erreur lors de la lecture des pièces de la session" };
  }
  const [
    documentsEmis,
    convocationsEnvoyees,
    liensEmargement,
    signatures,
    emargementsSignes,
    creneaux,
    joursDeclares,
  ] = compteurs;

  const avant = {
    dateDebut: avantSession.dateDebut.toISOString(),
    dateFin: avantSession.dateFin.toISOString(),
  };
  const apres = { dateDebut: v.dateDebut.toISOString(), dateFin: v.dateFin.toISOString() };

  const verdict = verdictDates({
    avant,
    apres,
    preuves: {
      emargementsSignes,
      signatures,
      liensEmargement,
      convocationsEnvoyees,
      documentsEmis,
      creneaux,
    },
  });

  if (verdict.motifRequis && (v.motifRequalification ?? "") === "") {
    return { error: messageRefusDates(verdict.enJeu) };
  }

  // 🔴 On ne décale PAS les `SessionJour` — décision et ses trois raisons dans
  // l'en-tête de `compterJoursHorsPlage`. Le prix de cette décision est une
  // divergence, et une divergence ne vaut que si elle SE VOIT : on compte les
  // journées désormais hors plage et on les rend à l'appelant, qui les affiche
  // et renvoie vers « Journées réellement animées » (sous-page Émargement) — le
  // seul écran habilité à les réécrire, avec sa propre garde de motif.
  //
  // ⚠️ `SessionJour.date` est en `@db.Date` (minuit UTC) : on retombe sur le
  // jour civil par `toISOString`, comme le fait déjà `session-jours.ts`. La
  // plage, elle, est un `DateTime` : c'est `parisDateISO` qui donne son jour.
  const joursHorsPlage = compterJoursHorsPlage({
    joursISO: joursDeclares.map((j) => j.date.toISOString().slice(0, 10)),
    debutISO: parisDateISO(v.dateDebut),
    finISO: parisDateISO(v.dateFin),
  });

  try {
    await prisma.trainingSession.update({
      where: { id: v.id },
      data: { dateDebut: v.dateDebut, dateFin: v.dateFin },
    });
  } catch (err) {
    Sentry.captureException(err);
    return { error: "Erreur lors de l'enregistrement des dates" };
  }

  await logQualiopiActivity({
    action: "qualiopi.session.dates.set",
    targetType: "TrainingSession",
    targetId: v.id,
    changes: {
      avant,
      apres,
      // Le motif et l'enjeu vont au JOURNAL, pas seulement à l'écran : c'est là
      // que l'auditeur ira chercher pourquoi la pièce et le dossier ont divergé,
      // et il doit y trouver une phrase écrite par un humain.
      ...(verdict.motifRequis
        ? {
            requalification: {
              motif: v.motifRequalification,
              enJeu: verdict.enJeu,
            },
          }
        : {}),
      ...(joursHorsPlage > 0 ? { joursHorsPlage } : {}),
    },
    session,
  });

  return { data: { id: v.id, joursHorsPlage, nbJours: joursDeclares.length } };
}

/**
 * Applique une transition de statut à une session.
 *
 * Validation : assertSessionTransition lève si la transition est interdite.
 * Idempotence : P2002 sur FormationTransition @@unique = déjà fait → retour ok.
 */
export async function transitionSessionAction(input: {
  id: string;
  toStatus: z.infer<typeof transitionSessionSchema>["toStatus"];
  trigger?: string;
  reason?: string;
  triggeredBy?: z.infer<typeof transitionSessionSchema>["triggeredBy"];
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = transitionSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Lire le statut actuel
  let currentSession: { id: string; statut: TrainingSessionStatut } | null;
  try {
    currentSession = await prisma.trainingSession.findUnique({
      where: { id: v.id },
      select: { id: true, statut: true },
    });
  } catch {
    return { error: "Erreur lors de la lecture de la session" };
  }
  if (!currentSession) return { error: "Session introuvable" };

  const fromStatus = currentSession.statut;
  const toStatus = v.toStatus as TrainingSessionStatut;

  // 🔴 Le motif des transitions terminales — constaté le 2026-08-17.
  //
  // Reporter exigeait un motif, ANNULER n'en exigeait aucun. Un clic sur un
  // bouton rouge, et c'était fait. Or annuler est PLUS engageant que reporter :
  // l'état est terminal, et la transition révoque en cascade les jetons
  // d'émargement. Un auditeur qui demande « pourquoi cette session a-t-elle été
  // annulée ? » n'obtenait aucune réponse : la donnée n'avait jamais été
  // demandée.
  //
  // La règle vit dans un module PUR, lu par l'écran ET par le serveur : deux
  // copies divergeraient, et l'utilisateur verrait un refus incompréhensible.
  const refus = refusMotif(toStatus, v.reason);
  if (refus !== null) return { error: refus };

  // Garde financement : si la cible est en_cours, vérifier les validations bloquantes.
  if (toStatus === "en_cours") {
    let financementEntries: Awaited<ReturnType<typeof getFinancementValidations>>;
    try {
      financementEntries = await getFinancementValidations(v.id);
    } catch {
      financementEntries = [];
    }
    const critiques = financementEntries.filter(
      (e) => e.result.ok === false && e.result.gravite === "critique",
    );
    if (critiques.length > 0) {
      const messages = critiques.map((e) => e.result.alerte ?? e.code).join(" | ");
      return {
        error: `Démarrage bloqué : ${messages} (accord OPCO/EDOF/France Travail requis).`,
      };
    }
  }

  // Garde émargement (R1 audit) : on ne marque pas une session « réalisée »
  // sans AUCUNE trace de présence (ind. 12).
  //
  // 🔴 `CONF-01` (2026-08-20) — deux corrections ici.
  //
  // 1. La mesure était DUPLIQUÉE avec le cron de clôture automatique, sous un
  //    commentaire disant « les deux DOIVENT rester alignées » — l'aveu qu'une
  //    duplication tenait par la vigilance. Elle vit désormais dans
  //    `presence/trace-cloture.ts`, en un seul exemplaire.
  //
  // 2. Elle comptait TOUTES les inscriptions, y compris les `abandon` et les
  //    `exclu`. Renoncer n'est pas une absence de preuve, c'est une sortie du
  //    dispositif : les compter faussait le dénominateur dans les deux sens.
  //
  // ⚠️ Le blocage reste sur « pas UNE seule trace », et ce n'est pas un oubli :
  // le durcissement en « tous les inscrits » a déjà été tenté puis RETIRÉ dans
  // ce dépôt (cf. `trace-cloture.ts`). Il rendait des sessions définitivement
  // non clôturables. Ce qui change, c'est que le cas PARTIEL cesse d'être muet.
  let traceCloture: Awaited<ReturnType<typeof mesurerTraceCloture>> | null = null;
  if (toStatus === "realisee") {
    try {
      traceCloture = await mesurerTraceCloture(v.id);
      if (clotureSansAucuneTrace(traceCloture)) {
        return {
          error:
            "Clôture bloquée : aucun émargement/relevé de présence saisi. Renseigner la présence avant de marquer la session réalisée.",
        };
      }
    } catch {
      // Fail-soft : une panne de lecture ne doit pas empêcher de clôturer une
      // session réellement tenue.
      traceCloture = null;
    }
  }

  // Valider la transition (lève si interdite)
  try {
    assertSessionTransition(fromStatus, toStatus);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Transition interdite" };
  }

  const trigger = v.trigger ?? `admin.transition.${toStatus}`;
  const triggeredBy: TransitionTriggeredBy = (v.triggeredBy as TransitionTriggeredBy) ?? "admin";

  // 🔴 `dureeReelleHeures` n'avait aucun écrivain sur les sessions COLLECTIVES —
  // seule la clôture AFEST 1-to-1 la renseignait. Elle restait donc nulle à vie :
  // fiche session « — h », certificat de réalisation sans durée, et ventilation
  // horaire OPCO refusée pour « durée réelle non renseignée » alors que les
  // horaires étaient déclarés depuis le début dans `session_jours`.
  //
  // On la fige à la CLÔTURE, comme le fait le 1-to-1, et seulement si personne ne
  // l'a saisie à la main. Sans journée déclarée on laisse `null` : la durée
  // prévue au catalogue n'est pas une constatation, et l'écrire ici la ferait
  // passer pour telle.
  const dureeReelleAEcrire =
    toStatus === "realisee" ? await resoudreDureeReelleACloture(v.id) : null;

  // Appliquer transition + écrire FormationTransition dans une tx
  try {
    await prisma.$transaction(async (tx) => {
      // Idempotence : @@unique [sessionId, toStatus, trigger]
      await writeSessionTransition(tx, {
        sessionId: v.id,
        from: fromStatus,
        to: toStatus,
        trigger,
        triggeredBy,
        triggeredById: session.userId,
        reason: v.reason ?? null,
      });

      await tx.trainingSession.update({
        where: { id: v.id },
        data: {
          statut: toStatus,
          ...(dureeReelleAEcrire !== null ? { dureeReelleHeures: dureeReelleAEcrire } : {}),
        },
      });
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      // Transition déjà appliquée pour ce trigger → idempotent, ok
      return { data: { id: v.id } };
    }
    return { error: "Erreur lors de la transition de la session" };
  }

  // 🔴 O7 — révocation AUTOMATIQUE des jetons d'émargement à l'annulation ou au
  // report. Sans cela, les liens restaient valides jusqu'à leur expiration
  // (fin + 48 h) : un stagiaire pouvait signer une session qui n'a pas eu lieu,
  // et la signature aurait été cryptographiquement valide — pire qu'inutile.
  // La garde du service de signature refuse déjà `annulee`/`reportee`, mais elle
  // ne ferme qu'une porte : on ferme aussi celle des jetons, dès la transition,
  // sans dépendre d'un clic manuel de l'admin sur « révoquer les liens ».
  if (toStatus === "annulee" || toStatus === "reportee") {
    try {
      const inscriptions = await prisma.enrollment.findMany({
        where: { sessionId: v.id },
        select: { id: true },
      });
      for (const i of inscriptions) {
        await revoquerTokensInscription({
          enrollmentId: i.id,
          motif: `Session ${toStatus} (${trigger})`,
          parAdminId: session.userId,
        });
      }
    } catch (err) {
      // Ne pas faire échouer la transition sur un échec de révocation : la garde
      // du service de signature reste le filet de sécurité. Mais le signaler.
      Sentry.captureException(err, {
        tags: { action: `transitionSessionAction:revocation_jetons` },
        extra: { sessionId: v.id, toStatus },
      });
    }
  }

  // 🔴 `CONF-01` — LE CAS PARTIEL CESSE D'ÊTRE MUET.
  //
  // La session est clôturée « réalisée » alors que des inscrits ACTIFS n'ont
  // aucune trace de présence. Une seule inscription renseignée suffisait à
  // franchir la garde, et onze personnes pouvaient se voir délivrer une
  // attestation sans qu'aucune preuve n'existe à leur nom — silencieusement.
  //
  // On n'a pas refusé la clôture : le durcissement rendrait des sessions
  // définitivement non clôturables (cf. `trace-cloture.ts`). On la SIGNALE, et
  // l'alerte dit les deux gestes qui la résolvent — compléter la feuille, ou
  // sortir du dispositif ceux qui ont renoncé.
  // 🔑 UN SEUL emetteur pour les deux chemins de cloture.
  //
  // 🔴 2026-08-24, cahier D2 — ce bloc vivait ICI et NULLE PART AILLEURS : la
  // cloture AUTOMATIQUE (le cron J+24 h, chemin dominant) ne signalait rien.
  // Recopier le bloc la-bas aurait recree la divergence que `CONF-01` venait de
  // fermer sur la MESURE, un cran plus loin. L'emission a donc rejoint la
  // mesure dans `trace-cloture.ts`.
  signalerClotureIncomplete(v.id, traceCloture);

  await logQualiopiActivity({
    action: `qualiopi.session.transition.${toStatus}`,
    targetType: "TrainingSession",
    targetId: v.id,
    changes: { from: fromStatus, to: toStatus, trigger },
    session,
  });

  return { data: { id: v.id } };
}
