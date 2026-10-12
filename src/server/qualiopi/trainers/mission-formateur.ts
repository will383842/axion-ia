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
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import { envoiAllume } from "@/server/qualiopi/formateurs-independants/interrupteurs-envoi";
import { controlerGardeMission } from "@/server/qualiopi/formateurs-independants/garde-mission-portes";
import { lireConditionsFigees } from "@/server/qualiopi/formateurs-independants/conditions-figees";
import { champsF23Honoraires } from "@/server/qualiopi/formateurs-independants/proposition-chiffree";
import { notifierPropositionClose } from "@/server/qualiopi/formateurs-independants/proposition-close";
import {
  ecritureFormateurPermise,
  versionSessionFormateur,
} from "@/server/qualiopi/formateurs-independants/version-session";
import {
  archiverAffectationsRetirees,
  lireAffectationsAvantRetrait,
} from "@/server/qualiopi/trainers/affectation-retiree";
import {
  accordRequis,
  echeanceReponse,
  instantRelance,
  libelleEcheance,
  libelleInfosPratiques,
} from "@/server/qualiopi/trainers/delai-reponse-mission";
import type {
  MissionFormateurStatut,
  Prisma,
  SessionFormateurRole,
  TrainerStatut,
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
  // Le libellé DIT que l'accord vient d'ailleurs. « Acceptée » tout court
  // laisserait croire au geste du formateur dans l'outil ; l'écran et le PDF
  // seraient alors indiscernables d'une acceptation par lien, ce qui est
  // exactement ce que la valeur d'énumération sépare.
  accord_hors_outil: "Accord consigné hors outil",
  // Schéma n° 1 formateurs freelance (2026-10-10) — posée, encore jamais écrite.
  desistee: "Désistement du formateur",
};

/** Les réponses qu'un formateur peut donner — et rien d'autre. */
export const REPONSES_MISSION = ["acceptee", "refusee"] as const;
export type ReponseMission = (typeof REPONSES_MISSION)[number];

/**
 * L'ACCORD DONNÉ (lot S2, N1/N2) : par le lien (`acceptee`) ou consigné hors de
 * l'outil (`accord_hors_outil`). Constante unique : convocation, rappel, retrait
 * et alertes disent la même chose (test statique : aucune comparaison littérale
 * à `"acceptee"` ailleurs qu'ici, hors des trois règles d'alerte qui portent
 * déjà la paire complète).
 */
export const STATUTS_ACCORD_DONNE = [
  "acceptee",
  "accord_hors_outil",
] as const satisfies ReadonlyArray<MissionFormateurStatut>;

/**
 * Ce qui vaut accord pour CONVOQUER (J-7) et RAPPELER (J-1).
 *
 * Interrupteur `formateurs.affectation_sure` arrêté : l'accord par le lien
 * seul, exactement comme avant S2. Allumé : l'accord hors outil aussi — un
 * formateur dont l'accord a été noté au téléphone reçoit enfin ses
 * informations pratiques.
 */
export function statutsAccordConvocation(
  affectationSure: boolean,
): ReadonlyArray<MissionFormateurStatut> {
  return affectationSure ? STATUTS_ACCORD_DONNE : ["acceptee"];
}

/**
 * L'écran de réponse doit-il proposer le refus LIBRE (motif facultatif) ?
 * Interrupteur `formateurs.affectation_sure` allumé ET formateur indépendant.
 * Toute erreur de lecture : non (l'écran d'avant).
 */
export async function refusLibrePour(trainerId: string): Promise<boolean> {
  if (!(await interrupteurAllume("affectation_sure"))) return false;
  try {
    const t = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { statut: true },
    });
    return t !== null && refusSansMotifExige(t.statut);
  } catch {
    return false;
  }
}

/**
 * Un refus sans motif exigé : celui d'un formateur indépendant (à lire
 * seulement interrupteur `formateurs.affectation_sure` allumé). Le salarié
 * garde son motif.
 */
