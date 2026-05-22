/**
 * External Links Monitor — Sprint External Links Database 2026-05-22.
 *
 * Cron mensuel : 1er du mois 03:00 UTC.
 * Re-vérifie tous les liens du catalogue ALL_EXTERNAL_LINKS (HEAD + paywall +
 * robots.txt + Schema.org) et écrit le résultat dans :
 *   `src/data/external-links/verification-status.json` (overrides static)
 *
 * Action si > 5 % de liens cassés (404 / deprecated) :
 *   - Alerte Telegram + log warn
 *   - Update ContentGenConfig clé `external_links_last_check` (audit trail)
 *
 * Gate sur env var `EXTERNAL_LINKS_MONITOR_ENABLED` (default false).
 * → Will active manuellement après le premier seed full.
 *
 * Pourquoi cron 1er mois 03:00 UTC ?
 * - 03:00 UTC = 04:00 CET = creux trafic
 * - Mensuel = équilibre fraîcheur catalogue vs charge serveurs destination
 * - 1er du mois aligné avec reset monthUsageCount (table ExternalLinkUsage)
 */

import { Worker, type Job } from "bullmq";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { ALL_EXTERNAL_LINKS } from "@/data/external-links/master";
import {
  isCompetitorDomain,
  PAYWALL_KEYWORDS,
  type ExternalLinkStatus,
} from "@/data/external-links/types";

export const QUEUE_NAME = "external-links-monitor";

const CONCURRENCY = 30;
const HEAD_TIMEOUT_MS = 10_000;
const GET_PARTIAL_TIMEOUT_MS = 8_000;
const PAGE_FETCH_MAX_BYTES = 50_000;
const BROKEN_PERCENT_ALERT_THRESHOLD = 0.05; // 5 %

const OUTPUT_JSON = resolve(process.cwd(), "src/data/external-links/verification-status.json");

interface VerificationOverride {
  readonly status: ExternalLinkStatus;
  readonly lastCheckedAt: string;
  readonly paywall: boolean;
  readonly indexable: boolean;
  readonly hasSchemaOrg: boolean;
  readonly isCompetitor: boolean;
  readonly httpStatus: number;
}

export interface MonitorRunStats {
  readonly analyzedAt: string;
  readonly totalLinks: number;
  readonly active: number;
  readonly redirectAcceptable: number;
  readonly broken: number; // 404 + deprecated
  readonly paywall: number;
  readonly notIndexable: number;
  readonly hasSchemaOrg: number;
  readonly competitor: number;
  readonly durationMs: number;
}

// ============================================================
// Sub-checks (réutilisés depuis verify-external-links-head.ts)
// ============================================================

async function checkHead(url: string): Promise<{ status: ExternalLinkStatus; httpStatus: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    if (res.ok) return { status: "active", httpStatus: res.status };
    if (res.status === 404 || res.status === 410) {
      return { status: "404", httpStatus: res.status };
    }
    if (res.status >= 300 && res.status < 400) {
      return { status: "redirect_acceptable", httpStatus: res.status };
    }
    return { status: "deprecated", httpStatus: res.status };
  } catch {
    return { status: "deprecated", httpStatus: 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPartial(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GET_PARTIAL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: `bytes=0-${PAGE_FETCH_MAX_BYTES}` },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok && res.status !== 206) return "";
    const reader = res.body?.getReader();
    if (!reader) return "";
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let received = 0;
    let text = "";
    while (received < PAGE_FETCH_MAX_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      received += value.byteLength;
    }
    return text;
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function detectPaywall(html: string): boolean {
  if (!html) return false;
  const lower = html.toLowerCase();
  return PAYWALL_KEYWORDS.some((kw) => lower.includes(kw));
}

function detectSchemaOrg(html: string): boolean {
  if (!html) return false;
  return /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
}

async function checkRobotsTxt(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(robotsUrl, { signal: controller.signal });
      if (!res.ok) return true;
      const txt = await res.text();
      const pathName = u.pathname || "/";
      const lines = txt.split(/\r?\n/);
      let inBlock = false;
      const disallowed: string[] = [];
      for (const lineRaw of lines) {
        const line = lineRaw.split("#")[0]?.trim() ?? "";
        if (!line) {
          inBlock = false;
          continue;
        }
        const m = line.match(/^User-agent:\s*(.+)$/i);
        if (m) {
          inBlock = m[1]?.trim() === "*" || /googlebot/i.test(m[1] ?? "");
          continue;
        }
        if (inBlock) {
          const d = line.match(/^Disallow:\s*(.*)$/i);
          if (d && d[1]) disallowed.push(d[1].trim());
        }
      }
      for (const p of disallowed) {
        if (p === "") continue;
        if (p === "/" || pathName.startsWith(p)) return false;
      }
      return true;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return true;
  }
}

// ============================================================
// Limiteur de concurrence inline
// ============================================================

function createLimiter(maxConcurrent: number) {
  const queue: Array<() => void> = [];
  let active = 0;
  const next = () => {
    if (active >= maxConcurrent) return;
    const job = queue.shift();
    if (job) {
      active += 1;
      job();
    }
  };
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then((v) => {
            active -= 1;
            resolve(v);
            next();
          })
          .catch((e) => {
            active -= 1;
            reject(e);
            next();
          });
      });
      next();
    });
  };
}

