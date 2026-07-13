/**
 * Qualiopi — Cockpit financier : MARGE par session / formation / formateur (Lot 6.3).
 *
 * Couche de LECTURE/AGRÉGATION pure au-dessus des données déjà persistées par le
 * pilier C (rémunération) : `TrainerFeeLine.montantHtCents` (coût formateur réel
 * ou analytique) + `TrainingSession.montantHtCents` (CA HT). Aucune migration :
 * la marge = CA − Σ coût formateur, calculée à la volée.
 *
 * Périmètre : sessions RÉALISÉES (`statut = realisee`) de la période — seules ces
 * sessions ont un CA acquis et un coût formateur constaté. Le coût dépend de
 * l'exécution du run mensuel de rémunération : `coutCalcule=false` signale une
 * session réalisée dont aucune ligne de rémunération n'a encore été générée (la
 * marge affichée est alors surévaluée — à interpréter avec le drapeau).
 *
 * Stub-aware (early-exit `stub.invalid` → résultats vides) : lisible au build SSG.
 */

import { prisma } from "@/lib/prisma";
import {
  derivePlage,
  periodeLabel,
  type PilotagePeriode,
} from "@/server/qualiopi/conformite/periode";
import type { TrainingSessionStatut } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MargeOptions {
  annee: number;
  periode?: PilotagePeriode;
}

export interface MargeSession {
  sessionId: string;
  numero: string;
  titre: string;
  formationId: string;
  formationTitre: string;
  dateDebut: Date;
  statut: TrainingSessionStatut;
  /** CA HT de la session (centimes). */
  caHtCents: number;
  /** Coût formateur total (centimes) = Σ TrainerFeeLine.montantHtCents. */
  coutFormateurCents: number;
  /** Marge = CA − coût (centimes, peut être négative). */
  margeCents: number;
  /** Taux de marge (% du CA), ou null si CA = 0. */
  tauxMargePct: number | null;
  /** Heures animées cumulées (tous formateurs de la session). */
  heuresAnimees: number;
  /**
   * true si ≥1 ligne de rémunération existe pour la période courante de la session
   * (le coût provient du run — prévisionnel OU réel). false = aucune ligne → coût 0
   * affiché, marge surévaluée à signaler.
   */
  coutCalcule: boolean;
}

export interface MargeFormation {
  formationId: string;
  formationTitre: string;
  nbSessions: number;
  caHtCents: number;
  coutFormateurCents: number;
  margeCents: number;
  tauxMargePct: number | null;
  heuresAnimees: number;
}

export interface HeuresFormateur {
  trainerId: string;
  trainerNom: string;
  heuresAnimees: number;
  coutFormateurCents: number;
  /** Nombre de sessions animées sur la période. */
  nbSessions: number;
}

export interface MargeMois {
  mois: number; // 1..12
  caHtCents: number;
  coutFormateurCents: number;
  margeCents: number;
}

export interface MargeConsolidation {
  annee: number;
  mois: MargeMois[];
  totalCaHtCents: number;
  totalCoutFormateurCents: number;
  totalMargeCents: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isStub(): boolean {
  return Boolean(process.env["DATABASE_URL"]?.includes("stub.invalid"));
}

/** Prisma.Decimal | null → number. */
function decToNum(d: unknown): number {
  if (d == null) return 0;
  const n = Number(d);
  return Number.isFinite(n) ? n : 0;
}

/** Taux de marge (% entier du CA) ou null si CA = 0. */
function tauxMarge(caHtCents: number, margeCents: number): number | null {
  return caHtCents > 0 ? Math.round((margeCents / caHtCents) * 100) : null;
}

/** Mois 1..12 en heure de Paris (évite les décalages de fin de mois UTC). */
function moisParis(date: Date): number {
  const s = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    month: "numeric",
  }).format(date);
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 1;
}

/** Année en heure de Paris (cohérent avec le mois pour le rattachement). */
function parisAnnee(date: Date): number {
  const s = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
  }).format(date);
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : date.getUTCFullYear();
}

/** Période de rattachement (année:mois Paris) d'une session — clé de matching des lignes. */
function ratKey(date: Date): string {
  return `${parisAnnee(date)}:${moisParis(date)}`;
}

/**
 * Collecte les sessions réalisées d'une plage + leur coût formateur et heures.
 * Brique commune à getMargeParSession / getMargeParFormation / consolidation.
 */
