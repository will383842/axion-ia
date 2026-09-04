/**
 * Cycle de vie d'une MISSION proposée à un formateur (2026-09-03).
 *
 * ## Le défaut que ce module ferme
 *
 * Affecter un formateur à une session ne lui disait rien : ni message, ni
 * demande d'accord. L'organisme découvrait à J-7 — ou le matin même — que la
 * personne n'était pas disponible, et n'avait alors plus le temps de chercher
 * quelqu'un d'autre. Un formateur qui refuse tôt rend service ; un formateur
 * qui ne sait pas qu'on compte sur lui ne peut pas refuser.
 *
 * ## Deux tables, deux rôles
 *
 * - `SessionFormateur` reste l'AFFECTATION courante — celle que lisent l'espace
 *   formateur, la lettre de mission, l'émargement, la rémunération.
 * - `MissionFormateur` est le JOURNAL des sollicitations : proposée, acceptée,
 *   refusée (avec motif obligatoire), retirée par l'organisme, expirée sans
 *   réponse. Un refus retire l'affectation mais la ligne reste : c'est elle qui
 *   nourrit le pilotage « refus et absences par formateur » (art. 8 de la
 *   procédure de sous-traitance — motiver une non-reconduction sur des faits).
 *
 * ## Le lien de réponse
 *
 * Jeton HMAC (`formateur_mission`) qui désigne UNE sollicitation
 * (`MissionFormateur.id`), valable jusqu'au démarrage de la session. Il n'a
 * pas besoin d'une table de consommation : une proposition déjà répondue ou
 * retirée rend le lien inerte par son seul statut. Le même geste est offert,
 * connecté, depuis l'espace formateur.
 *
 * ## Ce que ce module ne décide PAS
 *
 * Il n'empêche jamais l'organisme d'affecter qui il veut. Il propose, relance,
 * enregistre la réponse et lève une alerte quand une session se retrouve sans
 * formateur confirmé. L'arbitrage reste à Will — même doctrine que la fiabilité
 * (`fiabilite-service.ts`) et la RC pro non bloquante.
 */

import { prisma } from "@/lib/prisma";
import { signMagicToken, verifyMagicToken } from "@/lib/magic-token";
import { enqueueEmail } from "@/server/queue/queues";
import { formatLieu } from "@/server/qualiopi/lieu/format-lieu";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { ROLE_FORMATEUR_LABELS, MODALITE_LABELS } from "@/server/formateur/collectif-labels";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";
import {
  accordRequis,
  echeanceReponse,
  instantRelance,
  libelleEcheance,
  libelleInfosPratiques,
} from "@/server/qualiopi/trainers/delai-reponse-mission";
import type {
  MissionFormateurStatut,
  SessionFormateurRole,
} from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes — nommées, pas recopiées : l'alerte, la relance et l'écran doivent
// parler du même délai.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ CONSERVÉ pour les propositions ANTÉRIEURES à `echeanceReponseAt` (colonne
 * ajoutée le 2026-09-04), qui n'ont pas d'échéance en base et retombent sur ce
 * délai. Il ne pilote plus rien d'autre.
 *
 * 🔴 Ce qu'il faisait avant, et pourquoi c'était faux : il fixait À LA FOIS la
 * relance et le seuil de l'alerte « sans réponse », à trois jours, quelle que
 * soit la date de la session. Sur une session à moins de trois jours — le cas
 * courant, vérifié sur tout l'historique — ni l'une ni l'autre ne se
 * déclenchait jamais. Le délai est désormais dérivé du temps réellement
 * disponible : cf. `delai-reponse-mission.ts`.
 */
export const DELAI_RELANCE_JOURS = 3;

/** Un refus sans motif n'apprend rien à l'organisme : motif obligatoire. */
export const MOTIF_REFUS_MIN = 5;

