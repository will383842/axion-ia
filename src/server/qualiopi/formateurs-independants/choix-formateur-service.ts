/**
 * Choisir le formateur d'une session, proposer le choix suivant, se désister
 * (lots L11b, L11b-ux et L11h, ADR 0066) — lectures et écritures.
 *
 * Deux interrupteurs, chacun ABSENT = comportement d'avant EXACTEMENT :
 *   - `formateurs.choix_cartes` : les cartes et le choix enregistré (L11b) ;
 *     coupé, aucune ligne `ChoixFormateurSession` n'est jamais écrite ;
 *   - `formateurs.rang_suivant` : le rang suivant proposé seul, et le
 *     désistement depuis l'espace (L11h) ; coupé, rien ne se propose seul.
 *
 * 🔑 Une personne de l'équipe choisit, toujours. Le moteur du rang suivant ne
 * choisit rien : il propose, dans l'ordre arrêté par elle, le choix suivant
 * quand le précédent ne tient plus (refus, silence, désistement), et saute un
 * rang devenu inéligible (journal + alerte). Jamais deux propositions
 * vivantes sur la même place : la place se prend par une écriture
 * conditionnelle (`formateurPrincipalId` encore vide).
 *
 * 🔴 Aucun nom, aucun motif, aucune adresse dans les journaux ni dans les
 * alertes Telegram : identifiants, numéro de session, codes de raison.
 *
 * Module NEUTRE (Prisma seulement) : le worker le charge.
 */

import { FENETRE_ENVOI_PAR_DEFAUT, dansFenetreEnvoi } from "@/lib/relances/campagne";
import { sendTelegram } from "@/lib/telegram";
import { chargerEtatVerrou } from "@/server/qualiopi/sessions/verrou-dossier";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import {
  archiverAffectationsRetirees,
  lireAffectationsAvantRetrait,
} from "@/server/qualiopi/trainers/affectation-retiree";
import {
  LIBELLE_STATUT_MISSION,
  STATUTS_ACCORD_DONNE,
  proposerMissionFormateur,
} from "@/server/qualiopi/trainers/mission-formateur";
import type { MissionFormateurStatut } from "../../../../prisma/generated/client";

import {
  LIBELLE_RANG,
  chaineOuverte,
  choixRestants,
  rangConsomme,
  estRang,
  nomCourt,
  proximite,
  trierCartes,
  type CarteFormateur,
  type ChoixFige,
  type LieuChoix,
  type SollicitationPassee,
  type Rang,
} from "./choix-formateur";
import { sessionPayeeParMission } from "./conditions-figees";
import { departementDeCodePostal } from "./departement-region";
import { envoyer } from "./envois";
import { evaluerAffectation, type SessionAEvaluer } from "./evaluer-affectation";
import { controlerGardeMission } from "./garde-mission-portes";
import { interrupteurAllume } from "./interrupteur-allume";

const isStub = (): boolean => process.env.DATABASE_URL?.includes("stub.invalid") ?? false;

/** Lien de la fiche session en console — jamais le nom de quiconque. */
function lienFicheSession(sessionId: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const prefixe = process.env.ADMIN_URL_PREFIX ?? "admin";
  const chemin = `/fr/${prefixe}/qualiopi/sessions/${sessionId}#formateur`;
  return site ? `${site}${chemin}` : `(console ${chemin})`;
}

async function alerter(body: string): Promise<void> {
  try {
    await sendTelegram({ tag: "AUTO", body });
  } catch {
    // Une alerte manquée ne défait jamais l'acte.
  }
}

/** Les missions de la session, telles que le rang suivant les lit. */
function sollicitationsDe(
  missions: ReadonlyArray<{ trainerId: string; statut: MissionFormateurStatut; updatedAt: Date }>,
): SollicitationPassee[] {
  const vivants = statutsPlaceTenue();
  return missions.map((m) => ({
    trainerId: m.trainerId,
    faitLe: m.updatedAt,
    vivante: vivants.includes(m.statut),
  }));
}

const SESSION_SELECT = {
  id: true,
  numero: true,
  titreSession: true,
  formationId: true,
  dateDebut: true,
  dateFin: true,
  statut: true,
  lieuType: true,
  lieuCodePostal: true,
  modalite: true,
  formateurPrincipalId: true,
} as const;

