#!/usr/bin/env tsx
/**
 * QA Hub Villes — Parité structure T1↔T3 + check SEO/AEO/GEO/Speakable/Breadcrumb
 * + détection duplicate content potentiel.
 *
 * Compare le rendu HTML de 5 villes par tier (TS T1, TS T2, DB T3) et vérifie
 * que chaque page contient :
 * - 5 cards services (Audit IA, Formations, Implémentation, 1-to-1, Sites web)
 * - JSON-LD : Service, Place, BreadcrumbList, ItemList, AggregateOffer, ImageObject
 * - Speakable (SpeakableSpecification ou data-speakable-hero)
 * - Breadcrumbs visuelles
 * - Canonical
 * - Robots index (pas noindex)
 *
 * Détecte duplicate via similarité MD5 sur le contenu hub (sans body unique).
 *
 * Usage : pnpm tsx scripts/qa-villes-hub-parite.ts [--base-url=https://axion-ia.com]
 */

import { createHash } from "node:crypto";

const BASE_URL = process.argv.find((a) => a.startsWith("--base-url="))?.split("=")[1] ??
  "https://axion-ia.com";

interface QaResult {
  url: string;
  tier: string;
  httpStatus: number;
  hasH1: boolean;
  h1Contains: string | null;
  hasFiveCards: boolean;
  cardsLabels: string[];
  hasJsonLdService: boolean;
  hasJsonLdPlace: boolean;
  hasJsonLdBreadcrumb: boolean;
  hasJsonLdItemList: boolean;
  hasJsonLdAggregateOffer: boolean;
  hasJsonLdImageObject: boolean;
  hasJsonLdFaqPage: boolean;
  hasSpeakable: boolean;
  hasCanonical: boolean;
  isIndexable: boolean;
  contentHash: string; // signature des sections "stables" pour duplicate detection
  errors: string[];
}

async function fetchHtml(url: string): Promise<{ status: number; html: string }> {
  const res = await fetch(url, { redirect: "follow" });
  const html = await res.text();
  return { status: res.status, html };
}

function extractJsonLd(html: string): unknown[] {
  const scripts: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1]!);
      if (Array.isArray((parsed as { "@graph"?: unknown[] })["@graph"])) {
        scripts.push(...((parsed as { "@graph": unknown[] })["@graph"]));
      } else {
        scripts.push(parsed);
      }
    } catch {
      // skip malformed
    }
  }
  return scripts;
}

function hasType(jsonLds: unknown[], type: string): boolean {
  return jsonLds.some((j) => {
    const t = (j as { "@type"?: string | string[] })["@type"];
    if (Array.isArray(t)) return t.includes(type);
    return t === type;
  });
}