export function refusSansMotifExige(statut: TrainerStatut): boolean {
  return statut === "sous_traitant";
}

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
        select: {
          id: true,
          email: true,
          prenom: true,
          nom: true,
          actif: true,
          statut: true,
          finCollaborationAt: true,
        },
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
    // 🔴 L3 — garde de mission (interrupteur `formateurs.garde_mission_portes` ;
    // coupé : aucun effet). Aucune proposition à qui ne peut pas recevoir de mission.
    const garde = await controlerGardeMission(trainer.id, now);
    if (garde.refus.length > 0) {
      return { proposee: false, raison: `garde de mission : ${garde.refus.join(" ")}` };
    }

    // Lot L11c — moteur des missions allumé (`lettre_auto` ET `lettre_v2`) : un
    // couple dont l'accord est déjà donné ne reçoit pas de seconde proposition.
    // Une seconde mission ferait lier la lettre ailleurs que sur la mission
    // acceptée. Coupé : exactement comme avant.
    if ((await envoiAllume("lettre_auto")) && (await interrupteurAllume("lettre_v2"))) {
      const dejaAcceptee = await prisma.missionFormateur.findFirst({
        where: {
          sessionId: session.id,
          trainerId: trainer.id,
          role,
          statut: { in: [...STATUTS_ACCORD_DONNE] },
        },
        select: { id: true },
      });
      if (dejaAcceptee !== null) {
        return {
          proposee: false,
          raison: "accord déjà donné pour cette session : aucune nouvelle proposition",
        };
      }
    }

    // Lot L11b — les conditions financières FIGÉES au choix en cartes sont
    // recopiées sur la mission (interrupteur `formateurs.choix_cartes` ; coupé :
    // `null`, la mission se crée exactement comme avant).
    // Le choix en cartes ne vaut que pour le formateur PRINCIPAL.
    const conditions =
      role === "principal" ? await lireConditionsFigees(session.id, trainer.id) : null;

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
          ...(conditions !== null
            ? {
                tarifHtCents: conditions.tarifHtCents,
                forfaitDeplacementParJourHtCents: conditions.forfaitDeplacementParJourHtCents,
                regimeTvaFige: conditions.regimeTvaFige,
              }
            : {}),
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
  trainer: {
    id: string;
    email: string;
    prenom: string;
    nom: string;
    finCollaborationAt?: Date | null;
  };
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
    // Lot E (M14) — une fin de collaboration (version de session changée) éteint le
    // lien ; l'envoi du dossier (`accesVersion`) ne le touche pas.
    ...(trainer.finCollaborationAt !== undefined
      ? { version: versionSessionFormateur({ finCollaborationAt: trainer.finCollaborationAt }) }
      : {}),
  });
  const lieu = formatLieu({
    ...session,
    lieuType: session.lieuType as "sur_site" | "nos_locaux" | "distanciel" | null,
  });
  // Lot L11b-ux — variante chiffrée de F23 (montant avant « J'accepte »), seulement
  // si elle est validée par Will ; sinon l'ancien texte part, inchangé.
  const chiffree = await champsF23Honoraires(args.missionId);
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
      // M24 — la variante chiffrée salue au prénom (gabarit commun des formateurs).
      ...(chiffree !== null ? { ...chiffree, prenom: trainer.prenom } : {}),
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
 * Statuts qu'une mission peut porter tant qu'elle TIENT LA PLACE : celle qu'on
 * attend, et celle qui a dit oui. Ce sont les deux que l'organisme doit reprendre
 * quand il écarte le formateur — cf. {@link retirerMissionsOuvertes}.
 */
const STATUTS_MISSION_OUVERTE = ["en_attente", "acceptee"] as const;

/**
 * 🔴 N2 (lot S2) — l'accord HORS OUTIL tient aussi la place. Sans lui dans la
 * liste, le remplacement d'un formateur dont l'accord avait été noté au
 * téléphone laissait sa mission `accord_hors_outil` vivante : une mission
 * fantôme, que les trois règles d'alerte lisent comme « quelqu'un tient la
 * place ». Interrupteur `formateurs.affectation_sure` arrêté : la liste d'avant.
 */