function lieuDe(s: {
  lieuType: string | null;
  lieuCodePostal: string | null;
  modalite: string;
}): LieuChoix {
  return {
    distanciel: s.lieuType === "distanciel" || (s.lieuType === null && s.modalite === "distanciel"),
    codePostal: s.lieuCodePostal,
  };
}

function aEvaluer(s: {
  id: string;
  formationId: string;
  dateDebut: Date;
  dateFin: Date | null;
  statut: string;
}): SessionAEvaluer {
  return {
    id: s.id,
    formationId: s.formationId,
    dateDebut: s.dateDebut,
    dateFin: s.dateFin,
    statut: s.statut,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lire les cartes (L11b)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChoixActuel {
  readonly rang: Rang;
  readonly trainerId: string;
  readonly nomCourt: string;
  readonly forfaitDeplacementParJourHtCents: number | null;
  /** Où en est ce rang : « en attente de son tour », statut de sa mission, ou « sauté ». */
  readonly etat: string;
}

export interface CartesChoix {
  readonly lieu: LieuChoix;
  /** Session planifiée et à venir : on peut (re)choisir. */
  readonly ouverte: boolean;
  readonly disponibles: ReadonlyArray<CarteFormateur>;
  readonly indisponibles: ReadonlyArray<CarteFormateur>;
  readonly choixActuels: ReadonlyArray<ChoixActuel>;
}

/** Les cartes d'une session, évaluées par la même fonction que la garde (T3). */
export async function lireCartesChoix(
  sessionId: string,
  maintenant: Date,
): Promise<CartesChoix | null> {
  if (isStub()) return null;
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: SESSION_SELECT,
  });
  if (session === null) return null;
  const lieu = lieuDe(session);
  const [trainers, choix, missions] = await Promise.all([
    prisma.trainer.findMany({
      where: { actif: true },
      select: {
        id: true,
        prenom: true,
        nom: true,
        statut: true,
        codePostalPro: true,
        regimeTvaHonoraires: true,
      },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    }),
    prisma.choixFormateurSession.findMany({
      where: { sessionId, rang: { lte: 3 } },
      orderBy: { rang: "asc" },
      select: {
        rang: true,
        trainerId: true,
        forfaitDeplacementParJourHtCents: true,
        sauteAt: true,
        updatedAt: true,
        trainer: { select: { prenom: true, nom: true } },
      },
    }),
    prisma.missionFormateur.findMany({
      where: { sessionId },
      orderBy: { updatedAt: "desc" },
      select: { trainerId: true, statut: true, updatedAt: true },
    }),
  ]);
  const cartes: CarteFormateur[] = await Promise.all(
    trainers.map(async (t) => {
      const ev = await evaluerAffectation(t.id, aEvaluer(session), maintenant);
      return {
        trainerId: t.id,
        nomCourt: nomCourt(t.prenom, t.nom),
        independant: t.statut === "sous_traitant",
        regimeTva: t.regimeTvaHonoraires,
        departement: departementDeCodePostal(t.codePostalPro),
        proximite: proximite(lieu, t.codePostalPro),
        refus: ev.refus,
        avertissements: ev.avertissements,
      };
    }),
  );
  const { disponibles, indisponibles } = trierCartes(cartes);
  const choixActuels: ChoixActuel[] = choix
    .filter((c) => estRang(c.rang))
    .map((c) => {
      const siennes = missions.filter((m) => m.trainerId === c.trainerId);
      const consomme = rangConsomme(
        { trainerId: c.trainerId, choisiLe: c.updatedAt },
        sollicitationsDe(siennes),
      );
      const derniere = siennes[0];
      const etat =
        consomme && derniere !== undefined
          ? LIBELLE_STATUT_MISSION[derniere.statut].toLowerCase()
          : c.sauteAt !== null
            ? "sauté : ne peut plus recevoir cette mission"
            : "en attente de son tour";
      return {
        rang: c.rang as Rang,
        trainerId: c.trainerId,
        nomCourt: nomCourt(c.trainer.prenom, c.trainer.nom),
        forfaitDeplacementParJourHtCents: c.forfaitDeplacementParJourHtCents,
        etat,
      };
    });
  return {
    lieu,
    ouverte: session.statut === "planifiee" && session.dateDebut.getTime() > maintenant.getTime(),
    disponibles,
    indisponibles,
    choixActuels,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Enregistrer le choix (L11b) — rien ne s'efface
// ─────────────────────────────────────────────────────────────────────────────

/** Motif posé sur un ancien choix que le nouveau ne reprend pas. */
export const MOTIF_CHOIX_REMPLACE = "Choix remplacé par un nouveau choix";

/**
 * Écrit le choix (rangs 1 à 3) et ses conditions figées. Un nouveau choix
 * réécrit les rangs : la ligne d'un formateur repris est mise à jour (nouveau
 * tour), celle d'un formateur écarté est rangée au-delà du rang 3 et marquée
 * sautée — aucune ligne n'est supprimée. La preuve de ce qui a été proposé, et
 * à quel prix, vit dans `MissionFormateur` et au journal.
 */
export async function enregistrerChoix(
  sessionId: string,
  choix: ReadonlyArray<ChoixFige>,
  maintenant: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existants = await tx.choixFormateurSession.findMany({
      where: { sessionId },
      select: { id: true, trainerId: true, rang: true, sauteAt: true },
      orderBy: { rang: "asc" },
    });
    // 1. Écarter tous les rangs existants au-delà de 3, sans collision.
    const base = Math.max(3, ...existants.map((e) => e.rang));
    for (const [i, e] of existants.entries()) {
      await tx.choixFormateurSession.update({
        where: { id: e.id },
        data: { rang: base + 1 + i },
      });
    }
    // 2. Poser le nouveau choix.
    for (const c of choix) {
      const existant = existants.find((e) => e.trainerId === c.trainerId);
      const donnees = {
        rang: c.rang,
        tarifHtCents: c.tarifHtCents,
        forfaitDeplacementParJourHtCents: c.forfaitDeplacementParJourHtCents,
        regimeTvaFige: c.regimeTvaFige,
        sauteAt: null,
        sauteMotif: null,
      };
      if (existant !== undefined) {
        await tx.choixFormateurSession.update({ where: { id: existant.id }, data: donnees });
      } else {
        await tx.choixFormateurSession.create({
          data: { sessionId, trainerId: c.trainerId, ...donnees },
        });
      }
    }
    // 3. Les écartés restent, rangés et marqués.
    const repris = new Set(choix.map((c) => c.trainerId));
    for (const e of existants) {
      if (repris.has(e.trainerId) || e.sauteAt !== null) continue;
      await tx.choixFormateurSession.update({
        where: { id: e.id },
        data: { sauteAt: maintenant, sauteMotif: MOTIF_CHOIX_REMPLACE },
      });
    }
  });
}

