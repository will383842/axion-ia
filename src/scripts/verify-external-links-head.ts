/**
 * VERIFY EXTERNAL LINKS — HEAD + paywall + robots.txt + Schema.org
 *
 * Usage :
 *   pnpm tsx src/scripts/verify-external-links-head.ts
 *
 * Vérifie pour chaque lien dans master.ts :
 *  1. HEAD request → status (active / 404 / deprecated / redirect_*)
 *  2. HTTPS (basé sur l'URL)
 *  3. Domaine concurrent (filtre dur déjà fait dans le catalogue)
 *  4. Paywall (GET partiel + keywords FR/EN)
 *  5. robots.txt destination autorise Googlebot ?
 *  6. Schema.org JSON-LD détecté sur la page (signal E-E-A-T)
 *
 * Output : `src/data/external-links/verification-status.json`
 *   { [linkId]: { status, lastCheckedAt, paywall, indexable, hasSchemaOrg } }
 * Helpers merge ces overrides au load de ALL_EXTERNAL_LINKS.
 *
 * Plus rapport markdown : `_AUDIT/EXTERNAL-LINKS-2026-05-22/verification-report.md`
 *
 * Sprint External Links Database 2026-05-22.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createConcurrencyLimiter } from "../server/clients/perplexity-search";
import { ALL_EXTERNAL_LINKS } from "../data/external-links/master";
import { isCompetitorDomain, PAYWALL_KEYWORDS } from "../data/external-links/types";
import type { ExternalLinkStatus } from "../data/external-links/types";

const CONCURRENCY = 30;
const HEAD_TIMEOUT_MS = 10_000;
const GET_PARTIAL_TIMEOUT_MS = 8_000;
const PAGE_FETCH_MAX_BYTES = 100_000;

const OUTPUT_JSON = resolve(process.cwd(), "src/data/external-links/verification-status.json");
const REPORT_MD = resolve(process.cwd(), "_AUDIT/EXTERNAL-LINKS-2026-05-22/verification-report.md");

interface VerificationOverride {
  status: ExternalLinkStatus;
  lastCheckedAt: string;
  paywall: boolean;
  indexable: boolean;
  hasSchemaOrg: boolean;
  isCompetitor: boolean;
  httpStatus: number;
}

// ============================================================
// Sub-checks
// ============================================================

async function checkHead(url: string): Promise<{ status: ExternalLinkStatus; httpStatus: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
    if (res.ok) return { status: "active", httpStatus: res.status };
    if (res.status === 404 || res.status === 410) return { status: "404", httpStatus: res.status };
    if (res.status >= 300 && res.status < 400) {
      return { status: "redirect_acceptable", httpStatus: res.status };
    }
    if (res.status >= 500) return { status: "deprecated", httpStatus: res.status };
    return { status: "deprecated", httpStatus: res.status };
  } catch (err) {
    // certains serveurs rejettent HEAD → fallback GET
    if (err instanceof Error && err.name !== "AbortError") {
      try {
        const res = await fetch(url, { method: "GET", redirect: "follow" });
        if (res.ok) return { status: "active", httpStatus: res.status };
        return { status: "deprecated", httpStatus: res.status };
      } catch {
        return { status: "deprecated", httpStatus: 0 };
      }
    }
    return { status: "deprecated", httpStatus: 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPartial(url: string, maxBytes: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GET_PARTIAL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: `bytes=0-${maxBytes}` },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok && res.status !== 206) return "";
    const reader = res.body?.getReader();
    if (!reader) return "";
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let received = 0;
    let text = "";
    while (received < maxBytes) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      received += value.byteLength;
      if (received >= maxBytes) break;
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
      if (!res.ok) return true; // pas de robots.txt = indexable par défaut
      const txt = await res.text();
      const pathName = u.pathname || "/";
      // Parsing minimaliste : cherche bloc User-agent: Googlebot OU *
      const lines = txt.split(/\r?\n/);
      let inRelevantBlock = false;
      const disallowedPaths: string[] = [];
      for (const lineRaw of lines) {
        const line = lineRaw.split("#")[0]?.trim() ?? "";
        if (!line) {
          inRelevantBlock = false;
          continue;
        }
        const m = line.match(/^User-agent:\s*(.+)$/i);
        if (m) {
          inRelevantBlock = m[1]?.trim() === "*" || /googlebot/i.test(m[1] ?? "");
          continue;
        }
        if (inRelevantBlock) {
          const d = line.match(/^Disallow:\s*(.*)$/i);
          if (d && d[1]) disallowedPaths.push(d[1].trim());
        }
      }
      for (const p of disallowedPaths) {
        if (p === "") continue;
        if (p === "/" || pathName.startsWith(p)) return false;
      }
      return true;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return true; // fail-open
  }
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const startTs = Date.now();
  console.log(`[verify] ${ALL_EXTERNAL_LINKS.length} liens à vérifier`);
  console.log(`[verify] Concurrence : ${CONCURRENCY} | timeout HEAD : ${HEAD_TIMEOUT_MS}ms`);

  const overrides: Record<string, VerificationOverride> = {};
  const limit = createConcurrencyLimiter(CONCURRENCY);
  let done = 0;

  const stats = {
    active: 0,
    redirect_acceptable: 0,
    "404": 0,
    deprecated: 0,
    paywallDetected: 0,
    notIndexable: 0,
    hasSchemaOrg: 0,
    competitorDetected: 0,
  };

  await Promise.all(
    ALL_EXTERNAL_LINKS.map((link) =>
      limit(async () => {
        const nowIso = new Date().toISOString();
        const { status, httpStatus } = await checkHead(link.url);
        let paywall = link.paywall;
        let indexable = link.indexable;
        let hasSchemaOrg = link.hasSchemaOrg ?? false;

        if (status === "active" || status === "redirect_acceptable") {
          const html = await fetchPartial(link.url, PAGE_FETCH_MAX_BYTES);
          paywall = detectPaywall(html);
          hasSchemaOrg = detectSchemaOrg(html);
          indexable = await checkRobotsTxt(link.url);
        }

        let competitor = link.isCompetitor;
        try {
          competitor = isCompetitorDomain(new URL(link.url).hostname);
        } catch {
          // garder valeur existante
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

        // stats
        const statusKey = (status === "404" ? "404" : status) as keyof typeof stats;
        if (statusKey in stats) {
          const statsRec = stats as Record<string, number>;
          statsRec[statusKey] = (statsRec[statusKey] ?? 0) + 1;
        }
        if (paywall) stats.paywallDetected += 1;
        if (!indexable) stats.notIndexable += 1;
        if (hasSchemaOrg) stats.hasSchemaOrg += 1;
        if (competitor) stats.competitorDetected += 1;

        done += 1;
        if (done % 10 === 0) {
          process.stdout.write(
            `  [${done}/${ALL_EXTERNAL_LINKS.length}] ${status} : ${link.url}\n`,
          );
        }
      }),
    ),
  );

  writeFileSync(OUTPUT_JSON, JSON.stringify(overrides, null, 2), "utf-8");
  const durationMs = Date.now() - startTs;

  // Rapport markdown
  const total = ALL_EXTERNAL_LINKS.length;
  const pct = (n: number) => (total > 0 ? ((n / total) * 100).toFixed(1) : "0.0");
  const problemLinks = ALL_EXTERNAL_LINKS.filter((l) => {
    const o = overrides[l.id];
    return (
      o &&
      (o.status === "404" ||
        o.status === "deprecated" ||
        o.paywall ||
        !o.indexable ||
        o.isCompetitor)
    );
  });

  const report = [
    `# Verification Report — External Links Database`,
    ``,
    `Date : ${new Date().toISOString()}`,
    `Sprint : External Links Database 2026-05-22`,
    `Durée : ${(durationMs / 1000 / 60).toFixed(1)} min`,
    `Total liens vérifiés : ${total}`,
    ``,
    `## Stats agrégées`,
    ``,
    `| Statut | Count | % |`,
    `|---|---:|---:|`,
    `| active | ${stats.active} | ${pct(stats.active)}% |`,
    `| redirect_acceptable | ${stats.redirect_acceptable} | ${pct(stats.redirect_acceptable)}% |`,
    `| 404 | ${stats["404"]} | ${pct(stats["404"])}% |`,
    `| deprecated (timeout/5xx) | ${stats.deprecated} | ${pct(stats.deprecated)}% |`,
    `| paywall détecté | ${stats.paywallDetected} | ${pct(stats.paywallDetected)}% |`,
    `| non indexable robots.txt | ${stats.notIndexable} | ${pct(stats.notIndexable)}% |`,
    `| Schema.org détecté | ${stats.hasSchemaOrg} | ${pct(stats.hasSchemaOrg)}% |`,
    `| concurrent détecté | ${stats.competitorDetected} | ${pct(stats.competitorDetected)}% |`,
    ``,
    `## Liens problématiques (${problemLinks.length})`,
    ``,
    ...problemLinks.slice(0, 100).map((l) => {
      const o = overrides[l.id];
      if (!o) return `- ${l.id}`;
      const issues: string[] = [];
      if (o.status === "404") issues.push("404");
      if (o.status === "deprecated") issues.push(`deprecated (HTTP ${o.httpStatus})`);
      if (o.paywall) issues.push("paywall");
      if (!o.indexable) issues.push("non-indexable");
      if (o.isCompetitor) issues.push("CONCURRENT");
      return `- ${l.id} | ${l.url} → ${issues.join(", ")}`;
    }),
    ``,
    `## Actions Will`,
    ``,
    `1. Review les ${problemLinks.length} liens problématiques ci-dessus`,
    `2. Décider : virer / patcher l'URL / accepter (ex : paywall acceptable pour HBR)`,
    `3. Re-lancer ce script après edits`,
    ``,
    `Status JSON : \`src/data/external-links/verification-status.json\``,
  ].join("\n");
  writeFileSync(REPORT_MD, report, "utf-8");

  console.log("");
  console.log("=".repeat(70));
  console.log(`[verify] active : ${stats.active}/${total} (${pct(stats.active)}%)`);
  console.log(`[verify] 404+deprecated : ${stats["404"] + stats.deprecated}/${total}`);
  console.log(`[verify] paywall : ${stats.paywallDetected}`);
  console.log(`[verify] non-indexable : ${stats.notIndexable}`);
  console.log(`[verify] hasSchemaOrg : ${stats.hasSchemaOrg}`);
  console.log(`[verify] concurrent : ${stats.competitorDetected}`);
  console.log(`[verify] Durée : ${(durationMs / 1000 / 60).toFixed(1)} min`);
  console.log(`[verify] Status JSON : ${OUTPUT_JSON}`);
  console.log(`[verify] Rapport : ${REPORT_MD}`);
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("[verify] FATAL :", err);
  process.exit(1);
});