export function statutsMissionOuverte(
  affectationSure: boolean,
): ReadonlyArray<MissionFormateurStatut> {
  return affectationSure ? ["en_attente", ...STATUTS_ACCORD_DONNE] : STATUTS_MISSION_OUVERTE;
}

/**
 * Reprend les sollicitations encore OUVERTES d'une session — quand l'organisme
 * retire le formateur ou en affecte un autre. Sans cela, le formateur écarté
 * pourrait encore « accepter » une session qui n'est plus la sienne, et
 * l'alerte « sans réponse » continuerait de le réclamer.
 *
 * 🔴 D1 (2026-09-05) — ELLE NE REPRENAIT QUE LES `en_attente`, ET C'EST LE CAS
 * `acceptee` QUI FAISAIT LE TROU.
 *
 * Cette fonction s'appelait `retirerMissionsEnAttente`, et son `where` portait
 * `statut: "en_attente"`. Or le remplacement d'un formateur SUPPRIME sa ligne
 * `SessionFormateur` (`assignTrainerToSessionAction`) sans toucher à sa
 * mission : celle d'un formateur qui avait DÉJÀ accepté restait `acceptee`,
 * pour toujours, alors que son affectation venait de disparaître.
 *
 * Séquence, entièrement dans le code : A accepte → l'organisme affecte B → la
 * mission fantôme de A affirme que la place est tenue → B ne répond jamais.
 * Trois règles d'alerte s'en servent comme preuve que quelqu'un tient la place
 * (`regleMissionFormateurSansReponseDelai` et `regleMissionFormateurExpiree`
 * font `missionsFormateur: { where: { statut: "acceptee" } }` puis `continue` ;
 * `regleFormateurDesisteSession` teste
 * `some((m) => m.trainerId !== desistantId)`). **Les trois se taisaient**, et
 * la session pouvait démarrer sans personne, en silence. C'est le cas le plus
 * COURANT du désistement.
 *
 * `retiree` est le bon statut, et pas un statut neuf : le libellé de l'énum dit
 * « Retirée par l'organisme », ce qui est exactement ce qui vient de se passer.
 * Le catalogue d'alertes motive de ne lever AUCUNE alerte dessus — un
 * remplacement délibéré n'est pas un incident ; l'incident, s'il y en a un, est
 * consigné à part.
 *
 * ⚠️ Renommée `retirerMissionsEnAttente` → `retirerMissionsOuvertes` : le nom
 * disait le `where`, et c'est le `where` qui était faux. Un nom qui ment sur ce
 * qu'une fonction reprend est ce qui a permis à quatre règles de la lire comme
 * exhaustive.
 */
export async function retirerMissionsOuvertes(
  sessionId: string,
  opts: { saufTrainerId?: string | null; role?: SessionFormateurRole } = {},
): Promise<number> {
  const statuts = statutsMissionOuverte(await interrupteurAllume("affectation_sure"));
  return retirerMissions(
    {
      sessionId,
      statut: { in: [...statuts] },
      ...(opts.role !== undefined ? { role: opts.role } : {}),
      ...(opts.saufTrainerId ? { trainerId: { not: opts.saufTrainerId } } : {}),
    },
    `session ${sessionId}`,
  );
}

/** Le geste commun : passer en `retiree`, fail-soft (0 si la base refuse). */
async function retirerMissions(
  where: Prisma.MissionFormateurWhereInput,
  contexte: string,
): Promise<number> {
  if (isStub()) return 0;
  try {
    const r = await prisma.missionFormateur.updateMany({ where, data: { statut: "retiree" } });
    return r.count;
  } catch (err) {
    console.error(
      `[mission-formateur] retrait des sollicitations impossible (${contexte}):`,
      err instanceof Error ? err.message : String(err),
    );
    return 0;
  }
}