/** Libellé humain de chaque statut. `Record` exhaustif : oublier ne compile pas. */
export const LIBELLE_STATUT_MISSION: Record<MissionFormateurStatut, string> = {
  en_attente: "En attente de réponse",
  acceptee: "Acceptée",
  refusee: "Refusée",
  retiree: "Retirée par l'organisme",
  expiree: "Expirée sans réponse",
  sans_reponse: "Sans réponse dans le délai",
};

/** Les réponses qu'un formateur peut donner — et rien d'autre. */
export const REPONSES_MISSION = ["acceptee", "refusee"] as const;
export type ReponseMission = (typeof REPONSES_MISSION)[number];

function isStub(): boolean {
  return Boolean(process.env["DATABASE_URL"]?.includes("stub.invalid"));
}

function fmtDateLongue(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
}

/** URL de la page de réponse (espace formateur, sans connexion préalable). */
export function buildMissionReponseUrl(token: string): string {
  return `${baseUrl()}${FORMATEUR_BASE_PATH}/mission/${encodeURIComponent(token)}`;
}

/** « 8 inscrits (10 prévus) » — l'effectif tel que le formateur veut le lire. */
export function formulerEffectif(inscrits: number, prevus: number | null | undefined): string {
  const base = `${inscrits} inscrit${inscrits > 1 ? "s" : ""}`;
  return prevus != null && prevus > 0 ? `${base} (${prevus} prévus)` : base;
}

/**
 * Durée de validité du lien : jusqu'au démarrage, jamais moins d'une heure
 * (une proposition faite la veille doit rester répondable ce soir).
 */
export function ttlJusquAuDemarrage(dateDebut: Date, now: Date): number {
  const uneHeure = 60 * 60 * 1000;
  return Math.max(uneHeure, dateDebut.getTime() - now.getTime());
}

// ─────────────────────────────────────────────────────────────────────────────
// Proposer
// ─────────────────────────────────────────────────────────────────────────────

export interface ProposerMissionInput {
  sessionId: string;
  trainerId: string;
  role?: SessionFormateurRole;
  now?: Date;
}

export type ProposerMissionResultat =
  { proposee: true; missionId: string; emailEnvoye: boolean } | { proposee: false; raison: string };

const SESSION_POUR_MISSION = {
  id: true,
  numero: true,
  titreSession: true,
  statut: true,
  dateDebut: true,
  dateFin: true,
  modalite: true,
  nbParticipantsPrevus: true,
  lieuType: true,
  lieuIntitule: true,
  lieuAdresse: true,
  lieuCodePostal: true,
  lieuVille: true,
  lieuSalle: true,
  lieuVisioUrl: true,
} as const;

/**
 * Propose la mission au formateur : journalise la sollicitation et lui envoie
 * le lien de réponse. Les sollicitations précédentes encore ouvertes pour ce
 * couple (session, formateur) sont retirées — une seule proposition vivante à
 * la fois, sinon deux liens valides diraient deux choses.
 *
 * Fail-soft : ne lève jamais vers l'appelant (l'affectation, elle, est faite).
 * Une session passée ou non planifiée ne donne lieu à aucune proposition — on
 * ne demande pas à quelqu'un s'il veut animer une session réalisée.
 */
