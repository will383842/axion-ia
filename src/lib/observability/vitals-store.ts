// P-303 — Persistance RUM Web Vitals.
//
// Pipeline V1 (S6.3 P0-2, 2026-05-15) :
//   1. Append ndjson local `data/vitals/YYYY-MM-DD.ndjson` (audit trail brut,
//      utile pour `scripts/vitals-report.ts` et import bulk Postgres).
//   2. Insert `WebVitalSample` Prisma (consommé par `content-web-vitals-
//      monitor-worker` cron 02:30 UTC pour calcul p75 + alertes Telegram).
//
// Les deux écritures tournent en parallèle, chacune avec son propre swallow —
// aucune ne doit casser l'UX. La route `/api/vitals` a déjà répondu 204 avant
// nous (fire-and-forget côté handler).
//
// Mappings name → metric Prisma :
//   - "FID" est filtré (Google deprecated INP en 2024 ; pas dans WebVitalMetric
//     enum Prisma). Le ndjson le conserve quand même pour audit historique.
// Mappings rating "needs-improvement" → enum Prisma "needs_improvement".

import { promises as fs } from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/prisma";

// `| undefined` explicite sur les optionnels pour rester compatible avec
// `exactOptionalPropertyTypes: true` du tsconfig — les types Zod inferred
// produisent `field?: T | undefined` plutôt que `field?: T`.
interface VitalsRecord {
  id: string;
  name: string;
  value: number;
  rating?: string | undefined;
  delta?: number | undefined;
  navigationType?: string | undefined;
  href?: string | undefined;
  route?: string | undefined;
  locale?: string | undefined;
  effectiveType?: string | null | undefined;
  deviceMemory?: number | null | undefined;
}

function todayUtcSlug(): string {
  // YYYY-MM-DD UTC — évite les rotations qui glissent en local time.
  return new Date().toISOString().slice(0, 10);
}

function targetFile(): string {
  // `process.cwd()` = racine du runtime Node (axionia/). En Docker standalone,
  // c'est `/app`. On stocke dans `data/vitals/` (créé à la volée).
  return path.join(process.cwd(), "data", "vitals", `${todayUtcSlug()}.ndjson`);
}

let dirEnsured = false;
async function ensureDir(): Promise<void> {
  if (dirEnsured) return;
  await fs.mkdir(path.dirname(targetFile()), { recursive: true });
  dirEnsured = true;
}

async function writeNdjson(record: VitalsRecord): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify({ ...record, ts: Date.now() }) + "\n";
    await fs.appendFile(targetFile(), line, "utf8");
  } catch {
    // swallow
  }
}

const PRISMA_METRICS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB", "TBT"]);

function mapRating(rating: string | undefined): "good" | "needs_improvement" | "poor" | null {
  if (rating === "good") return "good";
  if (rating === "needs-improvement") return "needs_improvement";
  if (rating === "poor") return "poor";
  return null;
}

function canonicalUrl(record: VitalsRecord): string | null {
  // Priorité : `route` (pathname Next, déjà canonique). Sinon parser `href`.
  if (record.route && record.route.length > 0) return record.route.slice(0, 2048);
  if (record.href) {
    try {
      return new URL(record.href).pathname.slice(0, 2048);
    } catch {
      return null;
    }
  }
  return null;
}

async function writeWebVitalSample(record: VitalsRecord): Promise<void> {
  try {
    if (!PRISMA_METRICS.has(record.name)) return; // FID + autres ignorés
    const rating = mapRating(record.rating);
    if (rating === null) return; // rating absent → sample non exploitable pour alertes p75
    const url = canonicalUrl(record);
    if (url === null) return;

    await prisma.webVitalSample.create({
      data: {
        url,
        metric: record.name as "LCP" | "INP" | "CLS" | "FCP" | "TTFB" | "TBT",
        value: record.value,
        rating,
        navigationType: record.navigationType ?? null,
        // deviceType / userAgent / sessionId / pageType : enrichissement
        // V2 (Sprint 20) — exige côté client une collecte additionnelle.
      },
    });
  } catch {
    // swallow — l'audit trail ndjson reste la source primaire en cas de
    // panne DB. Le worker monitor passera silencieusement (samples partiels).
  }
}

export async function appendVitalsRecord(record: VitalsRecord): Promise<void> {
  // Fire-and-forget : pas de retry, pas de circuit breaker. Si l'I/O échoue
  // (disque plein, FS read-only, DB down), on perd l'event mais on ne casse
  // jamais l'UX — la route /api/vitals a déjà répondu 204 avant nous.
  // Les deux écritures tournent en parallèle, chacune protégée par son
  // propre swallow.
  await Promise.all([writeNdjson(record), writeWebVitalSample(record)]);
}

export const _internals = { canonicalUrl, mapRating, PRISMA_METRICS };
