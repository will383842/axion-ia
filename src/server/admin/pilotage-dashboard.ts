/**
 * Tableau de bord de PILOTAGE de la console admin (refonte console phase 3,
 * spec panel de juges — audit UX 2026-08-01).
 *
 * Ce module ASSEMBLE : il ne recalcule aucune règle métier. Chaque section du
 * dashboard lit sa source de vérité existante (pipeline dossiers, alertes,
 * marge, prévisionnel, planning, hub de signaux) et les seules requêtes Prisma
 * directes sont des comptages/agrégats simples, chacun enveloppé dans un
 * try/catch retombant sur des vides (stub-safe, ADR 0026 — au build GH Actions
 * `prisma` est un Proxy stub sans DB).
 *
 * Conventions verrouillées :
 *  - tous les montants restent en CENTIMES jusqu'à l'affichage ;
 *  - tout rattachement mois/période se fait en Europe/Paris via `derivePlage` /
 *    `moisDe` / `dayKeyInParis` — jamais getMonth() UTC ;
 *  - marge = sessions RÉALISÉES uniquement ; prévisionnel = planifié + réalisé.
 *    Les deux périmètres ne s'additionnent JAMAIS.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ActiviteFacturation } from "../../../prisma/generated/client";
import {
  lireDossiersPipeline,
  COLONNES_PIPELINE,
  TAKE_MAX,
  ACTIVITE_LABELS,
  type ActiviteDossier,
  type ColonnePipeline,
} from "@/server/admin/dossiers-pipeline";
import { ACTIVITE_LABELS as ACTIVITE_FACTURATION_LABELS } from "@/server/qualiopi/financements/facture-libre-pur";
import { listAlertes } from "@/server/qualiopi/alertes/alertes-service";
import {
  getConsolidationMensuelle,
  getMargeParFormation,
  getHeuresParFormateur,
  type HeuresFormateur,
  type MargeFormation,
} from "@/server/qualiopi/remuneration/marge";
import { derivePlage, periodeLabel } from "@/server/qualiopi/conformite/periode";
import { getPrevisionnel } from "@/server/qualiopi/previsionnel/queries";
import {
  ligneVide,
  moisDe,
  totaux,
  type LignePrevisionnel,
  type TotauxPrevisionnel,
} from "@/server/qualiopi/previsionnel/calcul";
import { getPlanningMonth, getPlanningRange } from "@/features/admin-planning/queries";
import { getHubSignaux } from "@/features/admin-planning/hub-queries";
import type { Signal } from "@/features/admin-planning/hub";
import { listIndisposEntre } from "@/server/qualiopi/trainers/availability-queries";
import { joursIndisponibles } from "@/server/qualiopi/trainers/availability";
import { listTrainers } from "@/server/qualiopi/trainers/trainers";
import { expandEventDayKeys } from "@/features/admin-planning/expand";
import { dayKeyInParis, dayKeyOfGridDate } from "@/lib/calendar-grid";
import type { PlanningEventType } from "@/features/admin-planning/types";

// ─────────────────────────────────────────────────────────────────────────────
// Période
// ─────────────────────────────────────────────────────────────────────────────

export type PeriodePilotage = "semaine" | "mois" | "annee";

export const PERIODES_PILOTAGE: ReadonlyArray<{ id: PeriodePilotage; label: string }> = [
  { id: "semaine", label: "Semaine" },
  { id: "mois", label: "Mois" },
  { id: "annee", label: "Année" },
];

/** Querystring `?periode=` → période, défaut « mois » (jamais d'erreur). */
export function parsePeriode(v: string | undefined): PeriodePilotage {
  return v === "semaine" || v === "annee" ? v : "mois";
}