export async function proposerMissionFormateur(
  input: ProposerMissionInput,
): Promise<ProposerMissionResultat> {
  if (isStub()) return { proposee: false, raison: "stub" };
  const now = input.now ?? new Date();
  const role: SessionFormateurRole = input.role ?? "principal";

  try {
    const [session, trainer, inscrits] = await Promise.all([
      prisma.trainingSession.findUnique({
        where: { id: input.sessionId },
        select: SESSION_POUR_MISSION,
      }),
      prisma.trainer.findUnique({
        where: { id: input.trainerId },
        // 🔴 `statut` n'était PAS lu. C'est la colonne qui dit si l'accord de
        // cette personne est requis — sans elle, on demandait au dirigeant de
        // l'organisme s'il acceptait d'animer sa propre session.
        select: { id: true, email: true, prenom: true, nom: true, actif: true, statut: true },
      }),
      prisma.enrollment.count({
        where: { sessionId: input.sessionId, ...inscriptionsActives() },
      }),
    ]);
    if (session === null) return { proposee: false, raison: "session introuvable" };
    if (trainer === null) return { proposee: false, raison: "formateur introuvable" };
    if (session.statut !== "planifiee") {
      return { proposee: false, raison: `session ${session.statut}, aucune proposition` };
    }
    if (session.dateDebut.getTime() <= now.getTime()) {
      return { proposee: false, raison: "session déjà démarrée, aucune proposition" };
    }
    // ⚠️ Le silence est ici la bonne réponse, pas un échec : l'AFFECTATION est
    // faite (elle l'est chez l'appelant, avant nous), et un formateur interne
    // n'a rien à accepter. On ne crée même pas de ligne de sollicitation — un
    // journal des accords qui contiendrait des accords jamais demandés ne
    // vaudrait plus rien comme preuve.
    if (!accordRequis(trainer.statut)) {
      return { proposee: false, raison: `formateur ${trainer.statut}, accord non requis` };
    }

    const mission = await prisma.$transaction(async (tx) => {
      await tx.missionFormateur.updateMany({
        where: { sessionId: session.id, trainerId: trainer.id, statut: "en_attente" },
        data: { statut: "retiree" },
      });
      return tx.missionFormateur.create({
        data: {
          sessionId: session.id,
          trainerId: trainer.id,
          role,
          solliciteAt: now,
          echeanceReponseAt: echeanceReponse(session.dateDebut, now),
        },
        select: { id: true },
      });
    });

    const emailEnvoye = await envoyerProposition({
      missionId: mission.id,
      relance: false,
      now,
      session,
      trainer,
      inscrits,
      role,
    });
    return { proposee: true, missionId: mission.id, emailEnvoye };
  } catch (err) {
    console.error(
      `[mission-formateur] proposition impossible (session ${input.sessionId}, formateur ${input.trainerId}):`,
      err instanceof Error ? err.message : String(err),
    );
    return { proposee: false, raison: "erreur" };
  }
}

async function envoyerProposition(args: {
  missionId: string;
  relance: boolean;
  now: Date;
  session: {
    id: string;
    numero: string;
    titreSession: string;
    dateDebut: Date;
    dateFin: Date;
    modalite: string;
    nbParticipantsPrevus: number | null;
    lieuType: string | null;
    lieuIntitule: string | null;
    lieuAdresse: string | null;
    lieuCodePostal: string | null;
    lieuVille: string | null;
    lieuSalle: string | null;
    lieuVisioUrl: string | null;
  };
  trainer: { id: string; email: string; prenom: string; nom: string };
  inscrits: number;
  role: SessionFormateurRole;
  /** Échéance réelle de réponse ; absente sur une proposition ancienne. */
  echeance?: Date | null;
}): Promise<boolean> {
  const { session, trainer, now } = args;
  const echeance = args.echeance ?? echeanceReponse(session.dateDebut, now);
  const token = await signMagicToken({
    scope: "formateur_mission",
    resourceId: args.missionId,
    ttlMs: ttlJusquAuDemarrage(session.dateDebut, now),
  });
  const lieu = formatLieu({
    ...session,
    lieuType: session.lieuType as "sur_site" | "nos_locaux" | "distanciel" | null,
  });
  const envoi = await enqueueEmail(
    "formateur-mission-proposee",
    trainer.email,
    "fr",
    {
      formateurPrenomNom: `${trainer.prenom} ${trainer.nom}`,
      titreFormation: session.titreSession,
      numeroSession: session.numero,
      dateDebut: fmtDateLongue(session.dateDebut),
      dateFin: fmtDateLongue(session.dateFin),
      modalite: MODALITE_LABELS[session.modalite] ?? session.modalite,
      lieu: lieu ?? "lieu à préciser",
      effectif: formulerEffectif(args.inscrits, session.nbParticipantsPrevus),
      roleLibelle: ROLE_FORMATEUR_LABELS[args.role].toLowerCase(),
      lienReponse: buildMissionReponseUrl(token),
      // 🔴 C'était `fmtDateLongue(session.dateDebut)` : le message annonçait
      // que le lien valait « jusqu'au démarrage », ce qui est exact pour le
      // JETON mais faux pour la RÉPONSE — passé l'échéance, la session est
      // réaffectée et le lien ne sert plus qu'à écrire à l'organisme.
      dateLimiteReponse: fmtDateLongue(echeance),
      delaiReponse: libelleEcheance(echeance, now),
      infosPratiques: libelleInfosPratiques(session.dateDebut, now),
      ...(args.relance ? { relance: true } : {}),
    },
    {
      jobId: `formateur-mission-${args.missionId}-${args.relance ? "relance" : "proposition"}`,
      entityType: "MissionFormateur",
      entityId: args.missionId,
    },
  );
  if (!envoi.enqueued) {
    console.error(
      `[mission-formateur] e-mail NON ENVOYÉ pour la mission ${args.missionId}` +
        (envoi.garePourValidation === true
          ? " (garé en corbeille de validation)"
          : " (file de messages indisponible)"),
    );
    return false;
  }
  await prisma.missionFormateur.update({
    where: { id: args.missionId },
    data: args.relance ? { relanceAt: now } : { emailEnvoyeAt: now },
  });
  return true;
}

