// Lectures du suivi des rendez-vous (2026-09-27). Read-only, appelées depuis
// les RSC — l'appelant a déjà passé `gardeLectureAppels`.
//
// Build-safety (ADR 0026) : au build, `prisma` est un Proxy stub qui renvoie
// [] / null → ces fonctions rendent vide sans connexion DB.

import { prisma } from "@/lib/prisma";
import { dayKeyInParis } from "@/lib/calendar-grid";
import { typeEffectif } from "@/server/calendly/type-effectif";
import type { TypeRendezVous } from "@/server/calendly/type-rendez-vous";
import { passeLeFiltre } from "./type-rdv";
import { entrepriseEtBesoin, reponsesFormulaire } from "./a-venir";
import { finEffective, momentVisio } from "./visio";
import { joursDeRetard } from "./point";
import { aEuLieu, estDuMoisDuBilan, fenetreDuBilan } from "./rendez-vous-tenu";
import { JOURS_A_FAIRE_LE_POINT, type IssueRdv, type SuiteRdv } from "./suivi";
import type { PublicRdv } from "./types";
import type { DecisionApporteur } from "./issue-apporteur";

export interface RdvAFaireLePoint {
  id: string;
  titre: string;
  debut: Date;
  fin: Date | null;
  dayKey: string;
  contactName: string | null;
  contactEmail: string | null;
  entreprise: string | null;
  /** Type du rendez-vous (lot L3) : colonne, sinon nom (`typeEffectif`). */
  typeRendezVous: TypeRendezVous;
  /**
   * Jours écoulés depuis la fin quand le point attend depuis plus de 24 h,
   * sinon `null` (2026-09-28). La carte passe alors au rouge.
   */
  retardJours: number | null;
}

/**
 * Les rendez-vous passés sur lesquels personne n'a encore fait le point.
 *
 * Un rendez-vous y arrive quand il quitte « À venir » (30 min après sa fin),
 * et en sort dès que le point est enregistré. Les annulés n'y figurent pas :
 * il n'y a rien à constater sur un appel qui n'a pas été maintenu.
 *
 * Ordre (2026-09-28) : les RETARDS d'abord (fin il y a plus de 24 h), du plus
 * ancien au plus récent, puis les autres par date. Au-delà de 30 jours, un
 * rendez-vous sans point ne disparaît plus en silence : il est dans l'onglet
 * « Passés », marqué « Sans point ».
 */
export async function listRendezVousAFaireLePoint(
  options: { public?: PublicRdv; maintenant?: Date } = {},
): Promise<RdvAFaireLePoint[]> {
  const maintenant = options.maintenant ?? new Date();
  const lignes = await prisma.calendlyEvent.findMany({
    where: {
      status: "scheduled",
      suivi: null,
      startTime: {
        gte: new Date(maintenant.getTime() - JOURS_A_FAIRE_LE_POINT * 86_400_000),
        lte: maintenant,
      },
    },
    orderBy: { startTime: "asc" },
    take: 200,
    select: {
      id: true,
      eventTypeName: true,
      startTime: true,
      endTime: true,
      inviteeName: true,
      inviteeEmail: true,
      rawPayload: true,
      typeRendezVous: true,
    },
  });

  const liste = lignes.flatMap((e): RdvAFaireLePoint[] => {
    if (!e.startTime) return [];
    // Encore dans « À venir » : pas encore l'heure de faire le point.
    if (momentVisio(e.startTime, e.endTime, maintenant) !== "terminee") return [];
    const typeRendezVous = typeEffectif(e);
    if (!passeLeFiltre(typeRendezVous, options.public)) return [];
    return [
      {
        id: e.id,
        titre: e.eventTypeName,
        debut: e.startTime,
        fin: e.endTime,
        dayKey: dayKeyInParis(e.startTime),
        contactName: e.inviteeName,
        contactEmail: e.inviteeEmail,
        entreprise: entrepriseEtBesoin(reponsesFormulaire(e.rawPayload)).entreprise,
        typeRendezVous,
        retardJours: joursDeRetard(finEffective(e.startTime, e.endTime), maintenant),
      },
    ];
  });
  // Tri stable : la base a déjà rangé par début croissant — les retards
  // passent devant sans perdre cet ordre (le plus ancien d'abord).
  return liste.sort((a, b) => Number(b.retardJours !== null) - Number(a.retardJours !== null));
}

/**
 * Combien de rendez-vous attendent leur point — la pastille du lien
 * « Rendez-vous » de la barre latérale. Même règle que la liste, sans lire
 * la charge brute : ce compteur tourne à chaque affichage de la console.
 */
