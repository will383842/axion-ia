// Audit link graph BFS — P1-18 audit indexation 2026-05-18.
//
// Outil one-shot : crawl BFS depuis `/fr/` (depth max configurable),
// compare URLs reachable vs URLs présentes dans sitemap-index, output JSON
// report avec orphans (sitemap ∖ reachable) + dead-ends (reachable sans
// outbound links) + distribution click depth.

// Marker ES module — isolation namespace vs autres scripts dossier `scripts/`.
export {};
//
// Usage :
//   npx tsx scripts/audit-link-graph.ts [--depth=6] [--site=https://axion-ia.com] [--output=_AUDIT/link-graph-YYYY-MM-DD.json]
//
// Pas une fonctionnalité prod runtime. Pas de Playwright (lourd) — juste
// fetch + regex pour speed + portabilité. Suffisant pour HTML SSG/SSR Next 16.
//
// Coût : ~N requêtes HTTP origin (N = URLs reachable BFS). Bornage strict
// par depth + max-pages pour éviter abuse.

const DEFAULT_SITE_URL = "https://axion-ia.com";
const DEFAULT_DEPTH = 6;
const DEFAULT_MAX_PAGES = 500;
const USER_AGENT = "axion-ia-link-graph-audit-bot/1.0";

interface Args {
  site: string;
  depth: number;
  maxPages: number;
  output: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) opts[m[1]!] = m[2]!;
  }
  const today = new Date().toISOString().slice(0, 10);
  return {
    site: (opts.site ?? DEFAULT_SITE_URL).replace(/\/$/, ""),
    depth: Number.parseInt(opts.depth ?? String(DEFAULT_DEPTH), 10),
    maxPages: Number.parseInt(opts["max-pages"] ?? String(DEFAULT_MAX_PAGES), 10),
    output: opts.output ?? `_AUDIT/link-graph-${today}.json`,
  };
}

async function fetchText(url: string, timeoutMs = 10000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html") && !ct.includes("xml")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractInternalLinks(html: string, siteHost: string): string[] {
  const links = new Set<string>();
  const matches = html.matchAll(/<a[^>]+href=["']([^"']+)["']/g);
  for (const m of matches) {
    const href = m[1]!;
    if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:"))
      continue;
    if (href.startsWith("tel:") || href.startsWith("data:")) continue;
    try {
      const abs = new URL(href, `https://${siteHost}`);
      if (abs.host !== siteHost) continue;
      // Normalise : strip query/fragment for graph (gardent URL pattern stable).
      const normalized =
        `${abs.protocol}//${abs.host}${abs.pathname}`.replace(/\/$/, "") ||
        `${abs.protocol}//${abs.host}/`;
      links.add(normalized);
    } catch {
      // bad URL — skip
    }
  }
  return Array.from(links);
}

function parseSitemapIndex(xml: string): string[] {
  const locs: string[] = [];
  for (const m of xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g)) {
    const block = m[1] ?? "";
    const lm = block.match(/<loc>([^<]+)<\/loc>/);
    if (lm) locs.push(lm[1]!.trim());
  }
  return locs;
}

function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const block = m[1] ?? "";
    const lm = block.match(/<loc>([^<]+)<\/loc>/);
    if (lm) urls.push(lm[1]!.trim());
  }
  return urls;
}

async function collectAllSitemapUrls(siteUrl: string): Promise<string[]> {
  const indexXml = await fetchText(`${siteUrl}/sitemap-index.xml`);
  if (!indexXml) {
    console.warn(`[audit-link-graph] sitemap-index unreachable, returning empty`);
    return [];
  }
  const subSitemaps = parseSitemapIndex(indexXml);
  const allUrls = new Set<string>();
  for (const sub of subSitemaps) {
    const subXml = await fetchText(sub);
    if (!subXml) continue;
    for (const u of parseSitemapUrls(subXml)) {
      const norm = u.replace(/\/$/, "") || u;
      allUrls.add(norm);
    }
  }
  return Array.from(allUrls);
}