/**
 * Retire les sollicitations encore ouvertes d'une session — quand l'organisme
 * retire le formateur ou en affecte un autre AVANT la réponse. Sans cela, le
 * formateur écarté pourrait encore « accepter » une session qui n'est plus la
 * sienne, et l'alerte « sans réponse » continuerait de le réclamer.
 */
export async function retirerMissionsEnAttente(
  sessionId: string,
  opts: { saufTrainerId?: string | null; role?: SessionFormateurRole } = {},
): Promise<number> {
  if (isStub()) return 0;
  try {
    const r = await prisma.missionFormateur.updateMany({
      where: {
        sessionId,
        statut: "en_attente",
        ...(opts.role !== undefined ? { role: opts.role } : {}),
        ...(opts.saufTrainerId ? { trainerId: { not: opts.saufTrainerId } } : {}),
      },
      data: { statut: "retiree" },
    });
    return r.count;
  } catch (err) {
    console.error(
      `[mission-formateur] retrait des sollicitations impossible (session ${sessionId}):`,
      err instanceof Error ? err.message : String(err),
    );
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Relancer, expirer — appelés par le cron `formation-crons.missions-formateur`
// ─────────────────────────────────────────────────────────────────────────────

export interface BilanRelances {
  relancees: number;
  erreurs: number;
  expirees: number;
  /** Échéance dépassée AVANT le démarrage : la session est libérée. */
  sansReponse: number;
}

/**
 * Relance les sollicitations sans réponse depuis {@link DELAI_RELANCE_JOURS}
 * jours, une seule fois ; puis passe en `expiree` celles dont la session a
 * démarré. Fail-soft par mission.
 */
export async function relancerEtExpirerMissions(now: Date = new Date()): Promise<BilanRelances> {
  const bilan: BilanRelances = { relancees: 0, erreurs: 0, expirees: 0, sansReponse: 0 };
  if (isStub()) return bilan;

  // 1. Expirer — AVANT de relancer : une session démarrée ne se relance pas.
  const expirees = await prisma.missionFormateur.updateMany({
    where: { statut: "en_attente", session: { dateDebut: { lte: now } } },
    data: { statut: "expiree" },
  });
  bilan.expirees = expirees.count;

  // 1 bis. ÉCHÉANCE DÉPASSÉE, session pas encore démarrée — le cas qui n'existait
  // pas. Avant, la seule sortie d'une proposition muette était `expiree`, AU
  // démarrage : l'organisme apprenait que personne n'avait confirmé le matin
  // même, quand il n'y a plus rien à faire. Ici on tranche AVANT, et on libère
  // la session pour qu'un autre formateur puisse la prendre.
  //
  // ⚠️ On retire l'affectation, exactement comme un refus — c'est l'effet
  // voulu — mais on n'écrit PAS `refusee`. Cf. le commentaire de l'énumération :
  // un refus non formulé, avec un motif forcé, salirait le registre des refus.
  bilan.sansReponse = await passerLesSansReponse(now);

  // 2. Relancer — à MI-DÉLAI, jamais à J+3 fixe.
  const candidates = await prisma.missionFormateur.findMany({
    where: {
      statut: "en_attente",
      relanceAt: null,
      session: { statut: "planifiee", dateDebut: { gt: now } },
    },
    select: {
      id: true,
      role: true,
      solliciteAt: true,
      echeanceReponseAt: true,
      session: { select: SESSION_POUR_MISSION },
      trainer: { select: { id: true, email: true, prenom: true, nom: true } },
    },
  });
  const aRelancer = candidates.filter((m) => {
    // Proposition antérieure à la colonne d'échéance : ancien régime, J+3.
    const echeance =
      m.echeanceReponseAt ??
      new Date(m.solliciteAt.getTime() + DELAI_RELANCE_JOURS * 24 * 60 * 60 * 1000);
    return instantRelance(m.solliciteAt, echeance).getTime() <= now.getTime();
  });

  for (const m of aRelancer) {
    try {
      const inscrits = await prisma.enrollment.count({
        where: { sessionId: m.session.id, ...inscriptionsActives() },
      });
      const ok = await envoyerProposition({
        missionId: m.id,
        relance: true,
        now,
        session: m.session,
        trainer: m.trainer,
        inscrits,
        role: m.role,
        echeance: m.echeanceReponseAt,
      });
      if (ok) bilan.relancees += 1;
      else bilan.erreurs += 1;
    } catch (err) {
      bilan.erreurs += 1;
      console.error(
        `[mission-formateur] relance impossible (mission ${m.id}):`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return bilan;
}

/**
 * Passe en `sans_reponse` les propositions dont l'échéance est dépassée et
 * dont la session n'a pas encore démarré, et LIBÈRE la session.
 *
 * Le retrait de l'affectation est fait dans la même transaction que le
 * changement de statut : sans lui, la session garderait un formateur principal
 * qui n'a jamais confirmé, `regleSessionSansFormateur` ne la verrait pas
 * (elle exige `formateurPrincipalId: null`), et on retomberait exactement dans
 * le trou constaté sur AXI-SESS-2026-010 le 2026-09-03 — une session qui
 * démarre sans que personne n'ait dit oui, et zéro alerte.
 */
async function passerLesSansReponse(now: Date): Promise<number> {
  const echues = await prisma.missionFormateur.findMany({
    where: {
      statut: "en_attente",
      // La colonne est nullable : une proposition sans échéance garde l'ancien
      // régime (elle n'expire qu'au démarrage). On ne la fait pas basculer
      // rétroactivement.
      echeanceReponseAt: { not: null, lte: now },
      session: { statut: "planifiee", dateDebut: { gt: now } },
    },
    select: {
      id: true,
      sessionId: true,
      trainerId: true,
      session: { select: { formateurPrincipalId: true } },
    },
  });

  let n = 0;
  for (const m of echues) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.missionFormateur.update({
          where: { id: m.id },
          data: { statut: "sans_reponse" },
        });
        if (m.session.formateurPrincipalId === m.trainerId) {
          await tx.trainingSession.update({
            where: { id: m.sessionId },
            data: { formateurPrincipalId: null },
          });
        }
        await tx.sessionFormateur.deleteMany({
          where: { sessionId: m.sessionId, trainerId: m.trainerId },
        });
      });
      n += 1;
    } catch (err) {
      console.error(
        `[mission-formateur] passage sans_reponse impossible (mission ${m.id}):`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Répondre
// ─────────────────────────────────────────────────────────────────────────────

export interface RepondreMissionInput {
  missionId: string;
  /**
   * Formateur qui répond, quand il est CONNECTÉ. Absent quand la réponse vient
   * du lien e-mail : le jeton a déjà été vérifié par l'appelant et désigne la
   * mission, donc son formateur.
   */
  trainerId?: string;
  reponse: ReponseMission;
  motif?: string;
  now?: Date;
}

export type RepondreMissionResultat =
  | { ok: true; statut: MissionFormateurStatut; sessionId: string; trainerId: string }
  | { ok: false; erreur: string };

/** Ce que dit le motif, sans espaces superflus — ou `null` s'il est trop court. */
export function normaliserMotifRefus(motif: string | undefined): string | null {
  const m = (motif ?? "").trim();
  return m.length >= MOTIF_REFUS_MIN ? m : null;
}

/**
 * Enregistre la réponse. Un REFUS retire l'affectation dans la même
 * transaction : `formateurPrincipalId` remis à null si c'était lui, ligne
 * `SessionFormateur` supprimée. La session apparaît alors sans formateur — et
 * l'alerte `formateur_mission_refusee` la réclame au secrétariat.
 */
export async function repondreMission(
  input: RepondreMissionInput,
): Promise<RepondreMissionResultat> {
  if (isStub()) return { ok: false, erreur: "Service indisponible." };
  const now = input.now ?? new Date();

  const mission = await prisma.missionFormateur.findUnique({
    where: { id: input.missionId },
    select: {
      id: true,
      trainerId: true,
      sessionId: true,
      statut: true,
      echeanceReponseAt: true,
      session: { select: { dateDebut: true, statut: true, formateurPrincipalId: true } },
    },
  });
  if (mission === null) return { ok: false, erreur: "Cette proposition n'existe pas." };
  if (input.trainerId !== undefined && input.trainerId !== mission.trainerId) {
    return { ok: false, erreur: "Cette proposition ne vous est pas adressée." };
  }
  if (mission.statut !== "en_attente") {
    return {
      ok: false,
      erreur: `Cette proposition n'attend plus de réponse : ${LIBELLE_STATUT_MISSION[mission.statut].toLowerCase()}.`,
    };
  }
  if (
    mission.session.dateDebut.getTime() <= now.getTime() ||
    mission.session.statut !== "planifiee"
  ) {
    await prisma.missionFormateur.update({
      where: { id: mission.id },
      data: { statut: "expiree" },
    });
    return { ok: false, erreur: "La session a déjà démarré : cette proposition a expiré." };
  }
  // 🔴 L'ÉCHÉANCE, et pas seulement le démarrage. Sans elle, un formateur
  // pouvait accepter à H-1 une session que l'organisme avait déjà réattribuée
  // faute de réponse — deux formateurs convaincus d'animer la même journée.
  //
  // Le cron a normalement déjà basculé la ligne ; ce chemin couvre le clic qui
  // arrive ENTRE l'échéance et le passage du cron. Il bascule lui-même plutôt
  // que d'attendre : la personne a le refus sous les yeux, elle doit lire la
  // vraie raison.
  if (mission.echeanceReponseAt !== null && mission.echeanceReponseAt.getTime() <= now.getTime()) {
    await prisma.missionFormateur.update({
      where: { id: mission.id },
      data: { statut: "sans_reponse" },
    });
    return {
      ok: false,
      erreur:
        "Le délai de réponse est dépassé : la session a été libérée pour être confiée à quelqu'un d'autre. " +
        "Si vous êtes malgré tout disponible, écrivez-le-nous ci-dessous — nous n'avons peut-être pas encore réaffecté.",
    };
  }

  if (input.reponse === "acceptee") {
    await prisma.missionFormateur.update({
      where: { id: mission.id },
      data: { statut: "acceptee", reponduAt: now },
    });
    return {
      ok: true,
      statut: "acceptee",
      sessionId: mission.sessionId,
      trainerId: mission.trainerId,
    };
  }

  const motif = normaliserMotifRefus(input.motif);
  if (motif === null) {
    return {
      ok: false,
      erreur: `Indiquez le motif de votre refus (${MOTIF_REFUS_MIN} caractères au moins) : il nous aide à réaffecter la session.`,
    };
  }
  await prisma.$transaction(async (tx) => {
    await tx.missionFormateur.update({
      where: { id: mission.id },
      data: { statut: "refusee", reponduAt: now, motifRefus: motif },
    });
    if (mission.session.formateurPrincipalId === mission.trainerId) {
      await tx.trainingSession.update({
        where: { id: mission.sessionId },
        data: { formateurPrincipalId: null },
      });
    }
    await tx.sessionFormateur.deleteMany({
      where: { sessionId: mission.sessionId, trainerId: mission.trainerId },
    });
  });
  return {
    ok: true,
    statut: "refusee",
    sessionId: mission.sessionId,
    trainerId: mission.trainerId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectures
// ─────────────────────────────────────────────────────────────────────────────

export interface MissionCourante {
  id: string;
  statut: MissionFormateurStatut;
  role: SessionFormateurRole;
  solliciteAt: Date;
  emailEnvoyeAt: Date | null;
  relanceAt: Date | null;
  reponduAt: Date | null;
  motifRefus: string | null;
}

const MISSION_SELECT = {
  id: true,
  statut: true,
  role: true,
  solliciteAt: true,
  emailEnvoyeAt: true,
  relanceAt: true,
  reponduAt: true,
  motifRefus: true,
} as const;

/** La DERNIÈRE sollicitation d'un formateur sur une session, ou `null`. Stub-safe. */
export async function lireMissionCourante(
  sessionId: string,
  trainerId: string,
): Promise<MissionCourante | null> {
  try {
    return await prisma.missionFormateur.findFirst({
      where: { sessionId, trainerId },
      orderBy: { solliciteAt: "desc" },
      select: MISSION_SELECT,
    });
  } catch {
    return null;
  }
}

/** Les sollicitations OUVERTES d'un formateur, avec l'identité de la session. */
export async function listerMissionsAConfirmer(trainerId: string): Promise<
  Array<{
    id: string;
    role: SessionFormateurRole;
    solliciteAt: Date;
    session: { id: string; numero: string; titreSession: string; dateDebut: Date; dateFin: Date };
  }>
> {
  try {
    return await prisma.missionFormateur.findMany({
      where: { trainerId, statut: "en_attente", session: { dateDebut: { gt: new Date() } } },
      orderBy: { session: { dateDebut: "asc" } },
      select: {
        id: true,
        role: true,
        solliciteAt: true,
        session: {
          select: { id: true, numero: true, titreSession: true, dateDebut: true, dateFin: true },
        },
      },
    });
  } catch {
    return [];
  }
}

export interface MissionParJeton {
  id: string;
  statut: MissionFormateurStatut;
  role: SessionFormateurRole;
  /** Échéance de réponse ; `null` sur une proposition antérieure au 2026-09-04. */
  echeanceReponseAt: Date | null;
  /** L'échéance est-elle passée ? Calculé ici pour que l'écran n'ait pas à le refaire. */
  delaiDepasse: boolean;
  trainer: { id: string; prenom: string; nom: string };
  session: {
    id: string;
    numero: string;
    titreSession: string;
    dateDebut: Date;
    dateFin: Date;
    modalite: string;
    lieu: string | null;
    effectif: string;
  };
}

/**
 * Résout un jeton de réponse en sollicitation. `null` si le jeton est faux,
 * expiré ou ne désigne rien. Ne consomme rien : c'est le STATUT de la mission
 * qui dit si elle attend encore une réponse.
 */
export async function lireMissionParJeton(token: string): Promise<MissionParJeton | null> {
  const verified = await verifyMagicToken(token, { scope: "formateur_mission" });
  if (!verified.ok) return null;
  try {
    const m = await prisma.missionFormateur.findUnique({
      where: { id: verified.resourceId },
      select: {
        id: true,
        statut: true,
        role: true,
        echeanceReponseAt: true,
        trainer: { select: { id: true, prenom: true, nom: true } },
        session: {
          select: {
            ...SESSION_POUR_MISSION,
            _count: { select: { enrollments: { where: { ...inscriptionsActives() } } } },
          },
        },
      },
    });
    if (m === null) return null;
    return {
      id: m.id,
      statut: m.statut,
      role: m.role,
      echeanceReponseAt: m.echeanceReponseAt,
      delaiDepasse:
        m.echeanceReponseAt !== null && m.echeanceReponseAt.getTime() <= new Date().getTime(),
      trainer: m.trainer,
      session: {
        id: m.session.id,
        numero: m.session.numero,
        titreSession: m.session.titreSession,
        dateDebut: m.session.dateDebut,
        dateFin: m.session.dateFin,
        modalite: m.session.modalite,
        lieu: formatLieu({
          ...m.session,
          lieuType: m.session.lieuType as "sur_site" | "nos_locaux" | "distanciel" | null,
        }),
        effectif: formulerEffectif(m.session._count.enrollments, m.session.nbParticipantsPrevus),
      },
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pilotage — refus et absences par formateur
// ─────────────────────────────────────────────────────────────────────────────

/** Fenêtre d'observation, alignée sur la fiabilité (24 mois). */
export const FENETRE_PILOTAGE_MOIS = 24;

/** Les faits d'intervenant qui sont des ABSENCES : il n'est pas venu. */
export const FAITS_ABSENCE = ["desistement", "annulation_tardive"] as const;

export interface StatsMissionsFormateur {
  proposees: number;
  acceptees: number;
  refusees: number;
  sansReponse: number;
  expirees: number;
  /** Incidents `desistement` ou `annulation_tardive` consignés contre lui. */
  absences: number;
  /** Les derniers refus, motif compris — ce que l'article 8 demande de pouvoir citer. */
  derniersRefus: Array<{
    reponduAt: Date | null;
    motifRefus: string | null;
    session: { numero: string; titreSession: string };
  }>;
}

const STATS_VIDES: StatsMissionsFormateur = {
  proposees: 0,
  acceptees: 0,
  refusees: 0,
  sansReponse: 0,
  expirees: 0,
  absences: 0,
  derniersRefus: [],
};

/** Refus, silences et absences d'un formateur sur {@link FENETRE_PILOTAGE_MOIS} mois. Stub-safe. */
export async function statsMissionsFormateur(
  trainerId: string,
  now: Date = new Date(),
): Promise<StatsMissionsFormateur> {
  if (isStub()) return STATS_VIDES;
  const depuis = new Date(now);
  depuis.setMonth(depuis.getMonth() - FENETRE_PILOTAGE_MOIS);
  try {
    const [parStatut, absences, derniersRefus] = await Promise.all([
      prisma.missionFormateur.groupBy({
        by: ["statut"],
        where: { trainerId, solliciteAt: { gte: depuis } },
        _count: { _all: true },
      }),
      prisma.incident.count({
        where: {
          trainerId,
          dateIncident: { gte: depuis },
          faitIntervenant: { in: [...FAITS_ABSENCE] },
        },
      }),
      prisma.missionFormateur.findMany({
        where: { trainerId, statut: "refusee", solliciteAt: { gte: depuis } },
        orderBy: { reponduAt: "desc" },
        take: 5,
        select: {
          reponduAt: true,
          motifRefus: true,
          session: { select: { numero: true, titreSession: true } },
        },
      }),
    ]);
    const n = (s: MissionFormateurStatut): number =>
      parStatut.find((p) => p.statut === s)?._count._all ?? 0;
    // Une proposition RETIRÉE par l'organisme n'est pas un fait du formateur :
    // elle ne compte ni pour lui ni contre lui.
    const proposees = n("en_attente") + n("acceptee") + n("refusee") + n("expiree");
    return {
      proposees,
      acceptees: n("acceptee"),
      refusees: n("refusee"),
      sansReponse: n("en_attente"),
      expirees: n("expiree"),
      absences,
      derniersRefus,
    };
  } catch {
    return STATS_VIDES;
  }
}