// ============================================================
// Main job processor
// ============================================================

export async function runExternalLinksMonitor(): Promise<MonitorRunStats> {
  const startTs = Date.now();
  const stats = {
    active: 0,
    redirectAcceptable: 0,
    broken: 0,
    paywall: 0,
    notIndexable: 0,
    hasSchemaOrg: 0,
    competitor: 0,
  };

  const overrides: Record<string, VerificationOverride> = {
    _meta: {
      lastFullScanAt: new Date().toISOString(),
      scriptVersion: "1.0-worker",
      note: "Overrides écrits par external-links-monitor-worker (cron mensuel).",
    } as unknown as VerificationOverride,
  };

  const limit = createLimiter(CONCURRENCY);

  await Promise.all(
    ALL_EXTERNAL_LINKS.map((link) =>
      limit(async () => {
        const nowIso = new Date().toISOString();
        const { status, httpStatus } = await checkHead(link.url);
        let paywall = link.paywall;
        let indexable = link.indexable;
        let hasSchemaOrg = link.hasSchemaOrg ?? false;

        if (status === "active" || status === "redirect_acceptable") {
          const html = await fetchPartial(link.url);
          paywall = detectPaywall(html);
          hasSchemaOrg = detectSchemaOrg(html);
          indexable = await checkRobotsTxt(link.url);
        }

        let competitor = link.isCompetitor;
        try {
          competitor = isCompetitorDomain(new URL(link.url).hostname);
        } catch {
          /* keep value */
        }

        overrides[link.id] = {
          status,
          lastCheckedAt: nowIso,
          paywall,
          indexable,
          hasSchemaOrg,
          isCompetitor: competitor,
          httpStatus,
        };

        if (status === "active") stats.active += 1;
        else if (status === "redirect_acceptable") stats.redirectAcceptable += 1;
        else stats.broken += 1;
        if (paywall) stats.paywall += 1;
        if (!indexable) stats.notIndexable += 1;
        if (hasSchemaOrg) stats.hasSchemaOrg += 1;
        if (competitor) stats.competitor += 1;
      }),
    ),
  );

  // Persist overrides JSON (commit géré par Will manuellement post-run)
  writeFileSync(OUTPUT_JSON, JSON.stringify(overrides, null, 2), "utf-8");

  const durationMs = Date.now() - startTs;
  const total = ALL_EXTERNAL_LINKS.length;
  const brokenPercent = total > 0 ? stats.broken / total : 0;

  const runStats: MonitorRunStats = {
    analyzedAt: new Date().toISOString(),
    totalLinks: total,
    active: stats.active,
    redirectAcceptable: stats.redirectAcceptable,
    broken: stats.broken,
    paywall: stats.paywall,
    notIndexable: stats.notIndexable,
    hasSchemaOrg: stats.hasSchemaOrg,
    competitor: stats.competitor,
    durationMs,
  };

  // Audit trail (best-effort)
  try {
    const jsonValue = JSON.parse(JSON.stringify(runStats)) as Record<string, unknown>;
    await prisma.contentGenConfig.upsert({
      where: { key: "external_links_last_check" },
      create: {
        key: "external_links_last_check",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: jsonValue as any,
      },
      update: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: jsonValue as any,
      },
    });
  } catch (err) {
    console.warn(
      "[external-links-monitor] ContentGenConfig upsert failed (non-blocking):",
      err instanceof Error ? err.message : String(err),
    );
  }

  // Alerte Telegram si > 5 % broken
  if (brokenPercent > BROKEN_PERCENT_ALERT_THRESHOLD) {
    try {
      await sendTelegram({
        tag: "MONITORING",
        body:
          `⚠️ External Links Monitor — ${stats.broken}/${total} liens cassés ` +
          `(${(brokenPercent * 100).toFixed(1)}%, seuil ${BROKEN_PERCENT_ALERT_THRESHOLD * 100}%)\n` +
          `Voir /content-gen/external-links pour review.`,
      });
    } catch (err) {
      console.warn(
        "[external-links-monitor] Telegram alert failed (non-blocking):",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    JSON.stringify({
      event: "external_links_monitor_run",
      ...runStats,
      brokenPercent: brokenPercent.toFixed(4),
    }),
  );

  return runStats;
}

// ============================================================
// Worker bootstrap
// ============================================================

let workerInstance: Worker | null = null;

export function startExternalLinksMonitorWorker(): Worker {
  if (workerInstance) return workerInstance;
  if (process.env.EXTERNAL_LINKS_MONITOR_ENABLED !== "true") {
    console.log(
      "[external-links-monitor] EXTERNAL_LINKS_MONITOR_ENABLED!=true → worker NOT started",
    );
    throw new Error("EXTERNAL_LINKS_MONITOR_ENABLED is not true");
  }
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set");

  workerInstance = new Worker(
    QUEUE_NAME,
    async (_job: Job): Promise<MonitorRunStats> => {
      return runExternalLinksMonitor();
    },
    {
      connection: { url: redisUrl },
      concurrency: 1, // 1 run global à la fois (le job lui-même parallélise 30)
    },
  );

  workerInstance.on("failed", (job, err) => {
    captureWorkerError("external-links-monitor", QUEUE_NAME, job, err);
  });

  console.log("[external-links-monitor] worker started");
  return workerInstance;
}
