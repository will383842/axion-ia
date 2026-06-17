/**
 * Observatoire IA 2026 — agrégation centralisée (SOURCE UNIQUE de calcul).
 *
 * Utilisé par : le seed dev, le recalcul admin, le worker BullMQ, et la page
 * publique pour les vues filtrées au RUNTIME. La page publique non filtrée lit
 * le `BarometerSnapshot("latest")` pré-calculé (jamais d'agrégat au build —
 * sous `stub.invalid`, `$queryRaw`/`findUnique` renvoient [] / null, et toutes
 * les fonctions ci-dessous dégradent proprement vers un payload vide).
 *
 * Agrégation 100 % SQL brut PARAMÉTRÉ (anti-injection) : uniforme pour les
 * champs single-choice (colonnes enum) et multi-choice (JSONB), et indépendant
 * du typage `groupBy` dynamique de Prisma.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../prisma/generated/client";
import { BAROMETER_QUESTIONS, SECTOR_SLUGS, REGION_SLUGS } from "@/content/observatoire/questions";
import { SNAPSHOT_KEY_LATEST } from "@/content/observatoire/study";

export interface DistributionEntry {
  readonly value: string;
  readonly count: number;
  /** Pourcentage entier (0-100). */
  readonly pct: number;
}

export interface BarometerSnapshotPayload {
  readonly totalResponses: number;
  readonly generatedAt: string;
  readonly filter: {
    companySize: string | null;
    sector: string | null;
    region: string | null;
  };
  /** Distributions par identifiant de question. */
  readonly distributions: Record<string, ReadonlyArray<DistributionEntry>>;
  /** Constats phares (pourcentages entiers). */
  readonly insights: Record<string, number>;
}

export interface BarometerFilter {
  companySize?: string | null;
  sector?: string | null;
  region?: string | null;
}

/** Champs single-choice : id de question (clé payload) → colonne SQL. */
const SINGLE_FIELDS: ReadonlyArray<{ key: string; col: string }> = [
  { key: "companySize", col: "company_size" },
  { key: "sector", col: "sector" },
  { key: "region", col: "region" },
  { key: "respondentRole", col: "respondent_role" },
  { key: "maturityLevel", col: "maturity_level" },
  { key: "competitorsUseAi", col: "competitors_use_ai" },
  { key: "hasStrategy", col: "has_strategy" },
  { key: "annualBudget", col: "annual_budget" },
  { key: "timeSavedPerDay", col: "time_saved_per_day" },
  { key: "rgpdConcern", col: "rgpd_concern" },
  { key: "teamTrained", col: "team_trained" },
  { key: "satisfaction", col: "satisfaction" },
  { key: "investmentIntent", col: "investment_intent" },
];

/** Champs multi-choice : id de question → colonne JSONB. */
const MULTI_COLUMNS: ReadonlyArray<{ key: string; col: string }> = [
  { key: "useCases", col: "use_cases" },
  { key: "tools", col: "tools" },
  { key: "barriers", col: "barriers" },
];

function pct(count: number, base: number): number {
  return base > 0 ? Math.round((count / base) * 100) : 0;
}

/** Ordre canonique des valeurs pour une question (affichage stable). */
function canonicalOrder(questionId: string): ReadonlyArray<string> {
  if (questionId === "sector") return SECTOR_SLUGS;
  if (questionId === "region") return REGION_SLUGS;
  const q = BAROMETER_QUESTIONS.find((x) => x.id === questionId);
  return q?.options ?? [];
}

function orderEntries(questionId: string, entries: DistributionEntry[]): DistributionEntry[] {
  const order = canonicalOrder(questionId);
  if (order.length === 0) return [...entries].sort((a, b) => b.count - a.count);
  const idx = new Map(order.map((v, i) => [v, i]));
  return [...entries].sort((a, b) => (idx.get(a.value) ?? 999) - (idx.get(b.value) ?? 999));
}