/**
 * Reprend les sollicitations encore EN ATTENTE d'un formateur qu'on DÉSACTIVE,
 * toutes sessions confondues (lot S1, ADR 0066).
 *
 * Même geste que {@link retirerMissionsOuvertes}, même statut d'arrivée
 * (`retiree`, « Retirée par l'organisme ») — mais côté FORMATEUR, et sur les
 * seules missions `en_attente`. Un formateur désactivé ne doit plus pouvoir
 * « accepter » une proposition restée ouverte.
 *
 * ⚠️ Les missions ACCEPTÉES ne sont pas touchées, à dessein : le formateur
 * tient la place, et c'est l'alerte `formateur_desactive_encore_affecte` qui
 * le signale à l'organisme. Les retirer ici ferait taire cette alerte.
 */
export async function retirerSollicitationsDuFormateur(trainerId: string): Promise<number> {
  return retirerMissions({ trainerId, statut: "en_attente" }, `formateur ${trainerId}`);
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
      trainer: {
        select: { id: true, email: true, prenom: true, nom: true, finCollaborationAt: true },
      },
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
      solliciteAt: true,
      session: { select: { formateurPrincipalId: true } },
      trainer: {
        select: { statut: true, organismeSousTraitantId: true, prenom: true, email: true },
      },
    },
  });

  let n = 0;
  for (const m of echues) {
    try {
      // 🔴 D6 — on LIT ce que la ligne porte avant de la supprimer. Après la
      // transaction il n'y aurait plus rien à lire, et c'est précisément le
      // défaut : le tarif snapshoté et les envois déjà faits partaient avec.
      const snapshot = await lireAffectationsAvantRetrait({
        sessionId: m.sessionId,
        trainerId: m.trainerId,
      });
      const bascule = await prisma.$transaction(async (tx) => {
        // Écriture CONDITIONNELLE : le formateur a pu répondre depuis la
        // lecture. Sa réponse n'est jamais écrasée, son affectation reste.
        const ecrite = await tx.missionFormateur.updateMany({
          where: { id: m.id, statut: "en_attente" },
          data: { statut: "sans_reponse" },
        });
        if (ecrite.count === 0) return false;
        if (m.session.formateurPrincipalId === m.trainerId) {
          await tx.trainingSession.update({
            where: { id: m.sessionId },
            data: { formateurPrincipalId: null },
          });
        }
        await tx.sessionFormateur.deleteMany({
          where: { sessionId: m.sessionId, trainerId: m.trainerId },
        });
        return true;
      });
      if (!bascule) continue;
      // Archive APRÈS le succès : une archive qui ment sur un retrait qui n'a
      // pas eu lieu serait pire que pas d'archive du tout.
      await archiverAffectationsRetirees(snapshot, {
        motif: "sans_reponse_delai",
        // Chemin du cron : aucun humain ne pose ce retrait.
        retireById: null,
        now,
      });
      // Lot L11c — F24 à l'indépendant (interrupteur `formateurs.lettre_auto`).
      if (m.trainer !== undefined && m.trainer !== null) await notifierPropositionClose(m);
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
/** L'unique réponse « introuvable » : proposition inconnue ou adressée à un autre. */
const MISSION_INTROUVABLE = "Cette proposition n'existe pas.";

/**
 * Lot S2 (T6) — réponse NEUTRE quand l'acceptation ne peut plus être reçue
 * (fiche désactivée entre la proposition et le clic). Elle ne dit pas pourquoi :
 * la raison est interne. Rien n'est écrit : la mission reste `en_attente`
 * jusqu'à son retrait, et l'alerte `formateur_desactive_encore_affecte` la
 * signale à l'organisme tant que l'affectation existe.
 */
export const PROPOSITION_SUSPENDUE =
  "Cette proposition est suspendue. Nous revenons vers vous rapidement.";

/** Lot S2 (T6) — la proposition a changé ENTRE la lecture et l'écriture (retrait, réponse croisée). */
export const PROPOSITION_CHANGEE =
  "Cette proposition vient de changer. Rechargez la page pour voir son état.";

/** Levée DANS la transaction pour l'annuler quand l'écriture conditionnelle n'a rien trouvé. */
class PropositionChangee extends Error {}

/** Motif d'un refus libre : ce qui a été écrit ou choisi, nettoyé, ou `null`. */
export function normaliserMotifLibre(motif: string | undefined): string | null {
  const m = (motif ?? "").trim();
  return m.length > 0 ? m : null;
}

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
      // Lot S2 — relus seulement interrupteur allumé (acceptation recontrôlée,
      // refus libre de l'indépendant).
      trainer: { select: { actif: true, statut: true } },
    },
  });
  // La proposition d'un AUTRE formateur répond exactement comme une proposition
  // inconnue : un identifiant ne doit rien apprendre à qui ne le possède pas.
  if (mission === null) return { ok: false, erreur: MISSION_INTROUVABLE };
  if (input.trainerId !== undefined && input.trainerId !== mission.trainerId) {
    return { ok: false, erreur: MISSION_INTROUVABLE };
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

  // Lot S2 — interrupteur `formateurs.affectation_sure`. Arrêté : tout ce qui
  // suit se comporte exactement comme avant S2.
  const affectationSure = await interrupteurAllume("affectation_sure");

  if (input.reponse === "acceptee") {
    // 🔴 L3 — la garde de mission est relue au « J'accepte » (interrupteur
    // `formateurs.garde_mission_portes` ; coupé : aucun effet). Réponse neutre :
    // la raison est interne.
    const garde = await controlerGardeMission(mission.trainerId, now);
    if (garde.refus.length > 0) {
      console.error(
        `[mission-formateur] acceptation suspendue par la garde de mission (mission ${mission.id}) : ${garde.refus.join(" ")}`,
      );
      return { ok: false, erreur: PROPOSITION_SUSPENDUE };
    }
    if (affectationSure) {
      // 🔴 T6 — l'acceptation ne recontrôlait rien. Une fiche désactivée entre
      // la proposition et le clic acceptait quand même.
      if (mission.trainer.actif !== true) {
        console.error(
          `[mission-formateur] acceptation suspendue (mission ${mission.id}) : fiche inactive`,
        );
        return { ok: false, erreur: PROPOSITION_SUSPENDUE };
      }
      // 🔴 T6 — écriture CONDITIONNELLE. Un retrait (remplacement, désactivation)
      // qui passe entre la lecture ci-dessus et cette ligne était écrasé :
      // `retiree` redevenait `acceptee`, sur une session qui n'était plus la sienne.
      const ecrit = await prisma.missionFormateur.updateMany({
        where: { id: mission.id, statut: "en_attente" },
        data: { statut: "acceptee", reponduAt: now },
      });
      if (ecrit.count !== 1) return { ok: false, erreur: PROPOSITION_CHANGEE };
    } else {
      await prisma.missionFormateur.update({
        where: { id: mission.id },
        data: { statut: "acceptee", reponduAt: now },
      });
    }
    return {
      ok: true,
      statut: "acceptee",
      sessionId: mission.sessionId,
      trainerId: mission.trainerId,
    };
  }

  // S-UX-6 — l'indépendant refuse sans motif exigé ; le salarié, comme avant.
  const refusLibre = affectationSure && refusSansMotifExige(mission.trainer.statut);
  const motif = refusLibre ? normaliserMotifLibre(input.motif) : normaliserMotifRefus(input.motif);
  if (motif === null && !refusLibre) {
    return {
      ok: false,
      erreur: `Indiquez le motif de votre refus (${MOTIF_REFUS_MIN} caractères au moins) : il nous aide à réaffecter la session.`,
    };
  }
  // 🔴 D6 — snapshot AVANT la suppression (cf. `affectation-retiree.ts`).
  const snapshot = await lireAffectationsAvantRetrait({
    sessionId: mission.sessionId,
    trainerId: mission.trainerId,
  });
  try {
    await prisma.$transaction(async (tx) => {
      if (affectationSure) {
        // T6 — même écriture conditionnelle que l'acceptation : un retrait passé
        // entre-temps annule tout, affectation comprise.
        const ecrit = await tx.missionFormateur.updateMany({
          where: { id: mission.id, statut: "en_attente" },
          data: { statut: "refusee", reponduAt: now, motifRefus: motif },
        });
        if (ecrit.count !== 1) throw new PropositionChangee();
      } else {
        await tx.missionFormateur.update({
          where: { id: mission.id },
          data: { statut: "refusee", reponduAt: now, motifRefus: motif },
        });
      }
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
  } catch (err) {
    if (err instanceof PropositionChangee) return { ok: false, erreur: PROPOSITION_CHANGEE };
    throw err;
  }
  await archiverAffectationsRetirees(snapshot, {
    motif: "refus_formateur",
    // Le retrait est posé par le FORMATEUR lui-même, pas par un compte admin :
    // `retireById` reste nul, et le motif de refus vit au journal des missions.
    retireById: null,
    now,
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
    /** Lot L11b-ux — la date limite, dite sur l'accueil « À faire ». */
    echeanceReponseAt: Date | null;
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
        echeanceReponseAt: true,
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
        trainer: { select: { id: true, prenom: true, nom: true, finCollaborationAt: true } },
        session: {
          select: {
            ...SESSION_POUR_MISSION,
            _count: { select: { enrollments: { where: { ...inscriptionsActives() } } } },
          },
        },
      },
    });
    if (m === null) return null;
    // Lot E (M14) — garde commune : collaboration close (jeton avec ou sans version) ou
    // version dépassée → le lien ne désigne plus rien.
    if (!ecritureFormateurPermise(verified.version, m.trainer)) return null;
    return {
      id: m.id,
      statut: m.statut,
      role: m.role,
      echeanceReponseAt: m.echeanceReponseAt,
      delaiDepasse:
        m.echeanceReponseAt !== null && m.echeanceReponseAt.getTime() <= new Date().getTime(),
      trainer: { id: m.trainer.id, prenom: m.trainer.prenom, nom: m.trainer.nom },
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
  /** Proposition ENCORE ouverte : le délai court, il peut répondre. */
  enAttente: number;
  /**
   * Délai DÉPASSÉ sans réponse, session libérée.
   *
   * 🔴 Ce champ portait auparavant le compte des propositions `en_attente` —
   * c'est-à-dire qu'il appelait « sans réponse » quelqu'un qui avait encore le
   * temps de répondre. Sur la fiche d'un sous-traitant, cette ligne sert à
   * décider d'une reconduction : compter un délai en cours comme un silence
   * fabrique un grief.
   */
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
  enAttente: 0,
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
    // ⚠️ `sans_reponse` DOIT figurer ici : c'est une sollicitation qui a bien
    // été faite. L'omettre ferait baisser le dénominateur et gonflerait
    // mécaniquement le taux d'acceptation de quelqu'un qui ne répond jamais.
    const proposees =
      n("en_attente") + n("acceptee") + n("refusee") + n("expiree") + n("sans_reponse");
    return {
      proposees,
      acceptees: n("acceptee"),
      refusees: n("refusee"),
      enAttente: n("en_attente"),
      sansReponse: n("sans_reponse"),
      expirees: n("expiree"),
      absences,
      derniersRefus,
    };
  } catch {
    return STATS_VIDES;
  }
}

/**
 * Lot S2 (R4) — ce que la console affiche d'un formateur INDÉPENDANT : les
 * missions acceptées (par le lien ou hors outil) et les missions réalisées.
 * Rien d'autre : un refus ou un silence est un droit du sous-traitant, il
 * n'entre dans aucun chiffre (T20). Ne lit ni `refusee`, ni `sans_reponse`, ni
 * `desistee`, ni `expiree`.
 */
export interface MissionsVisiblesIndependant {
  acceptees: number;
  realisees: number;
}

export async function missionsVisiblesIndependant(
  trainerId: string,
  now: Date = new Date(),
): Promise<MissionsVisiblesIndependant> {
  if (isStub()) return { acceptees: 0, realisees: 0 };
  const depuis = new Date(now);
  depuis.setMonth(depuis.getMonth() - FENETRE_PILOTAGE_MOIS);
  try {
    const [acceptees, realisees] = await Promise.all([
      prisma.missionFormateur.count({
        where: {
          trainerId,
          statut: { in: [...STATUTS_ACCORD_DONNE] },
          solliciteAt: { gte: depuis },
        },
      }),
      prisma.sessionFormateur.count({
        where: { trainerId, session: { statut: "realisee", dateDebut: { gte: depuis } } },
      }),
    ]);
    return { acceptees, realisees };
  } catch {
    return { acceptees: 0, realisees: 0 };
  }
}

/** « 3 missions acceptées · 2 réalisées » — la seule ligne de la fiche d'un indépendant. */
export function libelleMissionsIndependant(m: MissionsVisiblesIndependant): string {
  const s = (n: number): string => (n > 1 ? "s" : "");
  return (
    `${m.acceptees} mission${s(m.acceptees)} acceptée${s(m.acceptees)} · ` +
    `${m.realisees} réalisée${s(m.realisees)}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Accord donné HORS de l'outil
// ─────────────────────────────────────────────────────────────────────────────

/** Longueur minimale du motif — c'est l'auditeur qui le lit, pas nous. */
export const MOTIF_ACCORD_HORS_OUTIL_MIN = 15;

export type ResultatAccordHorsOutil =
  | { readonly ok: true; readonly missionId: string }
  | { readonly ok: false; readonly erreur: string };

/**
 * Consigne un accord donné hors de l'outil sur la sollicitation d'une session.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI CE GESTE EXISTE — L'ALERTE LE RÉCLAMAIT SANS L'OFFRIR
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Vécu en production le 2026-09-06 sur `AXI-SESS-2026-001`. La proposition a
 * expiré sans réponse ; la session a pourtant été animée — la stagiaire a signé
 * son émargement le jour même. L'alerte critique `formateur_mission_expiree`
 * dit alors, mot pour mot :
 *
 *     « vérifiez que la session a bien été animée, et consignez un incident si
 *       elle ne l'a pas été »
 *
 * Deux branches. L'écran n'en offrait qu'UNE — « Déclarer une absence ». Le
 * bouton « Proposer à nouveau » est conditionné à `sessionAVenir`
 * (`MissionFormateurPanel`), donc absent dès que la session a démarré. La
 * branche « elle a bien été animée » n'avait **aucun geste**, et l'alerte est
 * `resolutionAuto` : elle ne pouvait plus s'éteindre.
 *
 * Une alerte critique inextinguible n'apprend qu'une chose à celui qui la lit :
 * à ignorer les critiques. C'est exactement ce que le catalogue redoute.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ POURQUOI PAS `acceptee`
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `acceptee` signifie « le formateur a répondu par son lien » : la ligne porte
 * alors la trace horodatée de SON geste. L'écrire pour un accord recueilli au
 * téléphone **fabriquerait** cette trace.
 *
 * Le dépôt refuse déjà la symétrie inverse, et pour la même raison — le
 * commentaire de `sans_reponse` dit « un silence n'est pas un refus », parce
 * qu'inscrire un refus que personne n'a formulé salirait la pièce de pilotage.
 * Un accord que personne n'a cliqué la salirait autant.
 *
 * L'accord EXISTE ; c'est sa preuve qui est ailleurs. On la consigne pour ce
 * qu'elle est : l'organisme atteste, se nomme, se date, se justifie.
 *
 * ⚠️ Le motif est OBLIGATOIRE. Sans auteur ni motif, ce n'est pas une preuve,
 * c'est une affirmation — même exigence que sur l'annulation d'une pièce.
 */
export async function consignerAccordHorsOutil(input: {
  sessionId: string;
  trainerId: string;
  motif: string;
  parAdminId: string;
}): Promise<ResultatAccordHorsOutil> {
  if (isStub()) return { ok: false, erreur: "Indisponible en mode build (stub)" };

  const motif = input.motif.trim();
  if (motif.length < MOTIF_ACCORD_HORS_OUTIL_MIN) {
    return {
      ok: false,
      erreur:
        `Le motif doit faire au moins ${MOTIF_ACCORD_HORS_OUTIL_MIN} caractères : ` +
        "c'est lui que l'auditeur lira pour savoir d'où vient cet accord.",
    };
  }

  const mission = await prisma.missionFormateur.findFirst({
    where: { sessionId: input.sessionId, trainerId: input.trainerId },
    orderBy: { solliciteAt: "desc" },
    select: { id: true, statut: true },
  });
  if (mission === null) {
    return {
      ok: false,
      erreur:
        "Aucune sollicitation pour ce formateur sur cette session : il n'y a pas " +
        "d'accord à consigner. Proposez-lui la mission d'abord.",
    };
  }
  // Une mission qui a DÉJÀ une réponse ne se réécrit pas : ni un refus, ni une
  // acceptation, ni un retrait délibéré. Consigner par-dessus effacerait le
  // geste de quelqu'un — c'est la trace qu'on vient protéger.
  if (mission.statut === "acceptee") {
    return { ok: false, erreur: "Le formateur a déjà accepté cette mission par son lien." };
  }
  if (mission.statut === "accord_hors_outil") {
    return { ok: false, erreur: "L'accord a déjà été consigné pour cette mission." };
  }
  if (mission.statut === "refusee" || mission.statut === "retiree") {
    return {
      ok: false,
      erreur:
        "Cette mission porte déjà une décision (refus ou retrait). Consigner un " +
        "accord par-dessus effacerait cette trace.",
    };
  }

  // 🔴 L3 — garde de mission (interrupteur `formateurs.garde_mission_portes` ;
  // coupé : aucun effet). Un accord ne se note pas pour qui ne peut pas recevoir
  // de mission.
  const garde = await controlerGardeMission(input.trainerId);
  if (garde.refus.length > 0) {
    return { ok: false, erreur: `Accord non consigné : ${garde.refus.join(" ")}` };
  }

  // Lot S2 — interrupteur `formateurs.affectation_sure`. Arrêté : comme avant.
  const affectationSure = await interrupteurAllume("affectation_sure");
  if (affectationSure) {
    // 🔴 N3 / T6 — un `sans_reponse` (ou un retrait) a SUPPRIMÉ l'affectation.
    // Noter l'accord par-dessus disait « d'accord » pour quelqu'un qui n'est
    // plus sur la session : la place paraissait tenue, personne ne la tenait.
    // On réaffecte d'abord (la porte d'affectation et ses contrôles), puis on
    // note l'accord sur la nouvelle proposition.
    let affecte: { id: string } | null;
    try {
      affecte = await prisma.sessionFormateur.findUnique({
        where: { sessionId_trainerId: { sessionId: input.sessionId, trainerId: input.trainerId } },
        select: { id: true },
      });
    } catch {
      return { ok: false, erreur: "Erreur lors de la lecture de l'affectation." };
    }
    if (affecte === null) {
      return {
        ok: false,
        erreur:
          "Ce formateur n'est plus affecté à cette session. Réaffectez-le d'abord " +
          "(l'affectation repasse par ses contrôles), puis notez son accord.",
      };
    }
  }

  try {
    const donnees = {
      statut: "accord_hors_outil",
      accordHorsOutilAt: new Date(),
      accordHorsOutilParId: input.parAdminId,
      accordHorsOutilMotif: motif,
    } as const;
    if (affectationSure) {
      // Écriture conditionnelle, en UNE requête : ni une réponse du formateur
      // ni un retrait de l'affectation arrivés entre la lecture et l'écriture
      // ne sont écrasés.
      const ecrit = await prisma.missionFormateur.updateMany({
        where: {
          id: mission.id,
          statut: mission.statut,
          session: { sessionFormateurs: { some: { trainerId: input.trainerId } } },
        },
        data: donnees,
      });
      if (ecrit.count !== 1) return { ok: false, erreur: PROPOSITION_CHANGEE };
    } else {
      await prisma.missionFormateur.update({ where: { id: mission.id }, data: donnees });
    }
  } catch (err) {
    console.error(
      `[mission-formateur] accord hors outil impossible (mission ${mission.id}):`,
      err instanceof Error ? err.message : String(err),
    );
    return { ok: false, erreur: "Erreur lors de l'enregistrement de l'accord." };
  }

  return { ok: true, missionId: mission.id };
}
