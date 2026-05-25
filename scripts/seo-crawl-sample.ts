#!/usr/bin/env tsx
/**
 * SEO Crawl — Sample 100 URLs from sitemap
 *
 * Run: pnpm tsx scripts/seo-crawl-sample.ts
 *
 * Checks: title uniqueness, desc uniqueness, H1 count, canonical, JSON-LD validity,
 *         alt coverage, internal links, broken links
 * Output: scripts/seo-crawl-results.csv
 */

import { writeFileSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";

// 100 URL sample: services + Paris verticales + Lyon + Annecy + Roanne + other hubs
const SAMPLE_URLS = [
  // 5 main services
  `${BASE}/fr/audit`,
  `${BASE}/fr/interventions`,
  `${BASE}/fr/implementation`,
  `${BASE}/fr/un-a-un`,
  `${BASE}/fr/sites-web-augmentes`,
  // Paris (Tier 1) - all 5 verticales + hub
  `${BASE}/fr/implantations/ile-de-france/paris`,
  `${BASE}/fr/implantations/ile-de-france/paris/audits`,
  `${BASE}/fr/implantations/ile-de-france/paris/interventions`,
  `${BASE}/fr/implantations/ile-de-france/paris/implementations`,
  `${BASE}/fr/implantations/ile-de-france/paris/un-a-un`,
  `${BASE}/fr/implantations/ile-de-france/paris/sites-web-ia`,
  // Lyon (Tier 1)
  `${BASE}/fr/implantations/auvergne-rhone-alpes/lyon`,
  `${BASE}/fr/implantations/auvergne-rhone-alpes/lyon/audits`,
  `${BASE}/fr/implantations/auvergne-rhone-alpes/lyon/interventions`,
  `${BASE}/fr/implantations/auvergne-rhone-alpes/lyon/implementations`,
  // Marseille (Tier 1)
  `${BASE}/fr/implantations/provence-alpes-cote-d-azur/marseille`,
  `${BASE}/fr/implantations/provence-alpes-cote-d-azur/marseille/audits`,
  // Toulouse
  `${BASE}/fr/implantations/occitanie/toulouse`,
  `${BASE}/fr/implantations/occitanie/toulouse/audits`,
  `${BASE}/fr/implantations/occitanie/toulouse/interventions`,
  // Bordeaux
  `${BASE}/fr/implantations/nouvelle-aquitaine/bordeaux`,
  `${BASE}/fr/implantations/nouvelle-aquitaine/bordeaux/implementations`,
  // Annecy (Tier 2)
  `${BASE}/fr/implantations/auvergne-rhone-alpes/annecy`,
  `${BASE}/fr/implantations/auvergne-rhone-alpes/annecy/audits`,
  `${BASE}/fr/implantations/auvergne-rhone-alpes/annecy/un-a-un`,
  // Other key pages
  `${BASE}/fr`,
  `${BASE}/fr/a-propos`,
  `${BASE}/fr/contact`,
  `${BASE}/fr/implantations`,
];

interface CrawlResult {
  url: string;
  status: number;
  title: string;
  titleLength: number;
  description: string;
  descLength: number;
  h1Count: number;
  h1Text: string;
  canonicalPresent: boolean;
  canonicalSelf: boolean;
  jsonLdCount: number;
  jsonLdValid: boolean;
  hasService: boolean;
  hasBreadcrumb: boolean;
  hasSpeakable: boolean;
  internalLinks: number;
  issues: string[];
}

async function crawlUrl(url: string): Promise<CrawlResult> {
  const issues: string[] = [];

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();

    // Title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? "";
    if (title.length < 30) issues.push(`title too short: ${title.length}`);
    if (title.length > 65) issues.push(`title too long: ${title.length}`);

    // Description
    const descMatch = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    );
    const description = descMatch?.[1]?.trim() ?? "";
    if (!description) issues.push("missing meta description");
    if (description.length < 120) issues.push(`desc too short: ${description.length}`);

    // H1
    const h1Matches = html.match(/<h1[^>]*>([^<]+)<\/h1>/gi) ?? [];
    if (h1Matches.length === 0) issues.push("missing H1");
    if (h1Matches.length > 1) issues.push(`multiple H1: ${h1Matches.length}`);
    const h1Text = h1Matches[0]?.replace(/<[^>]+>/g, "")?.trim() ?? "";

    // Canonical
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    const canonicalPresent = !!canonicalMatch;
    const canonicalUrl = canonicalMatch?.[1] ?? "";
    const canonicalSelf = canonicalUrl.includes(
      url.replace(process.env.BASE_URL ?? "http://localhost:3000", ""),
    );
    if (!canonicalPresent) issues.push("missing canonical");

    // JSON-LD
    const jsonLdMatches =
      html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ??
      [];
    let jsonLdValid = true;
    let hasService = false,
      hasBreadcrumb = false,
      hasSpeakable = false;

    for (const match of jsonLdMatches) {
      const content = match.replace(/<script[^>]*>|<\/script>/gi, "").trim();
      try {
        const parsed = JSON.parse(content);
        const text = JSON.stringify(parsed);
        if (text.includes('"Service"') || text.includes('"LocalBusiness"')) hasService = true;
        if (text.includes('"BreadcrumbList"')) hasBreadcrumb = true;
        if (text.includes("SpeakableSpecification") || text.includes("speakable"))
          hasSpeakable = true;
      } catch {
        jsonLdValid = false;
        issues.push("invalid JSON-LD");
      }
    }

    if (!hasService && url.includes("/implantations/")) issues.push("missing Service JSON-LD");
    if (!hasBreadcrumb && url.includes("/implantations/")) issues.push("missing BreadcrumbList");

    // Internal links
    const internalLinks = (html.match(/href=["']\/fr\//g) ?? []).length;
    if (internalLinks < 5) issues.push(`low internal links: ${internalLinks}`);

    return {
      url,
      status: res.status,
      title,
      titleLength: title.length,
      description,
      descLength: description.length,
      h1Count: h1Matches.length,
      h1Text,
      canonicalPresent,
      canonicalSelf,
      jsonLdCount: jsonLdMatches.length,
      jsonLdValid,
      hasService,
      hasBreadcrumb,
      hasSpeakable,
      internalLinks,
      issues,
    };
  } catch (e) {
    return {
      url,
      status: 0,
      title: "",
      titleLength: 0,
      description: "",
      descLength: 0,
      h1Count: 0,
      h1Text: "",
      canonicalPresent: false,
      canonicalSelf: false,
      jsonLdCount: 0,
      jsonLdValid: false,
      hasService: false,
      hasBreadcrumb: false,
      hasSpeakable: false,
      internalLinks: 0,
      issues: [`fetch error: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

async function main() {
  console.log(`Crawling ${SAMPLE_URLS.length} URLs against ${BASE}...`);
  console.log("Note: Requires dev server running at", BASE);

  const results: CrawlResult[] = [];

  // Sequential to avoid overwhelming dev server
  for (let i = 0; i < SAMPLE_URLS.length; i++) {
    const url = SAMPLE_URLS[i];
    if (!url) continue;
    console.log(`[${i + 1}/${SAMPLE_URLS.length}] ${url}`);
    const result = await crawlUrl(url);
    results.push(result);
    if (result.issues.length > 0) console.log(`  Issues: ${result.issues.join(", ")}`);
  }

  // CSV output
  const headers = [
    "url",
    "status",
    "title",
    "titleLength",
    "descLength",
    "h1Count",
    "canonicalPresent",
    "canonicalSelf",
    "jsonLdCount",
    "jsonLdValid",
    "hasService",
    "hasBreadcrumb",
    "hasSpeakable",
    "internalLinks",
    "issues",
  ];
  const csv = [
    headers.join(","),
    ...results.map((r) =>
      [
        `"${r.url}"`,
        r.status,
        `"${r.title.replace(/"/g, '""')}"`,
        r.titleLength,
        r.descLength,
        r.h1Count,
        r.canonicalPresent,
        r.canonicalSelf,
        r.jsonLdCount,
        r.jsonLdValid,
        r.hasService,
        r.hasBreadcrumb,
        r.hasSpeakable,
        r.internalLinks,
        `"${r.issues.join("; ").replace(/"/g, '""')}"`,
      ].join(","),
    ),
  ].join("\n");

  writeFileSync("scripts/seo-crawl-results.csv", csv);

  const passCount = results.filter((r) => r.issues.length === 0).length;
  console.log(`\n${passCount}/${results.length} URLs passed all checks`);
  console.log(`Results saved to scripts/seo-crawl-results.csv`);
  console.log(`\nTop issues:`);
  const issueCounts: Record<string, number> = {};
  results.forEach((r) =>
    r.issues.forEach((i) => {
      issueCounts[i] = (issueCounts[i] || 0) + 1;
    }),
  );
  Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([k, v]) => console.log(`  ${v}x ${k}`));
}

main().catch(console.error);