/** Conditions WHERE paramétrées issues du filtre (valeurs bindées). */
function whereConds(f: BarometerFilter): Prisma.Sql[] {
  const c: Prisma.Sql[] = [];
  if (f.companySize) c.push(Prisma.sql`company_size = ${f.companySize}::"CompanySize"`);
  if (f.sector) c.push(Prisma.sql`sector = ${f.sector}`);
  if (f.region) c.push(Prisma.sql`region = ${f.region}`);
  return c;
}

function whereClause(conds: Prisma.Sql[]): Prisma.Sql {
  return conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}` : Prisma.empty;
}

async function countResponses(conds: Prisma.Sql[]): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(
    Prisma.sql`SELECT COUNT(*)::int AS count FROM barometer_responses ${whereClause(conds)}`,
  );
  return rows[0]?.count ?? 0;
}

/** Map value→count pour une colonne single-choice (NULL exclus). */
async function groupSingle(col: string, baseConds: Prisma.Sql[]): Promise<Map<string, number>> {
  const conds = [...baseConds, Prisma.sql`${Prisma.raw(col)} IS NOT NULL`];
  const rows = await prisma.$queryRaw<Array<{ value: string; count: number }>>(
    Prisma.sql`
      SELECT ${Prisma.raw(col)}::text AS value, COUNT(*)::int AS count
      FROM barometer_responses ${whereClause(conds)}
      GROUP BY ${Prisma.raw(col)}
    `,
  );
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.value, Number(r.count));
  return m;
}

/** Map value→count pour une colonne multi-choice (jsonb_array_elements_text). */
async function groupMulti(col: string, baseConds: Prisma.Sql[]): Promise<Map<string, number>> {
  // Garde défensive : si une ligne avait une valeur non-array (import futur hors
  // seed/formulaire), jsonb_array_elements_text throw. Le CASE neutralise ce cas.
  const rows = await prisma.$queryRaw<Array<{ value: string; count: number }>>(
    Prisma.sql`
      SELECT elem AS value, COUNT(*)::int AS count
      FROM barometer_responses,
        jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(${Prisma.raw(col)}) = 'array'
               THEN ${Prisma.raw(col)} ELSE '[]'::jsonb END
        ) AS elem
      ${whereClause(baseConds)}
      GROUP BY elem
    `,
  );
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.value, Number(r.count));
  return m;
}

function sumMap(m: Map<string, number>): number {
  let s = 0;
  for (const v of m.values()) s += v;
  return s;
}

/** Payload vide (fallback build/stub ou aucune réponse) — jamais de throw. */
export function emptySnapshotPayload(f: BarometerFilter = {}): BarometerSnapshotPayload {
  return {
    totalResponses: 0,
    generatedAt: new Date(0).toISOString(),
    filter: {
      companySize: f.companySize ?? null,
      sector: f.sector ?? null,
      region: f.region ?? null,
    },
    distributions: {},
    insights: {},
  };
}

/**
 * Agrège les réponses (optionnellement filtrées) en un payload de snapshot.
 * Sûr au build : sous le stub, `$queryRaw` renvoie [] → total 0, maps vides.
 */
export async function aggregateBarometer(
  f: BarometerFilter = {},
): Promise<BarometerSnapshotPayload> {
  const conds = whereConds(f);

  // Requêtes indépendantes lancées en parallèle (1 count + 13 single + 3 multi).
  const [total, singleResults, multiResults] = await Promise.all([
    countResponses(conds),
    Promise.all(
      SINGLE_FIELDS.map(async ({ key, col }) => [key, await groupSingle(col, conds)] as const),
    ),
    Promise.all(
      MULTI_COLUMNS.map(async ({ key, col }) => [key, await groupMulti(col, conds)] as const),
    ),
  ]);

  const distributions: Record<string, DistributionEntry[]> = {};
  const singleMaps = new Map<string, Map<string, number>>();

  // Single-choice
  for (const [key, map] of singleResults) {
    singleMaps.set(key, map);
    // satisfaction : base = répondants ayant répondu (non-null).
    const base = key === "satisfaction" ? sumMap(map) : total;
    const entries: DistributionEntry[] = [...map.entries()].map(([value, count]) => ({
      value,
      count,
      pct: pct(count, base),
    }));
    distributions[key] = orderEntries(key, entries);
  }

  // Multi-choice (pct sur le total de répondants).
  for (const [key, map] of multiResults) {
    const entries: DistributionEntry[] = [...map.entries()].map(([value, count]) => ({
      value,
      count,
      pct: pct(count, total),
    }));
    distributions[key] = orderEntries(key, entries);
  }

  // Constats phares (sommes de valeurs, pct sur total).
  const competitors = singleMaps.get("competitorsUseAi") ?? new Map<string, number>();
  const strategy = singleMaps.get("hasStrategy") ?? new Map<string, number>();
  const rgpd = singleMaps.get("rgpdConcern") ?? new Map<string, number>();
  const intent = singleMaps.get("investmentIntent") ?? new Map<string, number>();

  const insights: Record<string, number> = {
    competitors_use_ai: pct(
      (competitors.get("yes_clearly") ?? 0) + (competitors.get("probably") ?? 0),
      total,
    ),
    no_formal_strategy: pct(strategy.get("none") ?? 0, total),
    rgpd_concern: pct((rgpd.get("very") ?? 0) + (rgpd.get("somewhat") ?? 0), total),
    investment_intent: pct(
      (intent.get("strong_increase") ?? 0) + (intent.get("increase") ?? 0),
      total,
    ),
  };

  return {
    totalResponses: total,
    generatedAt: new Date().toISOString(),
    filter: {
      companySize: f.companySize ?? null,
      sector: f.sector ?? null,
      region: f.region ?? null,
    },
    distributions,
    insights,
  };
}

/**
 * Recalcule l'agrégat global et le persiste dans `BarometerSnapshot("latest")`.
 * Appelé par le seed, l'action admin et le worker — JAMAIS au build (upsert
 * throw sous le stub, comportement voulu).
 */
export async function recomputeAndPersistSnapshot(): Promise<BarometerSnapshotPayload> {
  const payload = await aggregateBarometer();
  await prisma.barometerSnapshot.upsert({
    where: { key: SNAPSHOT_KEY_LATEST },
    create: {
      key: SNAPSHOT_KEY_LATEST,
      totalResponses: payload.totalResponses,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
    update: {
      totalResponses: payload.totalResponses,
      payload: payload as unknown as Prisma.InputJsonValue,
      computedAt: new Date(),
    },
  });
  return payload;
}

/**
 * Compte les réponses RÉELLES (hors fixture de seed `seed:%`). C'est le COMPTEUR
 * D'INTÉGRITÉ : la publication d'un article `barometer_insight` doit refuser tant
 * qu'aucune réponse réelle n'existe — `totalResponses` du snapshot inclut le seed
 * dev (8627) et ne doit JAMAIS servir de garde anti-fabrication. Même sémantique
 * que le dashboard admin (réel = total − seedé). Stub-safe (count → 0 au build).
 */
export async function countRealResponses(): Promise<number> {
  const [total, seeded] = await Promise.all([
    prisma.barometerResponse.count(),
    prisma.barometerResponse.count({ where: { visitorId: { startsWith: "seed:" } } }),
  ]);
  return total - seeded;
}

/**
 * Lit le snapshot pré-calculé. Renvoie null si absent (build/stub → fallback
 * « enquête en cours », jamais de throw).
 */
export async function readLatestSnapshot(): Promise<BarometerSnapshotPayload | null> {
  const row = await prisma.barometerSnapshot.findUnique({
    where: { key: SNAPSHOT_KEY_LATEST },
  });
  if (!row) return null;
  return row.payload as unknown as BarometerSnapshotPayload;
}