/** Motif posé sur le choix quand l'affectation du 1er choix a échoué. */
export const MOTIF_CHOIX_NON_RETENU = "Affectation du 1er choix impossible : choix non retenu";

/**
 * L'affectation du 1er choix a échoué : le choix qui vient d'être écrit n'est
 * pas retenu. Ses rangs sont marqués sautés (rien ne s'efface), pour que le
 * passage du rang suivant ne les propose jamais. Ne lève jamais.
 */
export async function abandonnerChoix(sessionId: string, maintenant: Date): Promise<void> {
  try {
    await prisma.choixFormateurSession.updateMany({
      where: { sessionId, rang: { lte: 3 }, sauteAt: null },
      data: { sauteAt: maintenant, sauteMotif: MOTIF_CHOIX_NON_RETENU },
    });
  } catch (err) {
    console.error(
      `[choix-formateur] choix non marqué après un échec d'affectation (session ${sessionId}) :`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rang suivant (L11h, T15)
// ─────────────────────────────────────────────────────────────────────────────

export type CauseRangSuivant = "refus" | "sans_reponse" | "desistement" | "passage";

export type ResultatRangSuivant =
  | { readonly fait: "coupe" }
  | { readonly fait: "rien"; readonly raison: string }
  | {
      readonly fait: "propose";
      readonly rang: Rang;
      readonly trainerId: string;
      readonly proposee: boolean;
    }
  | { readonly fait: "a_pourvoir"; readonly sautes: number };

/**
 * Le rang suivant n'a de sens qu'avec le choix en cartes : il exige les DEUX
 * interrupteurs (sinon il proposerait d'anciens choix, sans conditions figées).
 */
async function rangSuivantOuvert(): Promise<boolean> {
  return (await interrupteurAllume("rang_suivant")) && (await interrupteurAllume("choix_cartes"));
}

/**
 * Motif posé sur les choix restants quand l'équipe a retiré ou remplacé le
 * formateur depuis la console : le rang suivant ne part pas contre son geste.
 */
export const MOTIF_CHAINE_ARRETEE = "Retrait ou remplacement par l'équipe";

/** Motif posé sur les choix restants quand tous ont été proposés. */
export const MOTIF_CHOIX_EPUISES = "Tous les choix ont été proposés";

/** Ce qui tient la place (lu à l'appel, jamais au chargement du module). */
function statutsPlaceTenue(): MissionFormateurStatut[] {
  return ["en_attente", ...STATUTS_ACCORD_DONNE];
}

/**
 * Propose la mission au choix suivant de la session, s'il y a lieu. Ne lève
 * jamais. Interrupteur `formateurs.rang_suivant` coupé : ne fait rien.
 */
export async function proposerRangSuivant(
  sessionId: string,
  cause: CauseRangSuivant,
  maintenant: Date,
): Promise<ResultatRangSuivant> {
  if (isStub()) return { fait: "coupe" };
  if (!(await rangSuivantOuvert())) return { fait: "coupe" };
  try {
    const session = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: SESSION_SELECT,
    });
    if (session === null) return { fait: "rien", raison: "session introuvable" };
    if (session.statut !== "planifiee" || session.dateDebut.getTime() <= maintenant.getTime()) {
      return { fait: "rien", raison: "session close ou commencée" };
    }
    if (session.formateurPrincipalId !== null) return { fait: "rien", raison: "place tenue" };
    const [vivantes, choix, sollicitations] = await Promise.all([
      prisma.missionFormateur.count({
        where: { sessionId, role: "principal", statut: { in: statutsPlaceTenue() } },
      }),
      prisma.choixFormateurSession.findMany({
        where: { sessionId, rang: { lte: 3 } },
        select: { trainerId: true, rang: true, sauteAt: true, updatedAt: true },
      }),
      prisma.missionFormateur.findMany({
        where: { sessionId },
        select: { trainerId: true, statut: true, role: true, updatedAt: true },
      }),
    ]);
    // Jamais deux propositions vivantes sur la même place.
    if (vivantes > 0) return { fait: "rien", raison: "proposition vivante" };
    if (choix.length === 0) return { fait: "rien", raison: "aucun choix" };
    // La chaîne ne continue qu'après un refus, un silence ou un désistement d'un
    // formateur du choix. Un retrait ou un remplacement par l'équipe l'arrête :
    // le moteur ne va jamais contre le geste de l'équipe.
    const derniere = [...sollicitations]
      .filter((m) => m.role === "principal")
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    const vivantsDuChoix = choix.filter((c) => c.sauteAt === null);
    if (vivantsDuChoix.length > 0) {
      // Rien ne bouge avant que le 1er choix ait été proposé par l'action de choix.
      const choisiLe = Math.min(...vivantsDuChoix.map((c) => c.updatedAt.getTime()));
      if (derniere === undefined || derniere.updatedAt.getTime() < choisiLe) {
        return { fait: "rien", raison: "chaîne pas commencée" };
      }
      if (!chaineOuverte(derniere, new Set(choix.map((c) => c.trainerId)))) {
        // Les choix restants sont marqués : le passage ne les reprend plus (un
        // nouveau choix les rouvre). Rien ne s'efface.
        await prisma.choixFormateurSession.updateMany({
          where: { sessionId, rang: { lte: 3 }, sauteAt: null },
          data: { sauteAt: maintenant, sauteMotif: MOTIF_CHAINE_ARRETEE },
        });
        await journaliser(prisma, {
          action: "qualiopi.mission.chaine_arretee",
          targetType: "TrainingSession",
          targetId: sessionId,
          changes: { cause, statut: derniere.statut },
          session: null,
        });
        return { fait: "rien", raison: "chaîne arrêtée par l'équipe" };
      }
    }
    // Fenêtre d'envoi unique (8 h - 19 h, heure de Paris) : hors fenêtre, rien ne
    // part ; le passage planifié reprend la session à l'heure d'ouverture.
    if (!dansFenetreEnvoi(maintenant, FENETRE_ENVOI_PAR_DEFAUT)) {
      return { fait: "rien", raison: "hors fenêtre d'envoi" };
    }
    const restants = choixRestants(
      choix.map((c) => ({ ...c, choisiLe: c.updatedAt })),
      sollicitationsDe(sollicitations),
    );

    let sautes = 0;
    // Un rang sauté l'est toujours avec une trace : choix marqué, journal (codes
    // seulement), alerte sans nom.
    const sauter = async (
      trainerId: string,
      rang: Rang,
      codes: ReadonlyArray<string>,
      motif: string,
    ): Promise<void> => {
      await prisma.choixFormateurSession.updateMany({
        where: { sessionId, trainerId, sauteAt: null },
        data: { sauteAt: maintenant, sauteMotif: motif.slice(0, 500) },
      });
      sautes += 1;
      await journaliser(prisma, {
        action: "qualiopi.mission.rang_saute",
        targetType: "TrainingSession",
        targetId: sessionId,
        changes: { rang, cause, raisons: [...codes] },
        session: null,
      });
      await alerter(
        `🔁 Session ${session.numero} : le ${LIBELLE_RANG[rang]} ne peut plus recevoir la mission (${codes.join(
          ", ",
        )}), rang sauté. ${lienFicheSession(sessionId)}`,
      );
    };
    for (const c of restants) {
      const rang = c.rang as Rang;
      const ev = await evaluerAffectation(c.trainerId, aEvaluer(session), maintenant);
      if (ev.refus.length > 0) {
        await sauter(
          c.trainerId,
          rang,
          ev.refus.map((r) => r.code),
          ev.refus.map((r) => r.texte).join(" "),
        );
        continue;
      }
      // T4 — la garde de mission est relue au plus près de l'écriture
      // (l'évaluation ci-dessus l'a déjà lue ; une pièce a pu expirer entre-temps).
      const [garde, verrou, trainer] = await Promise.all([
        controlerGardeMission(c.trainerId, maintenant),
        chargerEtatVerrou(sessionId),
        prisma.trainer.findUnique({
          where: { id: c.trainerId },
          select: { tarifJourneeHtCents: true, statut: true },
        }),
      ]);
      if (verrou !== null && verrou.etat.etat === "clos") {
        return { fait: "rien", raison: "dossier clos" };
      }
      if (garde.refus.length > 0) {
        await sauter(c.trainerId, rang, ["garde"], garde.refus.join(" "));
        continue;
      }
      // ARGENT — un indépendant n'est proposé que si la session est réglée par
      // mission, aux conditions figées au choix : sinon le relevé mensuel
      // paierait un autre montant que celui annoncé.
      if (trainer?.statut === "sous_traitant" && !(await sessionPayeeParMission(sessionId))) {
        await sauter(
          c.trainerId,
          rang,
          ["releve_mensuel"],
          "Session réglée par le relevé mensuel : le montant figé au choix ne serait pas celui payé.",
        );
        continue;
      }
      // La place se prend par une écriture CONDITIONNELLE : si quelqu'un l'a
      // prise entre-temps (une affectation depuis la console), on s'arrête.
      const pris = await prisma.$transaction(async (tx) => {
        const r = await tx.trainingSession.updateMany({
          where: { id: sessionId, formateurPrincipalId: null },
          data: { formateurPrincipalId: c.trainerId },
        });
        if (r.count !== 1) return false;
        await tx.sessionFormateur.upsert({
          where: { sessionId_trainerId: { sessionId, trainerId: c.trainerId } },
          create: {
            sessionId,
            trainerId: c.trainerId,
            role: "principal",
            tarifHtCents: trainer?.tarifJourneeHtCents ?? null,
          },
          update: { role: "principal", tarifHtCents: trainer?.tarifJourneeHtCents ?? null },
        });
        return true;
      });
      if (!pris) return { fait: "rien", raison: "place prise entre-temps" };
      const p = await proposerMissionFormateur({
        sessionId,
        trainerId: c.trainerId,
        role: "principal",
        now: maintenant,
      });
      await journaliser(prisma, {
        action: "qualiopi.mission.rang_suivant",
        targetType: "TrainingSession",
        targetId: sessionId,
        changes: { rang, cause, trainerId: c.trainerId, proposee: p.proposee },
        session: null,
      });
      if (!p.proposee) {
        // La place est tenue mais la proposition n'est pas partie : on le dit,
        // sinon la session resterait bloquée en silence.
        await alerter(
          `⚠️ Session ${session.numero} : le ${LIBELLE_RANG[rang]} est affecté mais la proposition n'est pas partie. ${lienFicheSession(sessionId)}`,
        );
      }
      return { fait: "propose", rang, trainerId: c.trainerId, proposee: p.proposee };
    }
    // Plus personne : la session revient « à pourvoir ». On ne le dit qu'une
    // fois : quand un événement vient de libérer la place, ou quand ce passage
    // vient de sauter le dernier rang.
    // Les choix restants sont marqués épuisés : le passage planifié ne les
    // reprend plus (un nouveau choix les rouvre).
    if (choix.length > 0) {
      await prisma.choixFormateurSession.updateMany({
        where: { sessionId, rang: { lte: 3 }, sauteAt: null },
        data: { sauteAt: maintenant, sauteMotif: MOTIF_CHOIX_EPUISES },
      });
    }
    if (cause !== "passage" || sautes > 0) {
      await journaliser(prisma, {
        action: "qualiopi.mission.a_pourvoir",
        targetType: "TrainingSession",
        targetId: sessionId,
        changes: { cause, sautes },
        session: null,
      });
      await alerter(
        `📭 Session ${session.numero} : plus aucun choix disponible, formateur à choisir. ${lienFicheSession(sessionId)}`,
      );
    }
    return { fait: "a_pourvoir", sautes };
  } catch (err) {
    console.error(
      `[choix-formateur] rang suivant impossible (session ${sessionId}) :`,
      err instanceof Error ? err.message : String(err),
    );
    return { fait: "rien", raison: "erreur" };
  }
}

/** Au plus 30 sessions par passage (règle commune des passages planifiés). */
export const SESSIONS_PAR_PASSAGE = 30;

/**
 * Passage planifié : chaque session à venir sans formateur, dont un choix
 * reste à proposer. Interrupteur coupé : rien.
 */
export async function proposerRangsSuivants(maintenant: Date): Promise<{
  proposes: number;
  aPourvoir: number;
}> {
  const bilan = { proposes: 0, aPourvoir: 0 };
  if (isStub()) return bilan;
  if (!(await rangSuivantOuvert())) return bilan;
  let sessions: Array<{ id: string }>;
  try {
    sessions = await prisma.trainingSession.findMany({
      where: {
        statut: "planifiee",
        dateDebut: { gt: maintenant },
        formateurPrincipalId: null,
        choixFormateurs: { some: { rang: { lte: 3 }, sauteAt: null } },
      },
      select: { id: true },
      orderBy: { dateDebut: "asc" },
      take: SESSIONS_PAR_PASSAGE,
    });
  } catch {
    return bilan;
  }
  for (const s of sessions) {
    const r = await proposerRangSuivant(s.id, "passage", maintenant);
    if (r.fait === "propose") bilan.proposes += 1;
    if (r.fait === "a_pourvoir" && r.sautes > 0) bilan.aPourvoir += 1;
  }
  return bilan;
}

// ─────────────────────────────────────────────────────────────────────────────
// Désistement (L11h, T16)
// ─────────────────────────────────────────────────────────────────────────────

/** Motif système d'annulation de la lettre non signée d'un formateur désisté. */
export const MOTIF_LETTRE_DESISTEMENT = "Désistement du formateur";

const MISSION_INTROUVABLE = "Mission introuvable.";

export type ResultatDesistement =
  { readonly ok: true } | { readonly ok: false; readonly erreur: string };

class MissionChangee extends Error {}

function nettoyer(x: string | undefined, max: number): string | null {
  const t = (x ?? "").trim();
  return t === "" ? null : t.slice(0, max);
}

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/**
 * « Je ne peux plus assurer cette mission » (T16) : la mission passe en
 * `desistee`, l'affectation est retirée (archivée), la lettre NON signée est
 * annulée (une lettre signée est gardée), aucune pénalité (aucun incident
 * n'est consigné contre le formateur), F48 part si son texte est validé,
 * alerte I10, puis le choix suivant est proposé.
 *
 * Seulement pour une mission dont l'accord est donné, avant le début.
 */
export async function seDesister(input: {
  trainerId: string;
  missionId: string;
  motif?: string;
  remplacant?: string;
  maintenant: Date;
}): Promise<ResultatDesistement> {
  if (isStub()) return { ok: false, erreur: "Service indisponible." };
  if (!(await rangSuivantOuvert())) {
    return {
      ok: false,
      erreur: "Écrivez-nous pour nous prévenir : ce geste n'est pas encore ouvert.",
    };
  }
  const { maintenant } = input;
  const mission = await prisma.missionFormateur.findUnique({
    where: { id: input.missionId },
    select: {
      id: true,
      trainerId: true,
      sessionId: true,
      statut: true,
      session: {
        select: { numero: true, titreSession: true, dateDebut: true, statut: true },
      },
      trainer: { select: { prenom: true, email: true } },
    },
  });
  // La mission d'un AUTRE formateur répond comme une mission inconnue.
  if (mission === null || mission.trainerId !== input.trainerId) {
    return { ok: false, erreur: MISSION_INTROUVABLE };
  }
  if (!(STATUTS_ACCORD_DONNE as ReadonlyArray<MissionFormateurStatut>).includes(mission.statut)) {
    return { ok: false, erreur: "Cette mission ne vous est plus confiée : rien à faire." };
  }
  if (
    mission.session.statut !== "planifiee" ||
    mission.session.dateDebut.getTime() <= maintenant.getTime()
  ) {
    return {
      ok: false,
      erreur: "La formation a commencé : appelez-nous ou écrivez-nous pour nous prévenir.",
    };
  }
  const remplacant = nettoyer(input.remplacant, 500);
  const motif = nettoyer(
    [nettoyer(input.motif, 1400), remplacant === null ? null : `Remplaçant proposé : ${remplacant}`]
      .filter((x): x is string => x !== null)
      .join(" — "),
    2000,
  );

  const snapshot = await lireAffectationsAvantRetrait({
    sessionId: mission.sessionId,
    trainerId: mission.trainerId,
  });
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.missionFormateur.updateMany({
        where: {
          id: mission.id,
          trainerId: mission.trainerId,
          statut: { in: [...STATUTS_ACCORD_DONNE] },
        },
        data: { statut: "desistee", desisteAt: maintenant, desisteMotif: motif },
      });
      if (r.count !== 1) throw new MissionChangee();
      await tx.trainingSession.updateMany({
        where: { id: mission.sessionId, formateurPrincipalId: mission.trainerId },
        data: { formateurPrincipalId: null },
      });
      await tx.sessionFormateur.deleteMany({
        where: { sessionId: mission.sessionId, trainerId: mission.trainerId },
      });
      // La lettre NON signée par le formateur cesse de circuler ; une lettre
      // signée reste au registre (Will décide).
      await tx.documentGenere.updateMany({
        where: {
          type: "lettre_mission",
          sessionId: mission.sessionId,
          trainerId: mission.trainerId,
          annuleeAt: null,
          signatures: { none: { revokedAt: null, partie: "formateur" } },
        },
        data: {
          annuleeAt: maintenant,
          annuleeMotif: MOTIF_LETTRE_DESISTEMENT,
          annuleePar: "system",
        },
      });
    });
  } catch (err) {
    if (err instanceof MissionChangee) {
      return { ok: false, erreur: "Cette mission a changé entre-temps : rechargez la page." };
    }
    throw err;
  }
  await archiverAffectationsRetirees(snapshot, {
    motif: "desistement_formateur",
    retireById: null,
    now: maintenant,
  });
  await journaliser(prisma, {
    action: "qualiopi.mission.desistement",
    targetType: "MissionFormateur",
    targetId: mission.id,
    changes: { sessionId: mission.sessionId, avecRemplacant: remplacant !== null },
    session: null,
  });
  // F48 — part seulement si son texte est validé (l'adaptateur le vérifie).
  await envoyer({
    gabarit: "formateur-desistement-recu",
    destinataire: mission.trainer.email,
    entityType: "Trainer",
    entityId: mission.trainerId,
    jobId: `formateur-desistement-${mission.id}`,
    payload: {
      prenom: mission.trainer.prenom,
      etape: remplacant === null ? 1 : 2,
      valeurs: {
        intitulé: mission.session.titreSession,
        date: DATE_LONGUE.format(mission.session.dateDebut),
      },
    },
  });
  // I10 — immédiat, sans nom ni motif.
  await alerter(
    `⚠️ Désistement sur la session ${mission.session.numero}${
      remplacant !== null ? " (un remplaçant est proposé)" : ""
    }. ${lienFicheSession(mission.sessionId)}`,
  );
  await proposerRangSuivant(mission.sessionId, "desistement", maintenant);
  return { ok: true };
}