interface BfsResult {
  reachable: Map<string, number>;
  outboundCount: Map<string, number>;
}

async function bfsCrawl(siteUrl: string, maxDepth: number, maxPages: number): Promise<BfsResult> {
  const siteHost = new URL(siteUrl).host;
  const root = `${siteUrl}/fr`;
  const reachable = new Map<string, number>();
  reachable.set(root, 0);
  const queue: Array<{ url: string; depth: number }> = [{ url: root, depth: 0 }];
  const outboundCount = new Map<string, number>();

  let processed = 0;
  while (queue.length > 0 && processed < maxPages) {
    const { url, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    const html = await fetchText(url);
    processed++;

    if (!html) {
      outboundCount.set(url, 0);
      continue;
    }

    const links = extractInternalLinks(html, siteHost);
    outboundCount.set(url, links.length);

    for (const link of links) {
      if (!reachable.has(link)) {
        reachable.set(link, depth + 1);
        queue.push({ url: link, depth: depth + 1 });
      }
    }

    // Politesse origin : pause 100ms entre fetches pour ne pas saturer.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { reachable, outboundCount };
}

interface AuditReport {
  generatedAt: string;
  siteUrl: string;
  bfsDepthMax: number;
  bfsMaxPages: number;
  totalSitemapUrls: number;
  totalReachableBfs: number;
  orphans: string[];
  deadEnds: string[];
  reachableButNotInSitemap: string[];
  clickDepthDistribution: Record<string, number>;
}

function buildReport(
  siteUrl: string,
  depth: number,
  maxPages: number,
  sitemapUrls: string[],
  bfs: BfsResult,
): AuditReport {
  const sitemapSet = new Set(sitemapUrls);
  const reachableSet = new Set(bfs.reachable.keys());
  const orphans = sitemapUrls.filter((u) => !reachableSet.has(u));
  const deadEnds: string[] = [];
  for (const [url, count] of bfs.outboundCount) {
    if (count === 0) deadEnds.push(url);
  }
  const reachableButNotInSitemap = [...reachableSet].filter((u) => !sitemapSet.has(u));
  const dist: Record<string, number> = {};
  for (const [, d] of bfs.reachable) {
    const key = `depth_${d}`;
    dist[key] = (dist[key] ?? 0) + 1;
  }
  return {
    generatedAt: new Date().toISOString(),
    siteUrl,
    bfsDepthMax: depth,
    bfsMaxPages: maxPages,
    totalSitemapUrls: sitemapUrls.length,
    totalReachableBfs: reachableSet.size,
    orphans,
    deadEnds,
    reachableButNotInSitemap,
    clickDepthDistribution: dist,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(`[audit-link-graph] site=${args.site} depth=${args.depth} maxPages=${args.maxPages}`);

  console.log(`[audit-link-graph] fetching sitemap-index + sub-sitemaps...`);
  const sitemapUrls = await collectAllSitemapUrls(args.site);
  console.log(`[audit-link-graph] sitemap urls: ${sitemapUrls.length}`);

  console.log(`[audit-link-graph] BFS crawling from /fr...`);
  const bfs = await bfsCrawl(args.site, args.depth, args.maxPages);
  console.log(`[audit-link-graph] reachable: ${bfs.reachable.size}`);

  const report = buildReport(args.site, args.depth, args.maxPages, sitemapUrls, bfs);

  const { writeFile, mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, JSON.stringify(report, null, 2), "utf-8");

  console.log(`[audit-link-graph] report written: ${args.output}`);
  console.log(`  - orphans (sitemap ∖ reachable): ${report.orphans.length}`);
  console.log(`  - dead-ends: ${report.deadEnds.length}`);
  console.log(`  - reachable but not in sitemap: ${report.reachableButNotInSitemap.length}`);
  console.log(`  - click depth distribution:`, report.clickDepthDistribution);
}

void main();
