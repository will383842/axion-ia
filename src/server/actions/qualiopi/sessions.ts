/**
 * Qualiopi — Server Actions Session de formation (T3).
 *
 * createSessionAction      : crée une session planifiée (validation canCreateSessionFor).
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
  financementType: z.enum(FINANCEMENT_TYPES).optional(),
  recurrence: z.number().int().min(1).optional(),
  // Lieu de déroulement — facultatif, mais imprimé sur la convention, la
  // convocation et la feuille d'émargement dès qu'il est renseigné.
  ...lieuInputSchema.shape,
});

const setSessionLieuSchema = z.object({
  id: z.string().uuid(),
  ...lieuInputSchema.shape,
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
): Promise<ActionResult<{ id: string; numero: string }>> {
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

  // Snapshot légal (WS5) — fige la formation telle que vendue à cette session.
  const formationSnapshot = buildFormationSnapshot(formation, new Date());

  // Créer la session + FormationTransition initiale dans une transaction,
  // avec retry sur collision de numéro (R7 : numéro ré-alloué à chaque tentative).
  let created: { id: string; numero: string };
  try {
    created = await withNumberRetry(() =>
      prisma.$transaction(async (tx) => {
        const numero = await allocateSessionNumero(
          v.recurrence !== undefined ? { recurrence: v.recurrence } : undefined,
        );
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
      }),
    );
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002")
      return { error: "Un conflit de numéro a été détecté, veuillez réessayer" };
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
    },
    session,
  });

  return { data: { id: created.id, numero: created.numero } };
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
  const { id, ...lieuBrut } = parsed.data;
  const lieu = normaliserLieu(lieuBrut);

  const LIEU_SELECT = {
    lieuType: true,
    lieuIntitule: true,
    lieuAdresse: true,
    lieuCodePostal: true,
    lieuVille: true,
    lieuSalle: true,
    lieuVisioUrl: true,
  } as const;

  let avant: Record<string, unknown> | null;
  try {
    avant = await prisma.trainingSession.findUnique({ where: { id }, select: LIEU_SELECT });
  } catch {
    return { error: "Erreur lors de la lecture de la session" };
  }
  if (!avant) return { error: "Session introuvable" };

  try {
    await prisma.trainingSession.update({ where: { id }, data: lieu as never });
  } catch (err) {
    Sentry.captureException(err);
    return { error: "Erreur lors de l'enregistrement du lieu" };
  }

  await logQualiopiActivity({
    action: "qualiopi.session.lieu.set",
    targetType: "TrainingSession",
    targetId: id,
    changes: { avant, apres: lieu },
    session,
  });

  return { data: { id } };
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
  // manuellement sans aucune trace de présence/émargement (ind. 12). S'il existe
  // des inscrits mais aucun émargement/taux saisi → bloquer. (L'auto-clôture cron
  // J+1 reste un filet de sécurité signalé par l'alerte R03 a posteriori.)
  if (toStatus === "realisee") {
    try {
      const totalInscrits = await prisma.enrollment.count({ where: { sessionId: v.id } });
      if (totalInscrits > 0) {
        // Symétrique de la garde du cron (`qualiopi-formation-crons-worker.ts`),
        // qui porte le commentaire détaillé. Les deux DOIVENT rester alignées,
        // sinon clôture automatique et clôture manuelle divergent.
        // `not: null` volontairement : le durcissement en `> 0` rendait certaines
        // sessions définitivement non clôturables (cf. commentaire du worker).
        const avecEmargement = await prisma.enrollment.count({
          where: {
            sessionId: v.id,
            OR: [{ emargementSigneAt: { not: null } }, { tauxPresencePct: { not: null } }],
          },
        });
        if (avecEmargement === 0) {
          return {
            error:
              "Clôture bloquée : aucun émargement/relevé de présence saisi. Renseigner la présence avant de marquer la session réalisée.",
          };
        }
      }
    } catch {
      // En cas d'erreur de lecture, ne pas bloquer la transition (fail-soft).
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
        data: { statut: toStatus },
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

  await logQualiopiActivity({
    action: `qualiopi.session.transition.${toStatus}`,
    targetType: "TrainingSession",
    targetId: v.id,
    changes: { from: fromStatus, to: toStatus, trigger },
    session,
  });

  return { data: { id: v.id } };
}