async function collecteSessionsMarge(plage: { gte: Date; lt: Date }): Promise<MargeSession[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: { statut: "realisee", dateDebut: plage },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      formationId: true,
      montantHtCents: true,
      dateDebut: true,
      statut: true,
      formation: { select: { titre: true } },
    },
    orderBy: { dateDebut: "desc" },
  });
  if (sessions.length === 0) return [];

  const ids = sessions.map((s) => s.id);

  const [coutRows, heuresRows] = await Promise.all([
    // Groupe par (session, période) : une ligne de rémunération est rattachée au
    // mois Paris de la dateDebut AU MOMENT du run. On la matche ensuite à la
    // période COURANTE de la session pour écarter les lignes DEVENUES obsolètes
    // après un report vers un autre mois (sinon double-comptage du coût).
    prisma.trainerFeeLine.groupBy({
      by: ["sessionId", "periodeYear", "periodeMonth"],
      where: { sessionId: { in: ids } },
      _sum: { montantHtCents: true },
      _count: { _all: true },
    }),
    prisma.sessionFormateur.groupBy({
      by: ["sessionId"],
      where: { sessionId: { in: ids } },
      _sum: { heuresAnimees: true },
    }),
  ]);

  const coutMap = new Map<string, { cents: number; count: number }>();
  for (const r of coutRows) {
    if (r.sessionId) {
      coutMap.set(`${r.sessionId}:${r.periodeYear}:${r.periodeMonth}`, {
        cents: r._sum.montantHtCents ?? 0,
        count: r._count._all,
      });
    }
  }
  const heuresMap = new Map<string, number>();
  for (const r of heuresRows) {
    if (r.sessionId) heuresMap.set(r.sessionId, decToNum(r._sum.heuresAnimees));
  }

  return sessions.map((s) => {
    const cout = coutMap.get(`${s.id}:${ratKey(s.dateDebut)}`);
    const coutFormateurCents = cout?.cents ?? 0;
    const margeCents = s.montantHtCents - coutFormateurCents;
    return {
      sessionId: s.id,
      numero: s.numero,
      titre: s.titreSession,
      formationId: s.formationId,
      formationTitre: s.formation.titre,
      dateDebut: s.dateDebut,
      statut: s.statut,
      caHtCents: s.montantHtCents,
      coutFormateurCents,
      margeCents,
      tauxMargePct: tauxMarge(s.montantHtCents, margeCents),
      heuresAnimees: heuresMap.get(s.id) ?? 0,
      coutCalcule: (cout?.count ?? 0) > 0,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// API publique
// ─────────────────────────────────────────────────────────────────────────────

/** Marge par session réalisée sur la période. Stub-safe → []. */
export async function getMargeParSession(options: MargeOptions): Promise<MargeSession[]> {
  if (isStub()) return [];
  const plage = derivePlage(options.annee, options.periode ?? { type: "annee" });
  return collecteSessionsMarge(plage);
}

/** Marge agrégée par formation sur la période. Stub-safe → []. */
export async function getMargeParFormation(options: MargeOptions): Promise<MargeFormation[]> {
  if (isStub()) return [];
  const plage = derivePlage(options.annee, options.periode ?? { type: "annee" });
  const sessions = await collecteSessionsMarge(plage);

  const map = new Map<string, MargeFormation>();
  for (const s of sessions) {
    const agg = map.get(s.formationId) ?? {
      formationId: s.formationId,
      formationTitre: s.formationTitre,
      nbSessions: 0,
      caHtCents: 0,
      coutFormateurCents: 0,
      margeCents: 0,
      tauxMargePct: null,
      heuresAnimees: 0,
    };
    agg.nbSessions += 1;
    agg.caHtCents += s.caHtCents;
    agg.coutFormateurCents += s.coutFormateurCents;
    agg.margeCents += s.margeCents;
    agg.heuresAnimees += s.heuresAnimees;
    map.set(s.formationId, agg);
  }

  const rows = [...map.values()].map((f) => ({
    ...f,
    tauxMargePct: tauxMarge(f.caHtCents, f.margeCents),
  }));
  rows.sort((a, b) => b.margeCents - a.margeCents);
  return rows;
}

/** Heures animées + coût par formateur sur la période. Stub-safe → []. */
export async function getHeuresParFormateur(options: MargeOptions): Promise<HeuresFormateur[]> {
  if (isStub()) return [];
  const plage = derivePlage(options.annee, options.periode ?? { type: "annee" });

  // Sessions réalisées de la période (bornage commun heures ↔ coût).
  const sessions = await prisma.trainingSession.findMany({
    where: { statut: "realisee", dateDebut: plage },
    select: { id: true, dateDebut: true },
  });
  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.id);
  const rattachement = new Map(sessions.map((s) => [s.id, ratKey(s.dateDebut)]));

  const [heuresRows, coutRows] = await Promise.all([
    prisma.sessionFormateur.groupBy({
      by: ["trainerId"],
      where: { sessionId: { in: ids } },
      _sum: { heuresAnimees: true },
      _count: { _all: true },
    }),
    // Idem collecteSessionsMarge : rattacher chaque coût à la période courante de
    // la session pour ne pas sommer des lignes obsolètes (session reportée).
    prisma.trainerFeeLine.groupBy({
      by: ["trainerId", "sessionId", "periodeYear", "periodeMonth"],
      where: { sessionId: { in: ids } },
      _sum: { montantHtCents: true },
    }),
  ]);

  const coutMap = new Map<string, number>();
  for (const r of coutRows) {
    if (r.sessionId && rattachement.get(r.sessionId) === `${r.periodeYear}:${r.periodeMonth}`) {
      coutMap.set(r.trainerId, (coutMap.get(r.trainerId) ?? 0) + (r._sum.montantHtCents ?? 0));
    }
  }

  const trainerIds = heuresRows.map((r) => r.trainerId);
  const trainers = await prisma.trainer.findMany({
    where: { id: { in: trainerIds } },
    select: { id: true, nom: true, prenom: true },
  });
  const nomMap = new Map(trainers.map((t) => [t.id, `${t.prenom} ${t.nom}`.trim()]));

  const rows: HeuresFormateur[] = heuresRows.map((r) => ({
    trainerId: r.trainerId,
    trainerNom: nomMap.get(r.trainerId) ?? "—",
    heuresAnimees: decToNum(r._sum.heuresAnimees),
    coutFormateurCents: coutMap.get(r.trainerId) ?? 0,
    nbSessions: r._count._all,
  }));
  rows.sort((a, b) => b.heuresAnimees - a.heuresAnimees);
  return rows;
}

/** Consolidation mensuelle CA / coût / marge sur une année. Stub-safe → 12 mois à 0. */
export async function getConsolidationMensuelle(annee: number): Promise<MargeConsolidation> {
  const mois: MargeMois[] = Array.from({ length: 12 }, (_, i) => ({
    mois: i + 1,
    caHtCents: 0,
    coutFormateurCents: 0,
    margeCents: 0,
  }));

  if (!isStub()) {
    const plage = derivePlage(annee, { type: "annee" });
    const sessions = await collecteSessionsMarge(plage);
    for (const s of sessions) {
      const idx = moisParis(s.dateDebut) - 1;
      const bucket = mois[idx];
      if (bucket) {
        bucket.caHtCents += s.caHtCents;
        bucket.coutFormateurCents += s.coutFormateurCents;
        bucket.margeCents += s.margeCents;
      }
    }
  }

  const totalCaHtCents = mois.reduce((a, m) => a + m.caHtCents, 0);
  const totalCoutFormateurCents = mois.reduce((a, m) => a + m.coutFormateurCents, 0);
  const totalMargeCents = mois.reduce((a, m) => a + m.margeCents, 0);

  return { annee, mois, totalCaHtCents, totalCoutFormateurCents, totalMargeCents };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sérialisation CSV (cockpit financier)
// ─────────────────────────────────────────────────────────────────────────────

function csvEsc(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

/** €, 2 décimales, séparateur décimal VIRGULE (Excel fr-FR + séparateur « ; »). */
function euros(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Nombre → chaîne à séparateur décimal virgule (cohérence CSV fr-FR). */
function nombreFr(n: number): string {
  return String(n).replace(".", ",");
}

/**
 * Export CSV du cockpit financier (marge par session), séparateur « ; ».
 * Le libellé de période est passé par l'appelant (réutilise periodeLabel).
 */
export function margeSessionsToCsv(
  rows: MargeSession[],
  annee: number,
  periode: PilotagePeriode,
): string {
  const header = [
    "Session",
    "Titre",
    "Formation",
    "Date",
    "CA HT (€)",
    "Coût formateur (€)",
    "Marge (€)",
    "Taux marge (%)",
    "Heures",
    "Coût calculé",
  ]
    .map(csvEsc)
    .join(";");

  const lignes = rows.map((r) =>
    [
      r.numero,
      r.titre,
      r.formationTitre,
      r.dateDebut.toLocaleDateString("fr-FR"),
      euros(r.caHtCents),
      euros(r.coutFormateurCents),
      euros(r.margeCents),
      r.tauxMargePct != null ? String(r.tauxMargePct) : "—",
      nombreFr(r.heuresAnimees),
      r.coutCalcule ? "oui" : "non",
    ]
      .map(csvEsc)
      .join(";"),
  );

  const pied = [
    csvEsc("Période"),
    csvEsc(periodeLabel(annee, periode)),
    csvEsc(`${rows.length} session(s) réalisée(s)`),
  ].join(";");

  return [header, ...lignes, "", pied].join("\n") + "\n";
}