async function analyzeUrl(url: string, tier: string): Promise<QaResult> {
  const errors: string[] = [];
  let httpStatus = 0;
  let html = "";
  try {
    const res = await fetchHtml(url);
    httpStatus = res.status;
    html = res.html;
  } catch (err) {
    errors.push(`fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return {
      url,
      tier,
      httpStatus,
      hasH1: false,
      h1Contains: null,
      hasFiveCards: false,
      cardsLabels: [],
      hasJsonLdService: false,
      hasJsonLdPlace: false,
      hasJsonLdBreadcrumb: false,
      hasJsonLdItemList: false,
      hasJsonLdAggregateOffer: false,
      hasJsonLdImageObject: false,
      hasJsonLdFaqPage: false,
      hasSpeakable: false,
      hasCanonical: false,
      isIndexable: false,
      contentHash: "",
      errors,
    };
  }

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const h1Content = h1Match ? h1Match[1]!.replace(/<[^>]+>/g, "").trim() : null;

  // 5 cards labels attendus
  const expectedCards = [
    "Audit IA",
    "Formations et interventions sur site",
    "Implémentation IA",
    "Accompagnement 1-to-1",
    "Sites web augmentés IA",
  ];
  const foundCards = expectedCards.filter((label) => html.includes(label));

  const jsonLds = extractJsonLd(html);

  const hasJsonLdService = hasType(jsonLds, "Service");
  const hasJsonLdPlace = hasType(jsonLds, "Place");
  const hasJsonLdBreadcrumb = hasType(jsonLds, "BreadcrumbList");
  const hasJsonLdItemList = hasType(jsonLds, "ItemList");
  const hasJsonLdAggregateOffer = hasType(jsonLds, "AggregateOffer");
  const hasJsonLdImageObject = hasType(jsonLds, "ImageObject");
  const hasJsonLdFaqPage = hasType(jsonLds, "FAQPage");

  const hasSpeakable =
    html.includes("SpeakableSpecification") ||
    html.includes('"speakable"') ||
    html.includes("data-speakable-hero");

  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/);
  const hasCanonical = !!canonicalMatch;

  const robotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/);
  const isIndexable = !robotsMatch || !robotsMatch[1]!.toLowerCase().includes("noindex");

  // ContentHash = signature des sections IDENTIQUES entre villes (sans le contenu unique)
  // On hashe le HTML SANS les variables ville (h1, pitch, ecosystem, FAQ, services context)
  // Si 2 villes ont le même contentHash → c'est un duplicate suspect.
  // Approche : on prend la balise <ul class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"> (5 cards)
  const cardsBlockMatch = html.match(
    /<ul[^>]*class="grid grid-cols-1 gap-5[^"]*"[^>]*>([\s\S]*?)<\/ul>/,
  );
  const cardsBlock = cardsBlockMatch ? cardsBlockMatch[1]! : "";
  const contentHash = createHash("md5").update(cardsBlock).digest("hex").slice(0, 12);

  return {
    url,
    tier,
    httpStatus,
    hasH1: !!h1Content,
    h1Contains: h1Content,
    hasFiveCards: foundCards.length === 5,
    cardsLabels: foundCards,
    hasJsonLdService,
    hasJsonLdPlace,
    hasJsonLdBreadcrumb,
    hasJsonLdItemList,
    hasJsonLdAggregateOffer,
    hasJsonLdImageObject,
    hasJsonLdFaqPage,
    hasSpeakable,
    hasCanonical,
    isIndexable,
    contentHash,
    errors,
  };
}

async function main() {
  // Cibles : 3 villes par tier (TS T1, TS T2, DB-T3-promoted)
  const urls: ReadonlyArray<{ url: string; tier: string }> = [
    // T1 (TS gold standard)
    { url: `${BASE_URL}/fr/implantations/ile-de-france/paris`, tier: "T1-TS" },
    { url: `${BASE_URL}/fr/implantations/auvergne-rhone-alpes/lyon`, tier: "T1-TS" },
    { url: `${BASE_URL}/fr/implantations/provence-alpes-cote-d-azur/marseille`, tier: "T1-TS" },
    // T2 (TS gold standard)
    { url: `${BASE_URL}/fr/implantations/ile-de-france/montreuil`, tier: "T2-TS" },
    { url: `${BASE_URL}/fr/implantations/hauts-de-france/lille`, tier: "T2-TS" },
    // T3 (DB-promoted TS)
    { url: `${BASE_URL}/fr/implantations/ile-de-france/champigny-sur-marne`, tier: "T3-DB" },
    { url: `${BASE_URL}/fr/implantations/ile-de-france/saint-maur-des-fosses`, tier: "T3-DB" },
    { url: `${BASE_URL}/fr/implantations/ile-de-france/levallois-perret`, tier: "T3-DB" },
    // T3 stub (should be noindex)
    { url: `${BASE_URL}/fr/implantations/hauts-de-france/lestrem`, tier: "T4-STUB" },
  ];

  const results: QaResult[] = [];
  for (const u of urls) {
    console.log(`[qa] Fetching ${u.url}…`);
    results.push(await analyzeUrl(u.url, u.tier));
  }

  console.log("\n=== QA HUB VILLES — PARITÉ + SEO ===\n");
  for (const r of results) {
    const status = r.httpStatus === 200 ? "✅ 200" : `❌ ${r.httpStatus}`;
    console.log(`${r.tier} | ${r.url.replace(BASE_URL, "")} | ${status}`);
    console.log(`  H1: ${r.h1Contains?.slice(0, 80) ?? "MISSING"}`);
    console.log(`  Cards 5/5: ${r.hasFiveCards ? "✅" : `❌ ${r.cardsLabels.length}/5`}`);
    console.log(
      `  JSON-LD: Service=${b(r.hasJsonLdService)} Place=${b(r.hasJsonLdPlace)} Breadcrumb=${b(r.hasJsonLdBreadcrumb)} ItemList=${b(r.hasJsonLdItemList)} AggregateOffer=${b(r.hasJsonLdAggregateOffer)} ImageObject=${b(r.hasJsonLdImageObject)} FAQPage=${b(r.hasJsonLdFaqPage)}`,
    );
    console.log(
      `  Speakable: ${b(r.hasSpeakable)} | Canonical: ${b(r.hasCanonical)} | Indexable: ${b(r.isIndexable)}`,
    );
    console.log(`  ContentHash (cards block): ${r.contentHash}`);
    if (r.errors.length > 0) console.log(`  ERRORS: ${r.errors.join(", ")}`);
    console.log("");
  }

  // Duplicate analysis : group by contentHash
  const hashGroups: Record<string, string[]> = {};
  for (const r of results) {
    if (r.tier === "T4-STUB") continue;
    hashGroups[r.contentHash] = hashGroups[r.contentHash] ?? [];
    hashGroups[r.contentHash]!.push(r.url);
  }
  console.log("=== DUPLICATE DETECTION (cards block hash) ===");
  for (const [hash, urls] of Object.entries(hashGroups)) {
    if (urls.length > 1) {
      console.log(
        `⚠️ Hash ${hash} partagé par ${urls.length} villes (cards block IDENTIQUE — attendu) :`,
      );
      urls.forEach((u) => console.log(`    ${u.replace(BASE_URL, "")}`));
    }
  }

  // Summary parite
  const issues: string[] = [];
  const indexableResults = results.filter((r) => r.tier !== "T4-STUB");
  for (const r of indexableResults) {
    if (!r.hasFiveCards) issues.push(`${r.url}: cards ${r.cardsLabels.length}/5`);
    if (!r.hasJsonLdService) issues.push(`${r.url}: missing Service JSON-LD`);
    if (!r.hasJsonLdBreadcrumb) issues.push(`${r.url}: missing Breadcrumb JSON-LD`);
    if (!r.hasJsonLdAggregateOffer) issues.push(`${r.url}: missing AggregateOffer`);
    if (!r.hasSpeakable) issues.push(`${r.url}: missing Speakable`);
    if (!r.isIndexable) issues.push(`${r.url}: noindex (should be indexable)`);
  }
  console.log("\n=== ISSUES SUMMARY ===");
  if (issues.length === 0) {
    console.log("✅ ZERO issue — toutes les villes T1/T2/T3 ont parité STRUCTURELLE complète.");
  } else {
    issues.forEach((i) => console.log(`❌ ${i}`));
  }

  // Check stub
  const stub = results.find((r) => r.tier === "T4-STUB");
  if (stub && stub.isIndexable) {
    console.log(`\n⚠️ STUB T4 ${stub.url} est indexable — devrait être noindex !`);
  } else if (stub) {
    console.log(`\n✅ Stub T4 ${stub.url} correctement noindex.`);
  }
}

function b(v: boolean): string {
  return v ? "✅" : "❌";
}

main().catch((err) => {
  console.error("[qa] error:", err);
  process.exit(1);
});