/** `Date` UTC à minuit d'une clé jour « YYYY-MM-DD » (arithmétique calendaire). */
function cleVersDateUtc(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00Z`);
}

/** Clé jour décalée de `jours` jours (arithmétique UTC, insensible au DST). */
function decalerCle(dayKey: string, jours: number): string {
  const d = cleVersDateUtc(dayKey);
  d.setUTCDate(d.getUTCDate() + jours);
  return dayKeyOfGridDate(d);
}

/** Décalage Europe/Paris (minutes) à l'instant donné — gère l'heure d'été. */
function offsetParisMinutes(instant: Date): number {
  try {
    const part = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      timeZoneName: "longOffset",
    })
      .formatToParts(instant)
      .find((p) => p.type === "timeZoneName")?.value;
    const m = part ? /([+-])(\d{2}):(\d{2})/.exec(part) : null;
    if (!m) return 60;
    const signe = m[1] === "-" ? -1 : 1;
    return signe * (parseInt(m[2] ?? "0", 10) * 60 + parseInt(m[3] ?? "0", 10));
  } catch {
    return 60;
  }
}

/** Instant UTC correspondant à minuit Europe/Paris de la clé jour donnée. */
function minuitParisUtc(dayKey: string): Date {
  const guess = cleVersDateUtc(dayKey);
  return new Date(guess.getTime() - offsetParisMinutes(guess) * 60 * 1000);
}

/** Plage [gte, lt) — même forme que `derivePlage`. */
interface Plage {
  gte: Date;
  lt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types du dashboard
// ─────────────────────────────────────────────────────────────────────────────

export interface TuilesPilotage {
  /** Lignes a_preparer + en_cours + signature_attente. Affiché « 200+ » si plafonné. */
  dossiersActifs: string;
  /** Lignes de la colonne « À solder ». Affiché « 200+ » si plafonné. */
  aSolder: string;
  /** Alertes non résolues de niveau critique. */
  alertesCritiques: number;
  /** CA réalisé de la période, en centimes : formations + audits réalisés
   *  (`realisee`) + contrats coaching SIGNÉS dans la période (`dateSigneeAt`,
   *  même règle que le BPF — le coaching n'a pas de montant par séance). */
  caRealiseCents: number;
  /** Delta vs même période N-1, préformaté (« +12 % » / « −8 % »), ou null si N-1 = 0. */
  caDelta: string | null;
  /** Marge du mois EN COURS (consolidation mensuelle), en centimes. */
  margeMoisCents: number;
  /**
   * CA réalisé par mois de l'année en cours (index 0 = janvier), en centimes —
   * la tendance des tuiles. Coût de requête NUL : la consolidation mensuelle
   * est déjà chargée pour la tuile de marge, quelle que soit la période.
   */
  caParMoisCents: number[];
  /** Marge par mois de l'année en cours (index 0 = janvier), en centimes. */
  margeParMoisCents: number[];
}

export interface AlerteCritiqueLigne {
  id: string;
  titre: string;
  message: string;
  createdAt: Date;
}

export interface EvenementCase {
  key: string;
  id: string;
  type: PlanningEventType;
  titre: string;
  statut: string;
}

export interface CelluleSemaine {
  dayKey: string;
  /** Le formateur de la ligne est indisponible ce jour (case grisée). */
  indisponible: boolean;
  events: EvenementCase[];
}

export interface LigneSemaine {
  /** null = ligne « Non affecté ». */
  formateurId: string | null;
  nom: string;
  cellules: CelluleSemaine[];
}

export interface CalendrierSemaine {
  type: "semaine";
  /** 7 clés jour, lundi → dimanche. */
  jours: string[];
  lignes: LigneSemaine[];
}

export interface CalendrierMois {
  type: "mois";
  year: number;
  month: number;
  todayKey: string;
  days: { dayKey: string; count: number }[];
}

export interface BarreMoisAnnee {
  /** 1..12. */
  mois: number;
  /** Prestations (formation/coaching/audit) DÉMARRANT ce mois. */
  nbPrestations: number;
  /** CA réalisé du mois (consolidation mensuelle), en centimes. */
  caRealiseCents: number;
}

export interface CalendrierAnnee {
  type: "annee";
  annee: number;
  mois: BarreMoisAnnee[];
}

export type CalendrierPilotage = CalendrierSemaine | CalendrierMois | CalendrierAnnee;

export interface SessionBloquee {
  id: string;
  numero: string;
  titreSession: string;
  dateDebut: Date;
}

export interface CompteStatut {
  statut: string;
  label: string;
  n: number;
}

export interface ActiviteBloc {
  activite: ActiviteDossier;
  label: string;
  counts: CompteStatut[];
  /** Réalisées / (réalisées + annulées + reportées), en %, ou null si dénominateur 0. */
  tauxRealisationPct: number | null;
  /** 12 mois glissants (le plus ancien d'abord) : prestations réalisées par mois. */
  tendance: { mois: string; n: number }[];
}

export interface FormateursBloc {
  parStatut: { statut: "salarie" | "sous_traitant" | "dirigeant"; n: number }[];
  totalActifs: number;
  /** Top 5 heures animées de l'année en cours. */
  top: HeuresFormateur[];
  /** Signaux du hub (mois courant), codes formateur uniquement. */
  signaux: Signal[];
}

export interface DossierFinancementRetard {
  id: string;
  libelle: string;
  motif: "sans_reponse" | "paiement_retard";
  date: Date | null;
}

export interface DevisSansReponse {
  id: string;
  numero: string;
  client: string;
  sentAt: Date | null;
}

/** Ligne de ventilation du CA par activité de facturation (année en cours). */
export interface CaParActiviteLigne {
  /** null = factures historiques sans activité renseignée. */
  activite: ActiviteFacturation | null;
  label: string;
  /** Factures émises (TTC, avoirs négatifs inclus — ils rectifient le CA). */
  emisTtcCents: number;
  /** Encaissements `Payment` succeeded rattachés à une facture. */
  encaisseCents: number;
}

export interface FinancierBloc {
  annee: number;
  /** Totaux prévisionnels janvier → décembre de l'année en cours. */
  totauxAnnee: TotauxPrevisionnel;
  /** Ventilation émis/encaissé par activité de facturation (année en cours). */
  parActivite: CaParActiviteLigne[];
  topFormations: MargeFormation[];
  flopFormations: MargeFormation[];
  dossiersEnRetard: DossierFinancementRetard[];
  nbDevisSansReponse: number;
  devisSansReponse: DevisSansReponse[];
}

/** Objectif de CA annuel (cible posée à la main dans `Setting`, en euros). */
export interface ObjectifBloc {
  /** null = aucune cible définie (ou valeur invalide) — ne rien afficher. */
  cibleAnnuelleCents: number | null;
  /** CA réalisé de l'année : formations + audits réalisés + coaching signé. */
  realiseAnnuelCents: number;
  /** Pourcentage d'atteinte arrondi, ou null si aucune cible. */
  pctAtteint: number | null;
}

export interface ColonnePipelineCompte {
  id: ColonnePipeline;
  label: string;
  description: string;
  /** « 200+ » si le plafond de lecture est atteint. */
  affichage: string;
  n: number;
}

export interface PipelineBloc {
  colonnes: ColonnePipelineCompte[];
  parActivite: { activite: ActiviteDossier; label: string; n: number }[];
}

export interface PilotageDashboard {
  periode: PeriodePilotage;
  /** Libellé FR de la période affichée (« août 2026 », « Semaine du … »). */
  periodeLabel: string;
  tuiles: TuilesPilotage;
  alertesCritiques: AlerteCritiqueLigne[];
  calendrier: CalendrierPilotage;
  previsionnelBloque: SessionBloquee[];
  activites: ActiviteBloc[];
  formateurs: FormateursBloc;
  financier: FinancierBloc;
  objectif: ObjectifBloc;
  pipeline: PipelineBloc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Requêtes directes (chacune stub-safe, try/catch → vide)
// ─────────────────────────────────────────────────────────────────────────────

/** CA réalisé (centimes) : formations + audits `realisee` démarrant dans la plage.
 *  Le coaching n'a PAS de montant par séance (porté par le contrat) : il est
 *  compté à part par `caCoachingPlage` et ADDITIONNÉ par l'assemblage. */
async function caRealisePlage(plage: Plage): Promise<number> {
  try {
    const [formations, audits] = await Promise.all([
      prisma.trainingSession.aggregate({
        _sum: { montantHtCents: true },
        where: { statut: "realisee", dateDebut: { gte: plage.gte, lt: plage.lt } },
      }),
      prisma.auditMission.aggregate({
        _sum: { montantHtCents: true },
        where: { statut: "realisee", dateDebut: { gte: plage.gte, lt: plage.lt } },
      }),
    ]);
    return (formations._sum.montantHtCents ?? 0) + (audits._sum.montantHtCents ?? 0);
  } catch {
    return 0;
  }
}

/** Plafond de lecture des réductions JS facturation/coaching (jamais toute la table). */
const MAX_LIGNES_FINANCES = 5000;

/** CA coaching (centimes) : contrats 1-to-1 SIGNÉS dans la plage. La date qui
 *  fait foi est `dateSigneeAt` — même règle que le BPF (`aggregateCoaching`). */
async function caCoachingPlage(plage: Plage): Promise<number> {
  try {
    const rows = await prisma.coachingContract.findMany({
      where: { dateSigneeAt: { gte: plage.gte, lt: plage.lt } },
      select: { montantHtCents: true },
      take: MAX_LIGNES_FINANCES,
    });
    return rows.reduce((acc, r) => acc + r.montantHtCents, 0);
  } catch {
    return 0;
  }
}

/**
 * Compléments mensuels du CA « toutes activités » pour la micro-courbe de la
 * tuile : la consolidation (`getConsolidationMensuelle`) ne couvre que les
 * SESSIONS réalisées — on y additionne, mois par mois (Europe/Paris via
 * `moisDe`), les audits réalisés (`dateDebut`) et les contrats coaching
 * signés (`dateSigneeAt`). Sans ça, la courbe contredirait le chiffre de la
 * tuile qui, lui, couvre les trois périmètres.
 */
async function caMensuelComplementsAnnee(annee: number): Promise<number[]> {
  const buckets = Array.from({ length: 12 }, () => 0);
  const ajouter = (d: Date, montant: number): void => {
    const cle = moisDe(d);
    if (!cle.startsWith(`${annee}-`)) return;
    const idx = Number(cle.slice(5, 7)) - 1;
    if (idx >= 0 && idx < 12) buckets[idx] = (buckets[idx] ?? 0) + montant;
  };
  try {
    const plage = derivePlage(annee, { type: "annee" });
    const [audits, contrats] = await Promise.all([
      prisma.auditMission.findMany({
        where: { statut: "realisee", dateDebut: { gte: plage.gte, lt: plage.lt } },
        select: { dateDebut: true, montantHtCents: true },
        take: MAX_LIGNES_FINANCES,
      }),
      prisma.coachingContract.findMany({
        where: { dateSigneeAt: { gte: plage.gte, lt: plage.lt } },
        select: { dateSigneeAt: true, montantHtCents: true },
        take: MAX_LIGNES_FINANCES,
      }),
    ]);
    for (const a of audits) ajouter(a.dateDebut, a.montantHtCents);
    for (const c of contrats) if (c.dateSigneeAt) ajouter(c.dateSigneeAt, c.montantHtCents);
  } catch {
    // stub/DB indisponible → compléments nuls, la courbe retombe sur les sessions.
  }
  return buckets;
}

/** Ordre d'affichage des activités de facturation (ordre de l'enum Prisma). */
const ORDRE_ACTIVITES_FACTURATION: ReadonlyArray<ActiviteFacturation> = [
  "formation",
  "un_a_un",
  "audit",
  "implementation",
  "site_web",
];

/**
 * Ventilation émis TTC / encaissé par activité de facturation sur la plage
 * (année en cours). Réduction JS et non `groupBy _sum` : `montantTtcCents` est
 * null sur les anciennes factures → repli `?? montantHtCents` ligne à ligne
 * (un `_sum` raterait ces lignes). Les avoirs (montants négatifs) restent
 * inclus : ils rectifient le CA émis. Encaissé = `Payment` succeeded rattachés
 * à une `FactureFormation`, ventilés par l'activité de la facture.
 */
async function caParActivitePlage(plage: Plage): Promise<CaParActiviteLigne[]> {
  try {
    const [factures, paiements] = await Promise.all([
      prisma.factureFormation.findMany({
        where: {
          statut: { in: ["emise", "partiellement_payee", "en_retard", "payee"] },
          emiseAt: { gte: plage.gte, lt: plage.lt },
        },
        select: { activite: true, montantTtcCents: true, montantHtCents: true },
        take: MAX_LIGNES_FINANCES,
      }),
      prisma.payment.findMany({
        where: {
          status: "succeeded",
          factureFormationId: { not: null },
          paidAt: { gte: plage.gte, lt: plage.lt },
        },
        select: { amountCents: true, factureFormation: { select: { activite: true } } },
        take: MAX_LIGNES_FINANCES,
      }),
    ]);
    const emis = new Map<ActiviteFacturation | null, number>();
    for (const f of factures) {
      const ttc = f.montantTtcCents ?? f.montantHtCents;
      emis.set(f.activite, (emis.get(f.activite) ?? 0) + ttc);
    }
    const encaisse = new Map<ActiviteFacturation | null, number>();
    for (const p of paiements) {
      const a = p.factureFormation?.activite ?? null;
      encaisse.set(a, (encaisse.get(a) ?? 0) + p.amountCents);
    }
    const lignes: CaParActiviteLigne[] = ORDRE_ACTIVITES_FACTURATION.map((a) => ({
      activite: a,
      label: ACTIVITE_FACTURATION_LABELS[a],
      emisTtcCents: emis.get(a) ?? 0,
      encaisseCents: encaisse.get(a) ?? 0,
    }));
    // Factures historiques sans activité : une ligne seulement si non-zéro.
    const emisSans = emis.get(null) ?? 0;
    const encaisseSans = encaisse.get(null) ?? 0;
    if (emisSans !== 0 || encaisseSans !== 0) {
      lignes.push({
        activite: null,
        label: "Non renseignée",
        emisTtcCents: emisSans,
        encaisseCents: encaisseSans,
      });
    }
    return lignes;
  } catch {
    return [];
  }
}

/** Clé `Setting` de la cible de CA annuelle (nombre en EUROS entiers). */
const CLE_CIBLE_ANNUELLE = "pilotage.ca_cible_annuel_euros";

const cibleAnnuelleSchema = z.number().int().positive();

/** Cible annuelle en CENTIMES depuis `Setting`, ou null (absente, invalide,
 *  ou stub build — `findUnique` du Proxy stub retourne null). */
async function lireCibleAnnuelleCents(): Promise<number | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: CLE_CIBLE_ANNUELLE } });
    if (!row) return null;
    const parsed = cibleAnnuelleSchema.safeParse(row.value);
    return parsed.success ? parsed.data * 100 : null;
  } catch {
    return null;
  }
}

/** Delta préformaté « +12 % » / « −8 % » (U+2212), ou null si la base N-1 est 0. */
function formatDelta(ca: number, caN1: number): string | null {
  if (caN1 <= 0) return null;
  const pct = Math.round(((ca - caN1) / caN1) * 100);
  if (pct > 0) return `+${pct} %`;
  if (pct < 0) return `−${Math.abs(pct)} %`;
  return "0 %";
}

const LABELS_STATUT: Record<string, string> = {
  planifiee: "Planifiées",
  en_cours: "En cours",
  realisee: "Réalisées",
  annulee: "Annulées",
  reportee: "Reportées",
};

/** Ordre d'affichage des statuts d'un bloc activité. */
const ORDRE_STATUTS = ["planifiee", "en_cours", "realisee", "annulee", "reportee"] as const;

function versComptes(rows: { statut: string; n: number }[], avecEnCours: boolean): CompteStatut[] {
  const parStatut = new Map(rows.map((r) => [r.statut, r.n]));
  return ORDRE_STATUTS.filter((s) => avecEnCours || s !== "en_cours").map((s) => ({
    statut: s,
    label: LABELS_STATUT[s] ?? s,
    n: parStatut.get(s) ?? 0,
  }));
}

function tauxRealisation(counts: CompteStatut[]): number | null {
  const get = (s: string): number => counts.find((c) => c.statut === s)?.n ?? 0;
  const realisees = get("realisee");
  const denominateur = realisees + get("annulee") + get("reportee");
  return denominateur > 0 ? Math.round((realisees / denominateur) * 100) : null;
}

async function comptesFormations(plage: Plage): Promise<{ statut: string; n: number }[]> {
  try {
    const rows = await prisma.trainingSession.groupBy({
      by: ["statut"],
      where: { dateDebut: { gte: plage.gte, lt: plage.lt } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ statut: r.statut, n: r._count._all }));
  } catch {
    return [];
  }
}

async function comptesCoachings(plage: Plage): Promise<{ statut: string; n: number }[]> {
  try {
    const rows = await prisma.coachingSession.groupBy({
      by: ["statut"],
      where: { dateSeance: { gte: plage.gte, lt: plage.lt } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ statut: r.statut, n: r._count._all }));
  } catch {
    return [];
  }
}

async function comptesAudits(plage: Plage): Promise<{ statut: string; n: number }[]> {
  try {
    const rows = await prisma.auditMission.groupBy({
      by: ["statut"],
      where: { dateDebut: { gte: plage.gte, lt: plage.lt } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ statut: r.statut, n: r._count._all }));
  } catch {
    return [];
  }
}

/** Plafond de lecture des tendances (12 mois de dates, jamais toute la table). */
const MAX_TENDANCE = 5000;

/** Dates de réalisation par modèle sur la fenêtre de tendance (stub-safe → []). */
async function datesRealisees(source: ActiviteDossier, plage: Plage): Promise<Date[]> {
  try {
    if (source === "formation") {
      const rows = await prisma.trainingSession.findMany({
        where: { statut: "realisee", dateDebut: { gte: plage.gte, lt: plage.lt } },
        select: { dateDebut: true },
        take: MAX_TENDANCE,
      });
      return rows.map((r) => r.dateDebut);
    }
    if (source === "coaching") {
      const rows = await prisma.coachingSession.findMany({
        where: { statut: "realisee", dateSeance: { gte: plage.gte, lt: plage.lt } },
        select: { dateSeance: true },
        take: MAX_TENDANCE,
      });
      return rows.map((r) => r.dateSeance);
    }
    const rows = await prisma.auditMission.findMany({
      where: { statut: "realisee", dateDebut: { gte: plage.gte, lt: plage.lt } },
      select: { dateDebut: true },
      take: MAX_TENDANCE,
    });
    return rows.map((r) => r.dateDebut);
  } catch {
    return [];
  }
}

/** Regroupe des dates par mois Paris sur une fenêtre de clés « YYYY-MM » données. */
function tendanceParMois(dates: Date[], fenetre: string[]): { mois: string; n: number }[] {
  const parMois = new Map<string, number>(fenetre.map((m) => [m, 0]));
  for (const d of dates) {
    const cle = moisDe(d);
    if (parMois.has(cle)) parMois.set(cle, (parMois.get(cle) ?? 0) + 1);
  }
  return fenetre.map((m) => ({ mois: m, n: parMois.get(m) ?? 0 }));
}

/** Sessions planifiées à ≤ 7 jours SANS formateur principal (prévisionnel bloqué). */
async function sessionsBloquees(maintenant: Date): Promise<SessionBloquee[]> {
  try {
    const horizon = new Date(maintenant.getTime() + 7 * 24 * 60 * 60 * 1000);
    return await prisma.trainingSession.findMany({
      where: {
        statut: "planifiee",
        formateurPrincipalId: null,
        dateDebut: { lte: horizon },
      },
      select: { id: true, numero: true, titreSession: true, dateDebut: true },
      orderBy: { dateDebut: "asc" },
      take: 20,
    });
  } catch {
    return [];
  }
}

/** Formateurs ACTIFS par statut (salarié / sous-traitant / dirigeant). */
async function formateursActifsParStatut(): Promise<FormateursBloc["parStatut"]> {
  try {
    const rows = await prisma.trainer.groupBy({
      by: ["statut"],
      where: { actif: true },
      _count: { _all: true },
    });
    const parStatut = new Map(rows.map((r) => [r.statut as string, r._count._all]));
    return (["salarie", "sous_traitant", "dirigeant"] as const).map((s) => ({
      statut: s,
      n: parStatut.get(s) ?? 0,
    }));
  } catch {
    return [];
  }
}

const TRENTE_JOURS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Dossiers de financement en retard — MÊMES règles que l'évaluateur d'alertes
 * (`regleDossiersFinancement`, non exporté) : envoyé sans réponse depuis +30 j,
 * OU échéance financeur dépassée sans paiement reçu.
 */
async function dossiersFinancementEnRetard(maintenant: Date): Promise<DossierFinancementRetard[]> {
  try {
    const ilYA30Jours = new Date(maintenant.getTime() - TRENTE_JOURS_MS);
    const [sansReponse, paiementRetard] = await Promise.all([
      prisma.dossierFinancement.findMany({
        where: { statut: "envoye", envoyeAt: { not: null, lte: ilYA30Jours } },
        select: { id: true, financeurNom: true, numeroDossierExterne: true, envoyeAt: true },
        orderBy: { envoyeAt: "asc" },
        take: 10,
      }),
      prisma.dossierFinancement.findMany({
        where: {
          statut: { in: ["accord_recu", "facture"] },
          echeanceFinanceurAt: { not: null, lte: maintenant },
          paiementRecuAt: null,
        },
        select: {
          id: true,
          financeurNom: true,
          numeroDossierExterne: true,
          echeanceFinanceurAt: true,
        },
        orderBy: { echeanceFinanceurAt: "asc" },
        take: 10,
      }),
    ]);
    const libelle = (d: { financeurNom: string | null; numeroDossierExterne: string | null }) =>
      d.numeroDossierExterne ?? d.financeurNom ?? "Dossier sans référence";
    return [
      ...paiementRetard.map(
        (d): DossierFinancementRetard => ({
          id: d.id,
          libelle: libelle(d),
          motif: "paiement_retard",
          date: d.echeanceFinanceurAt,
        }),
      ),
      ...sansReponse.map(
        (d): DossierFinancementRetard => ({
          id: d.id,
          libelle: libelle(d),
          motif: "sans_reponse",
          date: d.envoyeAt,
        }),
      ),
    ];
  } catch {
    return [];
  }
}

/** Devis envoyés sans réponse depuis +30 jours (champ réel : `sentAt`). */
async function devisSansReponseDepuis30j(
  maintenant: Date,
): Promise<{ nb: number; lignes: DevisSansReponse[] }> {
  try {
    const ilYA30Jours = new Date(maintenant.getTime() - TRENTE_JOURS_MS);
    const where = { statut: "envoye" as const, sentAt: { not: null, lte: ilYA30Jours } };
    const [nb, rows] = await Promise.all([
      prisma.devis.count({ where }),
      prisma.devis.findMany({
        where,
        select: {
          id: true,
          numero: true,
          sentAt: true,
          client: { select: { raisonSociale: true } },
        },
        orderBy: { sentAt: "asc" },
        take: 5,
      }),
    ]);
    return {
      nb,
      lignes: rows.map((r) => ({
        id: r.id,
        numero: r.numero,
        client: r.client.raisonSociale,
        sentAt: r.sentAt,
      })),
    };
  } catch {
    return { nb: 0, lignes: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendrier par période
// ─────────────────────────────────────────────────────────────────────────────

/** Ligne « Non affecté » de la vue semaine. */
const NON_AFFECTE = "Non affecté";

async function calendrierSemaine(joursSemaine: string[]): Promise<CalendrierSemaine> {
  const premier = joursSemaine[0] ?? dayKeyInParis(new Date());
  const dernier = joursSemaine[joursSemaine.length - 1] ?? premier;
  const [events, indisposRows, trainers] = await Promise.all([
    getPlanningRange(minuitParisUtc(premier), minuitParisUtc(decalerCle(dernier, 1))),
    // Colonnes DATE stockées à minuit UTC → bornes UTC, pas de conversion Paris.
    listIndisposEntre(cleVersDateUtc(premier), cleVersDateUtc(dernier)),
    listTrainers({ actifOnly: true }),
  ]);

  const joursSet = new Set(joursSemaine);

  // Indisponibilités par formateur (clés jour, déjà en convention colonne DATE).
  const indisposParFormateur = new Map<string, Set<string>>();
  for (const row of indisposRows) {
    const acc = indisposParFormateur.get(row.trainerId) ?? new Set<string>();
    for (const j of joursIndisponibles([row])) acc.add(j);
    indisposParFormateur.set(row.trainerId, acc);
  }

  // Événements par (formateur, jour). Une prestation multi-jours apparaît sur
  // chaque case de la semaine qu'elle traverse.
  const parFormateurJour = new Map<string | null, Map<string, EvenementCase[]>>();
  const nomsInconnus = new Map<string, string>();
  for (const e of events) {
    if (e.statut === "annulee") continue;
    const fid = e.formateurId ?? null;
    if (fid !== null && e.formateurNom !== null) nomsInconnus.set(fid, e.formateurNom);
    let parJour = parFormateurJour.get(fid);
    if (parJour === undefined) {
      parJour = new Map<string, EvenementCase[]>();
      parFormateurJour.set(fid, parJour);
    }
    for (const j of expandEventDayKeys(e.debut, e.fin)) {
      if (!joursSet.has(j)) continue;
      const arr = parJour.get(j) ?? [];
      arr.push({ key: e.key, id: e.id, type: e.type, titre: e.titre, statut: e.statut });
      parJour.set(j, arr);
    }
  }

  const ligne = (formateurId: string | null, nom: string): LigneSemaine => {
    const parJour = parFormateurJour.get(formateurId);
    const indispo = formateurId !== null ? indisposParFormateur.get(formateurId) : undefined;
    return {
      formateurId,
      nom,
      cellules: joursSemaine.map((dayKey) => ({
        dayKey,
        indisponible: indispo?.has(dayKey) ?? false,
        events: parJour?.get(dayKey) ?? [],
      })),
    };
  };

  // Tous les formateurs actifs (une ligne vide dit « disponible », c'est une
  // information de pilotage), puis les formateurs inactifs porteurs d'événements,
  // puis « Non affecté » s'il reste des prestations sans formateur.
  const lignes: LigneSemaine[] = trainers.map((t) => ligne(t.id, `${t.prenom} ${t.nom}`.trim()));
  const idsActifs = new Set(trainers.map((t) => t.id));
  for (const [fid, nom] of nomsInconnus) {
    if (!idsActifs.has(fid)) lignes.push(ligne(fid, nom));
  }
  if (parFormateurJour.has(null)) lignes.push(ligne(null, NON_AFFECTE));

  return { type: "semaine", jours: joursSemaine, lignes };
}

async function calendrierMois(
  year: number,
  month: number,
  todayKey: string,
): Promise<CalendrierMois> {
  const byDay = await getPlanningMonth(year, month);
  const days = [...byDay.entries()].map(([dayKey, events]) => ({
    dayKey,
    count: events.length,
  }));
  return { type: "mois", year, month, todayKey, days };
}

async function calendrierAnnee(
  annee: number,
  caParMois: ReadonlyArray<{ mois: number; caHtCents: number }>,
): Promise<CalendrierAnnee> {
  const plage = derivePlage(annee, { type: "annee" });
  const events = await getPlanningRange(plage.gte, plage.lt);
  const nbParMois = Array.from({ length: 12 }, () => 0);
  for (const e of events) {
    if (e.statut === "annulee") continue;
    const cle = moisDe(e.debut); // « YYYY-MM » Europe/Paris
    if (!cle.startsWith(`${annee}-`)) continue;
    const idx = Number(cle.slice(5, 7)) - 1;
    if (idx >= 0 && idx < 12) nbParMois[idx] = (nbParMois[idx] ?? 0) + 1;
  }
  const caMap = new Map(caParMois.map((m) => [m.mois, m.caHtCents]));
  return {
    type: "annee",
    annee,
    mois: Array.from({ length: 12 }, (_, i) => ({
      mois: i + 1,
      nbPrestations: nbParMois[i] ?? 0,
      caRealiseCents: caMap.get(i + 1) ?? 0,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assemblage
// ─────────────────────────────────────────────────────────────────────────────

const JOURS_FMT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "UTC" });

function labelPeriode(
  periode: PeriodePilotage,
  annee: number,
  mois: number,
  joursSemaine: string[],
): string {
  if (periode === "semaine") {
    const premier = joursSemaine[0];
    const dernier = joursSemaine[joursSemaine.length - 1];
    if (premier === undefined || dernier === undefined) return "Semaine en cours";
    return `Semaine du ${JOURS_FMT.format(cleVersDateUtc(premier))} au ${JOURS_FMT.format(cleVersDateUtc(dernier))}`;
  }
  if (periode === "annee") return `Année ${annee}`;
  return periodeLabel(annee, { type: "mois", mois });
}

/** Valeur de tuile plafonnée : le pipeline lit au plus `TAKE_MAX` lignes/source. */
function affichagePlafonne(n: number): string {
  return n >= TAKE_MAX ? `${TAKE_MAX}+` : String(n);
}

/**
 * Assemble toutes les données du tableau de bord de pilotage.
 *
 * `adminPrefix` est nécessaire aux signaux du hub (leurs items portent des
 * liens absolus) ; tout le reste est retourné SANS lien — les composants les
 * construisent. `maintenant` est injectable pour les tests.
 */
export async function getPilotageDashboard(
  periode: PeriodePilotage,
  adminPrefix: string,
  maintenant: Date = new Date(),
): Promise<PilotageDashboard> {
  // Repères Europe/Paris de l'instant courant.
  const todayKey = dayKeyInParis(maintenant);
  const annee = Number(todayKey.slice(0, 4));
  const moisCourant = Number(todayKey.slice(5, 7));

  // Semaine courante lundi → dimanche (clés jour Paris).
  const decalageLundi = (cleVersDateUtc(todayKey).getUTCDay() + 6) % 7;
  const lundiKey = decalerCle(todayKey, -decalageLundi);
  const joursSemaine = Array.from({ length: 7 }, (_, i) => decalerCle(lundiKey, i));

  // Plage de la période choisie + même période N-1 (pour le delta de CA).
  let plage: Plage;
  let plageN1: Plage;
  if (periode === "semaine") {
    plage = { gte: minuitParisUtc(lundiKey), lt: minuitParisUtc(decalerCle(lundiKey, 7)) };
    // −364 jours = 52 semaines : la semaine comparable de l'an dernier, alignée
    // lundi → dimanche (un décalage d'un an calendaire casserait l'alignement).
    plageN1 = {
      gte: minuitParisUtc(decalerCle(lundiKey, -364)),
      lt: minuitParisUtc(decalerCle(lundiKey, -364 + 7)),
    };
  } else if (periode === "annee") {
    plage = derivePlage(annee, { type: "annee" });
    plageN1 = derivePlage(annee - 1, { type: "annee" });
  } else {
    plage = derivePlage(annee, { type: "mois", mois: moisCourant });
    plageN1 = derivePlage(annee - 1, { type: "mois", mois: moisCourant });
  }

  // Fenêtre de tendance : 12 mois glissants finissant le mois courant.
  const fenetreTendance: string[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const total = annee * 12 + (moisCourant - 1) - i;
    const a = Math.floor(total / 12);
    const m = (total % 12) + 1;
    fenetreTendance.push(`${a}-${String(m).padStart(2, "0")}`);
  }
  const plusAncien = fenetreTendance[0] ?? `${annee}-01`;
  const plageTendance: Plage = {
    gte: derivePlage(Number(plusAncien.slice(0, 4)), {
      type: "mois",
      mois: Number(plusAncien.slice(5, 7)),
    }).gte,
    lt: derivePlage(annee, { type: "mois", mois: moisCourant }).lt,
  };

  // Année civile en cours (Europe/Paris) : ventilation facturation + objectif.
  const plageAnnee = derivePlage(annee, { type: "annee" });

  // Consolidation mensuelle : sert la tuile marge ET la vue année.
  const consolidationPromise = getConsolidationMensuelle(annee);

  const calendrierPromise: Promise<CalendrierPilotage> =
    periode === "semaine"
      ? calendrierSemaine(joursSemaine)
      : periode === "annee"
        ? consolidationPromise.then((c) => calendrierAnnee(annee, c.mois))
        : calendrierMois(annee, moisCourant, todayKey);

  const [
    pipeline,
    alertes,
    consolidation,
    caPeriode,
    caPeriodeN1,
    caCoachingPeriode,
    caCoachingPeriodeN1,
    caAnneeSessions,
    caAnneeCoaching,
    parActiviteFacturation,
    cibleAnnuelleCents,
    complementsMensuels,
    calendrier,
    bloquees,
    comptesF,
    comptesC,
    comptesA,
    datesF,
    datesC,
    datesA,
    parStatutFormateurs,
    heuresFormateurs,
    signaux,
    lignesPrev,
    margeFormations,
    dossiersRetard,
    devisSansRep,
  ] = await Promise.all([
    lireDossiersPipeline(maintenant),
    listAlertes({ resolue: false, niveau: "critique", limit: 20 }),
    consolidationPromise,
    caRealisePlage(plage),
    caRealisePlage(plageN1),
    caCoachingPlage(plage),
    caCoachingPlage(plageN1),
    caRealisePlage(plageAnnee),
    caCoachingPlage(plageAnnee),
    caParActivitePlage(plageAnnee),
    lireCibleAnnuelleCents(),
    caMensuelComplementsAnnee(annee),
    calendrierPromise,
    sessionsBloquees(maintenant),
    comptesFormations(plage),
    comptesCoachings(plage),
    comptesAudits(plage),
    datesRealisees("formation", plageTendance),
    datesRealisees("coaching", plageTendance),
    datesRealisees("audit", plageTendance),
    formateursActifsParStatut(),
    getHeuresParFormateur({ annee }),
    getHubSignaux(annee, moisCourant, adminPrefix, maintenant),
    getPrevisionnel(annee, 12, maintenant),
    getMargeParFormation({ annee }),
    dossiersFinancementEnRetard(maintenant),
    devisSansReponseDepuis30j(maintenant),
  ]);

  // Tuiles. CA de la période = sessions/audits réalisés + coaching signé —
  // même addition sur N-1 pour que le delta compare des périmètres identiques.
  const nbActifs =
    pipeline.a_preparer.length + pipeline.en_cours.length + pipeline.signature_attente.length;
  const margeMois = consolidation.mois.find((m) => m.mois === moisCourant)?.margeCents ?? 0;
  const caToutesActivites = caPeriode + caCoachingPeriode;
  const caToutesActivitesN1 = caPeriodeN1 + caCoachingPeriodeN1;

  // Objectif annuel : réalisé = même règle que la tuile, sur l'année civile.
  const realiseAnnuelCents = caAnneeSessions + caAnneeCoaching;
  const objectif: ObjectifBloc = {
    cibleAnnuelleCents,
    realiseAnnuelCents,
    pctAtteint:
      cibleAnnuelleCents !== null && cibleAnnuelleCents > 0
        ? Math.round((realiseAnnuelCents / cibleAnnuelleCents) * 100)
        : null,
  };

  // Prévisionnel : `getPrevisionnel` ne renvoie que les mois non vides →
  // compléter la fenêtre janvier → décembre avant les totaux.
  const parMoisPrev = new Map<string, LignePrevisionnel>(lignesPrev.map((l) => [l.mois, l]));
  const lignesCompletes = Array.from({ length: 12 }, (_, i) => {
    const cle = `${annee}-${String(i + 1).padStart(2, "0")}`;
    return parMoisPrev.get(cle) ?? ligneVide(cle);
  });

  // Marge par formation : top 3 / flop 3 (sans recouvrement si < 6 formations).
  const topFormations = margeFormations.slice(0, 3);
  const flopFormations =
    margeFormations.length > 3
      ? margeFormations.slice(Math.max(3, margeFormations.length - 3))
      : [];

  // Signaux « formateur » du hub uniquement (vigilance section Formateurs).
  const CODES_FORMATEUR = new Set([
    "formateur_non_conforme",
    "formateur_indisponible",
    "surcharge_formateur",
  ]);
  const signauxFormateurs = signaux.filter((s) => CODES_FORMATEUR.has(s.code));

  // Répartition du pipeline par activité (toutes colonnes confondues).
  const parActivite = new Map<ActiviteDossier, number>();
  for (const colonne of Object.values(pipeline)) {
    for (const ligne of colonne) {
      parActivite.set(ligne.activite, (parActivite.get(ligne.activite) ?? 0) + 1);
    }
  }

  const blocActivite = (
    activite: ActiviteDossier,
    label: string,
    comptes: { statut: string; n: number }[],
    avecEnCours: boolean,
    dates: Date[],
  ): ActiviteBloc => {
    const counts = versComptes(comptes, avecEnCours);
    return {
      activite,
      label,
      counts,
      tauxRealisationPct: tauxRealisation(counts),
      tendance: tendanceParMois(dates, fenetreTendance),
    };
  };

  return {
    periode,
    periodeLabel: labelPeriode(periode, annee, moisCourant, joursSemaine),
    tuiles: {
      dossiersActifs: affichagePlafonne(nbActifs),
      aSolder: affichagePlafonne(pipeline.a_solder.length),
      alertesCritiques: alertes.length,
      caRealiseCents: caToutesActivites,
      caDelta: formatDelta(caToutesActivites, caToutesActivitesN1),
      margeMoisCents: margeMois,
      // Sessions (consolidation) + audits réalisés + coaching signé, mois par
      // mois — même périmètre que le chiffre de la tuile.
      caParMoisCents: Array.from(
        { length: 12 },
        (_, i) =>
          (consolidation.mois.find((m) => m.mois === i + 1)?.caHtCents ?? 0) +
          (complementsMensuels[i] ?? 0),
      ),
      margeParMoisCents: Array.from(
        { length: 12 },
        (_, i) => consolidation.mois.find((m) => m.mois === i + 1)?.margeCents ?? 0,
      ),
    },
    alertesCritiques: alertes.map((a) => ({
      id: a.id,
      titre: a.titre,
      message: a.message,
      createdAt: a.createdAt,
    })),
    calendrier,
    previsionnelBloque: bloquees,
    activites: [
      blocActivite("formation", "Formations", comptesF, true, datesF),
      blocActivite("coaching", "Coachings", comptesC, false, datesC),
      blocActivite("audit", "Audits", comptesA, true, datesA),
    ],
    formateurs: {
      parStatut: parStatutFormateurs,
      totalActifs: parStatutFormateurs.reduce((acc, s) => acc + s.n, 0),
      top: heuresFormateurs.slice(0, 5),
      signaux: signauxFormateurs,
    },
    financier: {
      annee,
      totauxAnnee: totaux(lignesCompletes),
      parActivite: parActiviteFacturation,
      topFormations,
      flopFormations,
      dossiersEnRetard: dossiersRetard,
      nbDevisSansReponse: devisSansRep.nb,
      devisSansReponse: devisSansRep.lignes,
    },
    objectif,
    pipeline: {
      colonnes: COLONNES_PIPELINE.map((c) => ({
        id: c.id,
        label: c.label,
        description: c.description,
        n: pipeline[c.id].length,
        affichage: affichagePlafonne(pipeline[c.id].length),
      })),
      parActivite: (["formation", "coaching", "audit"] as const).map((a) => ({
        activite: a,
        label: ACTIVITE_LABELS[a],
        n: parActivite.get(a) ?? 0,
      })),
    },
  };
}
