// P-303 — Persistance RUM Web Vitals en ndjson rotatif (V1 stockage local
// fichier, V2 Sprint 20 migration vers Postgres + dashboard /admin/pseo-stats).
//
// Format ndjson (1 record JSON par ligne) — choisi pour :
// - append-only safe en multi-thread Node (`fs.promises.appendFile`)
// - parsable par scripts/vitals-report.ts existant
// - import direct dans Postgres via `COPY ... FROM stdin` au moment du switch
//
// Fichier : `data/vitals/YYYY-MM-DD.ndjson` (rotation quotidienne par UTC date).
// Nettoyage : retention 30 j gérée Sprint 20 (cron). Pas de gros volume —
// 1 record ≈ 200 octets, ~5 events / visite, 50 K visites/mois → ~50 MB/mois.

import { promises as fs } from "node:fs";
import path from "node:path";

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

export async function appendVitalsRecord(record: VitalsRecord): Promise<void> {
  // Fire-and-forget : pas de retry, pas de circuit breaker. Si l'I/O échoue
  // (disque plein, FS read-only), on perd l'event mais on ne casse jamais
  // l'UX — la route /api/vitals a déjà répondu 204 avant nous.
  try {
    await ensureDir();
    const line = JSON.stringify({ ...record, ts: Date.now() }) + "\n";
    await fs.appendFile(targetFile(), line, "utf8");
  } catch {
    // swallow
  }
}