export async function compterRendezVousAFaireLePoint(
  maintenant: Date = new Date(),
): Promise<number> {
  const lignes = await prisma.calendlyEvent.findMany({
    where: {
      status: "scheduled",
      suivi: null,
      startTime: {
        gte: new Date(maintenant.getTime() - JOURS_A_FAIRE_LE_POINT * 86_400_000),
        lte: maintenant,
      },
    },
    select: { startTime: true, endTime: true },
    take: 200,
  });
  return lignes.filter(
    (e) => e.startTime && momentVisio(e.startTime, e.endTime, maintenant) === "terminee",
  ).length;
}

export interface BilanDuMois {
  euLieu: number;
  absents: number;
  reportes: number;
  /** Parmi les rendez-vous tenus, ceux dont la suite est un devis. */
  devis: number;
}

/**
 * Le bilan du mois en cours (heure de Paris), compté sur la date du
 * RENDEZ-VOUS et pas sur celle de la saisie : un appel du 30 dont on fait le
 * point le 2 appartient au mois où il a eu lieu.
 */
export async function bilanDuMois(maintenant: Date = new Date()): Promise<BilanDuMois> {
  // La règle « tenu ce mois-ci » est celle de `rendez-vous-tenu.ts`, partagée
  // avec la couverture du circuit (« Visios tenues ») : correction A3.
  const suivis = await prisma.rendezVousSuivi.findMany({
    where: { calendlyEvent: { startTime: fenetreDuBilan(maintenant) } },
    select: { issue: true, suite: true, calendlyEvent: { select: { startTime: true } } },
  });
  const bilan: BilanDuMois = { euLieu: 0, absents: 0, reportes: 0, devis: 0 };
  for (const s of suivis) {
    if (!estDuMoisDuBilan(s.calendlyEvent.startTime, maintenant)) continue;
    if (aEuLieu(s.issue)) bilan.euLieu += 1;
    if (s.issue === "absent") bilan.absents += 1;
    if (s.issue === "reporte") bilan.reportes += 1;
    if (aEuLieu(s.issue) && s.suite === "devis") bilan.devis += 1;
  }
  return bilan;
}

export interface SuiviEnregistre {
  issue: IssueRdv;
  suite: SuiteRdv | null;
  /** « AAAA-MM-JJ » — prêt pour un `<input type="date">`. */
  suiteLe: string | null;
  note: string | null;
  /** Échange apporteur tenu : la décision (2026-09-28), sinon `null`. */
  decision: DecisionApporteur | null;
  noteSur20: number | null;
  renseignePar: string | null;
  renseigneLe: Date;
}

/** Le point déjà fait sur un rendez-vous, ou `null`. */
export async function lireSuivi(calendlyEventId: string): Promise<SuiviEnregistre | null> {
  const s = await prisma.rendezVousSuivi.findUnique({ where: { calendlyEventId } });
  if (!s) return null;
  return {
    issue: s.issue,
    suite: s.suite,
    suiteLe: s.suiteLe ? s.suiteLe.toISOString().slice(0, 10) : null,
    note: s.note,
    decision: s.decision,
    noteSur20: s.noteSur20,
    renseignePar: s.renseignePar,
    renseigneLe: s.renseigneLe,
  };
}

/** Le point d'un échange APPORTEUR, prêt pour la fiche du candidat (2026-09-28). */
export interface PointApporteurEnregistre {
  issue: IssueRdv;
  decision: DecisionApporteur | null;
  noteSur20: number | null;
  /** La phrase de justification de la note. */
  note: string | null;
  /** « À revoir » : date de rappel « AAAA-MM-JJ », ou `null`. */
  rappelLe: string | null;
  renseigneLe: Date;
}

/** Les points déjà faits sur ces rendez-vous, clé = identifiant du rendez-vous. */
export async function lirePointsApporteur(
  calendlyEventIds: readonly string[],
): Promise<Map<string, PointApporteurEnregistre>> {
  const resultat = new Map<string, PointApporteurEnregistre>();
  if (calendlyEventIds.length === 0) return resultat;
  const lignes = await prisma.rendezVousSuivi.findMany({
    where: { calendlyEventId: { in: [...calendlyEventIds] } },
    select: {
      calendlyEventId: true,
      issue: true,
      decision: true,
      noteSur20: true,
      note: true,
      suiteLe: true,
      renseigneLe: true,
    },
  });
  for (const s of lignes) {
    resultat.set(s.calendlyEventId, {
      issue: s.issue,
      decision: s.decision,
      noteSur20: s.noteSur20,
      note: s.note,
      rappelLe:
        s.decision === "a_revoir" && s.suiteLe ? s.suiteLe.toISOString().slice(0, 10) : null,
      renseigneLe: s.renseigneLe,
    });
  }
  return resultat;
}
