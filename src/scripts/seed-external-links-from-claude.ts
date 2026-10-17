/**
 * SEED EXTERNAL LINKS DATABASE — One-shot Claude Sonnet 4.6 + web_search
 *
 * Usage :
 *   pnpm tsx src/scripts/seed-external-links-from-claude.ts
 *
 * Alternative à `seed-external-links-from-perplexity.ts` qui utilise Claude
 * (Anthropic API) + tool web_search natif (server-side) — équivalent fonctionnel
 * de Perplexity Sonar.
 *
 * Coût estimé : ~$12-15 (Sonnet 4.6 : ~$6 tokens + ~$6-9 web_search × 270 calls)
 * Durée estimée : ~45-60 min (concurrence 5, throttle ~1 req/sec)
 *
 * Sprint External Links Database 2026-05-22.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  claudeSearch,
  computeClaudeCost,
  ClaudeSearchError,
} from "../server/clients/claude-search";
import { createConcurrencyLimiter } from "../server/clients/perplexity-search";
import { ALL_EXTERNAL_LINKS } from "../data/external-links/master";
import { isCompetitorDomain } from "../data/external-links/types";
import type { ExternalLink, ExternalLinkCategory } from "../data/external-links/types";

// ============================================================
// Config
// ============================================================

// Rate limits Anthropic Sonnet 4.6 : 30 000 input tokens/min + 50 req/min.
// Web_search inject ~14K tokens/query → 2 queries/min max avec web_search.
// Pour villes : pas de web_search nécessaire (Claude knows paris.fr etc.) → batch rapide.
// Pour thématiques : web_search avec throttle séquentiel 30s.
const CONCURRENCY_CITIES = 8; // No web_search, ~200 tokens/query
// CONCURRENCY_THEMATIC retiré : Pass 2 utilise un loop séquentiel pur (concurrency=1 implicit)
const THEMATIC_DELAY_MS = 32_000;
const MODEL = "claude-sonnet-4-6" as const;
const MAX_WEB_SEARCH_USES = 1;
const OUTPUT_FILE = resolve(process.cwd(), "src/data/external-links/auto-seeded.ts");
const CITIES_JSON = resolve(process.cwd(), "prisma/seeds/cities/cities-france-5000plus.json");
const TODAY = new Date().toISOString().slice(0, 10);
const NOW_ISO = new Date().toISOString();

interface CityJsonEntry {
  readonly slug: string;
  readonly name: string;
  readonly departmentName: string;
  readonly regionSlug: string;
}

interface QueryBatch {
  readonly scope: "national" | "regional" | "local" | "international";
  readonly label: string;
  readonly query: string;
  readonly allowedDomains?: ReadonlyArray<string>;
  readonly defaultCategory: ExternalLinkCategory;
  readonly defaultAuthority: 1 | 2 | 3 | 4 | 5;
  readonly defaultVerticales: ReadonlyArray<string>;
  readonly defaultTopics: ReadonlyArray<string>;
  readonly defaultLanguage: "fr" | "en";
  readonly defaultRegionSlug?: string;
  readonly defaultCityIds?: ReadonlyArray<string>;
  readonly idPrefix: string;
  /** True = utilise web_search (cher mais à jour). False = knowledge-only Claude. */
  readonly useWebSearch: boolean;
}

// ============================================================
// Helpers (identiques à seed-external-links-from-perplexity.ts)
// ============================================================

function inferCategory(url: string, fallback: ExternalLinkCategory): ExternalLinkCategory {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return fallback;
  }
  if (host.endsWith(".gouv.fr") || host === "legifrance.gouv.fr") return "gov_fr";
  if (host.endsWith(".europa.eu") || host.includes("eur-lex.europa.eu")) return "gov_eu";
  if (host.endsWith(".edu") || host.includes("stanford.edu") || host.includes("mit.edu"))
    return "academic";
  if (
    host.endsWith(".org") &&
    (host.includes("iso.") || host.includes("ieee.") || host.includes("w3."))
  )
    return "official_doc";
  if (host.includes("oecd") || host.includes("unesco") || host.includes("worldbank"))
    return "international";
  return fallback;
}

function inferOrganization(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".");
    return parts[0] ? parts[0].toUpperCase() : host;
  } catch {
    return "Unknown";
  }
}

function makeId(prefix: string, idx: number): string {
  return `${prefix}-${String(idx).padStart(3, "0")}`;
}

// ============================================================
// Query batch generators (identiques à seed-perplexity)
// ============================================================

function loadCities(): ReadonlyArray<CityJsonEntry> {
  if (!existsSync(CITIES_JSON)) {
    console.warn(`[seed] Cities JSON not found at ${CITIES_JSON} — skipping city queries`);
    return [];
  }
  const json = JSON.parse(readFileSync(CITIES_JSON, "utf-8")) as CityJsonEntry[];
  return json.slice(0, 200);
}

function buildCityBatches(cities: ReadonlyArray<CityJsonEntry>): QueryBatch[] {
  return cities.map<QueryBatch>((c) => ({
    scope: "local",
    label: `city-${c.slug}`,
    query: `Donne uniquement l'URL HTTPS exacte du site web officiel de la mairie de ${c.name} (département ${c.departmentName}). Tu connais cette ville — pas besoin de chercher. Format strict : "1. Mairie de ${c.name} - https://url.exacte/". Si tu n'es vraiment pas certain, donne uniquement la homepage prédictible : www.${c.slug}.fr ou homepage prefecture du département.`,
    defaultCategory: "mairie",
    defaultAuthority: 4,
    defaultVerticales: ["implementations", "un_a_un"],
    defaultTopics: ["collectivite-locale", "ville"],
    defaultLanguage: "fr",
    defaultRegionSlug: c.regionSlug,
    defaultCityIds: [c.slug],
    idPrefix: `auto-city-${c.slug}`,
    useWebSearch: false, // Claude connaît les mairies FR — knowledge-only suffit
  }));
}

function buildRegionBatches(): QueryBatch[] {
  const regions = [
    { slug: "ile-de-france", name: "Île-de-France" },
    { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes" },
    { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine" },
    { slug: "occitanie", name: "Occitanie" },
    { slug: "hauts-de-france", name: "Hauts-de-France" },
    { slug: "grand-est", name: "Grand Est" },
    { slug: "provence-alpes-cote-azur", name: "Provence-Alpes-Côte d'Azur" },
    { slug: "pays-de-la-loire", name: "Pays de la Loire" },
    { slug: "bretagne", name: "Bretagne" },
    { slug: "normandie", name: "Normandie" },
    { slug: "bourgogne-franche-comte", name: "Bourgogne-Franche-Comté" },
    { slug: "centre-val-de-loire", name: "Centre-Val de Loire" },
    { slug: "corse", name: "Corse" },
  ];
  return regions.map<QueryBatch>((r) => ({
    scope: "regional",
    label: `region-${r.slug}`,
    query: `Cite 10 sites officiels VÉRIFIÉS de la région ${r.name} qui publient des données économiques, formation pro, innovation IA, ou transformation digitale entreprises (conseil régional, agence dev éco, observatoire régional, CCI régionale, pôle compétitivité). Format strict : "1. [Nom] - https://url.exacte/" — une ligne par source. AUCUNE URL INVENTÉE.`,
    allowedDomains: ["gouv.fr", "fr"],
    defaultCategory: "gov_fr",
    defaultAuthority: 4,
    defaultVerticales: ["implementations", "interventions_formations", "un_a_un"],
    defaultTopics: ["region", "developpement-economique"],
    defaultLanguage: "fr",
    defaultRegionSlug: r.slug,
    idPrefix: `auto-region-${r.slug}`,
    useWebSearch: true,
  }));
}

function buildNationalFrBatches(): QueryBatch[] {
  const topics: ReadonlyArray<{ query: string; topics: string[]; verticales: string[] }> = [
    {
      query:
        "10 publications officielles INSEE 2023-2026 sur intelligence artificielle, transformation digitale, économie numérique en France. Format strict : 1. [Titre] - URL exacte. URLs VÉRIFIÉES uniquement.",
      topics: ["stats-economie", "ia-pme"],
      verticales: ["audits", "implementations"],
    },
    {
      query:
        "10 publications DARES 2023-2026 sur formation professionnelle, emploi, IA et compétences. Format : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      topics: ["formation-pro", "emploi"],
      verticales: ["interventions_formations"],
    },
    {
      query:
        "10 publications Bpifrance 2023-2026 sur transformation digitale TPE/PME, IA et innovation. Format : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      topics: ["transformation-digitale", "tpe-pme"],
      verticales: ["implementations", "un_a_un"],
    },
    {
      query:
        "10 publications CNIL 2023-2026 sur IA, RGPD, données personnelles. Format : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      topics: ["rgpd", "ai-act"],
      verticales: ["audits"],
    },
    {
      query:
        "10 publications ANSSI / cyber.gouv.fr 2023-2026 sur sécurité IA, LLM, cybersécurité entreprise. Format : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      topics: ["cybersecurite", "ia-securite"],
      verticales: ["audits"],
    },
    {
      query:
        "10 publications France Num 2023-2026 sur numérique TPE/PME, IA. Format : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      topics: ["transformation-digitale", "tpe-pme"],
      verticales: ["implementations", "sites_web_augmentes"],
    },
    {
      query:
        "10 publications France Compétences 2023-2026 sur certifications RNCP, formation IA. Format : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      topics: ["formation-pro", "rncp"],
      verticales: ["interventions_formations"],
    },
    {
      query:
        "10 publications data.gouv.fr / DINUM 2023-2026 sur open data, IA publique. Format : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      topics: ["open-data", "ia-publique"],
      verticales: ["audits", "implementations"],
    },
  ];

  return topics.map<QueryBatch>((t, idx) => ({
    scope: "national",
    label: `nat-fr-${idx + 1}`,
    query: t.query,
    allowedDomains: ["gouv.fr"],
    defaultCategory: "gov_fr",
    defaultAuthority: 5,
    defaultVerticales: t.verticales,
    defaultTopics: t.topics,
    defaultLanguage: "fr",
    idPrefix: `auto-natfr-${idx + 1}`,
    useWebSearch: true,
  }));
}

function buildVerticalesBatches(): QueryBatch[] {
  const verticales = [
    {
      v: "audits",
      query:
        "10 standards officiels et publications de référence pour l'audit IA en entreprise 2024-2026 (ISO 42001, NIST AI RMF, AFNOR, OWASP LLM Top 10, EU AI Act guidelines). Format strict : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      topics: ["audit-ia", "iso", "ai-risk"],
    },
    {
      v: "interventions_formations",
      query:
        "10 ressources officielles formation professionnelle IA en France 2024-2026 (OPCO, France Compétences RNCP, DARES, Cnam, ressources publiques). Format strict : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      topics: ["formation-pro", "opco"],
    },
    {
      v: "un_a_un",
      query:
        "10 publications Harvard Business Review, MIT Sloan, Stanford GSB, BCG, Bain sur IA executive leadership 2024-2026. Format strict : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      topics: ["executive-leadership", "ai-strategy"],
    },
    {
      v: "implementations",
      query:
        "10 publications McKinsey QuantumBlack, Gartner, Forrester, IDC, Capgemini Research Institute, BCG sur transformation IA entreprise 2024-2026. Format strict : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      topics: ["ai-transformation", "ai-strategy"],
    },
    {
      v: "sites_web_augmentes",
      query:
        "10 ressources officielles Google Search Central, web.dev, schema.org, MDN, W3C sur SEO IA, Core Web Vitals, structured data 2024-2026. Format strict : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      topics: ["seo", "web-vitals", "structured-data"],
    },
  ];

  return verticales.flatMap((vt, vIdx) => {
    const queries = Array.from({ length: 2 }, (_, qIdx) => ({
      ...vt,
      query: `${vt.query} (Batch ${qIdx + 1}, sources différentes du batch précédent.)`,
      idx: vIdx * 2 + qIdx,
    }));
    return queries.map<QueryBatch>((q, idx) => ({
      scope: "international",
      label: `vert-${q.v}-${idx + 1}`,
      query: q.query,
      defaultCategory: "research_industry",
      defaultAuthority: 4,
      defaultVerticales: [q.v],
      defaultTopics: q.topics,
      defaultLanguage: "fr",
      idPrefix: `auto-vert-${q.v}-${idx + 1}`,
      useWebSearch: true,
    }));
  });
}

function buildTopicsBatches(): QueryBatch[] {
  const topics = [
    {
      topic: "ai-research",
      query:
        "10 articles ou rapports Stanford AI Index, MIT Tech Review, OpenAI research, Anthropic research, DeepMind 2024-2026. Format strict : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
    },
    {
      topic: "ai-act",
      query:
        "10 sources officielles EU AI Act, EDPB, EUR-Lex, CNIL sur régulation IA Europe 2024-2026. Format strict : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
    },
    {
      topic: "ia-securite",
      query:
        "10 publications OWASP Top 10 LLM, NIST AI RMF, ANSSI, MITRE ATLAS sur sécurité IA. Format strict : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
    },
  ];
  return topics.map<QueryBatch>((t, idx) => ({
    scope: "international",
    label: `topic-${t.topic}-${idx + 1}`,
    query: t.query,
    defaultCategory: "research_industry",
    defaultAuthority: 5,
    defaultVerticales: ["audits", "implementations"],
    defaultTopics: [t.topic],
    defaultLanguage: "en",
    idPrefix: `auto-topic-${t.topic}`,
    useWebSearch: true,
  }));
}

function buildPressFrBatches(): QueryBatch[] {
  return [
    {
      scope: "national",
      label: "press-fr-1",
      query:
        "10 articles JDN, FrenchWeb, Numerama, Usine Digitale, Maddyness, BFM Tech 2024-2026 sur IA en entreprise France, formation, transformation digitale. Format strict : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      allowedDomains: ["fr"],
      defaultCategory: "press_top",
      defaultAuthority: 3,
      defaultVerticales: ["implementations", "interventions_formations"],
      defaultTopics: ["tech-fr", "ia-pme"],
      defaultLanguage: "fr",
      idPrefix: "auto-press-fr-1",
      useWebSearch: true,
    },
  ];
}

function buildInternationalBatches(): QueryBatch[] {
  return [
    {
      scope: "international",
      label: "intl-1",
      query:
        "10 publications OECD AI Policy Observatory, EU Commission AI policy, UNESCO IA éthique, World Economic Forum AI, World Bank IA développement 2024-2026. Format strict : 1. [Titre] - URL. URLs VÉRIFIÉES uniquement.",
      defaultCategory: "international",
      defaultAuthority: 5,
      defaultVerticales: ["audits", "implementations", "un_a_un"],
      defaultTopics: ["ia-policy", "international"],
      defaultLanguage: "en",
      idPrefix: "auto-intl-1",
      useWebSearch: true,
    },
  ];
}

// ============================================================
// Parser
// ============================================================

interface ParsedLink {
  url: string;
  title: string;
}

function parseLinksFromContent(content: string): ParsedLink[] {
  const lines = content.split(/\r?\n/);
  const out: ParsedLink[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*\d+\.\s*\[?([^\]]*?)\]?\s*[-–—:]\s*(https?:\/\/\S+)/);
    if (m && m[1] && m[2]) {
      const url = m[2].replace(/[.,;:!?\)\]]+$/, "");
      out.push({ url, title: m[1].trim() });
    }
  }
  return out;
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes("stub.invalid")) {
    console.error("\n  ❌ ANTHROPIC_API_KEY env var absente ou stub.invalid.\n");
    process.exit(1);
  }

  const startTs = Date.now();
  const existingUrls = new Set(ALL_EXTERNAL_LINKS.map((l) => l.url));
  console.log(`[seed-claude] Bootstrap existant : ${existingUrls.size} URLs déjà cataloguées`);

  const cities = loadCities();
  console.log(`[seed-claude] Villes top 200 chargées : ${cities.length}`);

  const allBatches: QueryBatch[] = [
    ...buildCityBatches(cities),
    ...buildRegionBatches(),
    ...buildNationalFrBatches(),
    ...buildVerticalesBatches(),
    ...buildTopicsBatches(),
    ...buildPressFrBatches(),
    ...buildInternationalBatches(),
  ];

  const cityBatches = allBatches.filter((b) => !b.useWebSearch);
  const thematicBatches = allBatches.filter((b) => b.useWebSearch);
  console.log(`[seed-claude] ${allBatches.length} queries totales :`);
  console.log(
    `  - ${cityBatches.length} villes (knowledge-only, concurrent x${CONCURRENCY_CITIES})`,
  );
  console.log(
    `  - ${thematicBatches.length} thématiques (web_search, séquentiel ${THEMATIC_DELAY_MS / 1000}s)`,
  );

  const newLinks: ExternalLink[] = [];
  let totalCost = 0;
  let succeeded = 0;
  let failed = 0;

  async function processBatch(batch: QueryBatch): Promise<void> {
    try {
      const result = await claudeSearch({
        query: batch.query,
        model: MODEL,
        maxTokens: batch.useWebSearch ? 2000 : 300,
        enableWebSearch: batch.useWebSearch,
        ...(batch.useWebSearch ? { maxWebSearchUses: MAX_WEB_SEARCH_USES } : {}),
        ...(batch.useWebSearch && batch.allowedDomains
          ? { allowedDomains: batch.allowedDomains }
          : {}),
      });
      succeeded += 1;
      totalCost += computeClaudeCost(MODEL, result.tokensInput, result.tokensOutput);

      const parsed = parseLinksFromContent(result.content);
      // Compléter avec urls extraites si parse < 5
      if (parsed.length < 5) {
        for (const u of result.urls) {
          if (parsed.length >= 10) break;
          if (!parsed.some((p) => p.url === u)) {
            parsed.push({ url: u, title: "" });
          }
        }
      }

      let added = 0;
      for (const p of parsed) {
        if (existingUrls.has(p.url)) continue;
        if (!p.url.startsWith("https://")) continue;
        let host: string;
        try {
          host = new URL(p.url).hostname;
        } catch {
          continue;
        }
        const competitor = isCompetitorDomain(host);

        const link: ExternalLink = {
          id: makeId(batch.idPrefix, newLinks.length + 1),
          url: p.url,
          title: p.title || p.url,
          organization: inferOrganization(p.url),
          category: inferCategory(p.url, batch.defaultCategory),
          scope: batch.scope,
          ...(batch.defaultRegionSlug ? { regionSlug: batch.defaultRegionSlug } : {}),
          ...(batch.defaultCityIds ? { cityIds: batch.defaultCityIds } : {}),
          verticales: batch.defaultVerticales,
          topics: batch.defaultTopics,
          language: batch.defaultLanguage,
          authority: batch.defaultAuthority,
          verifiedAt: TODAY,
          lastCheckedAt: NOW_ISO,
          status: "pending_verify",
          isCompetitor: competitor,
          paywall: false,
          indexable: true,
          isHttps: true,
          usageCount: 0,
          notes: `Auto-seeded from Claude Sonnet 4.6 + web_search ${TODAY} (batch=${batch.label})`,
        };
        newLinks.push(link);
        existingUrls.add(p.url);
        added += 1;
      }
      process.stdout.write(
        `  [✓] ${batch.label} +${added} liens (tokens=${result.tokensInput}/${result.tokensOutput})\n`,
      );
    } catch (err) {
      failed += 1;
      const msg =
        err instanceof ClaudeSearchError ? `${err.status} ${err.message}` : (err as Error).message;
      process.stdout.write(`  [✗] ${batch.label} ${msg}\n`);
    }
  }

  // === Pass 1 : villes en concurrent (no web_search, rapide) ===
  console.log(
    `\n[seed-claude] Pass 1/2 — ${cityBatches.length} villes concurrent x${CONCURRENCY_CITIES}...`,
  );
  const limitCities = createConcurrencyLimiter(CONCURRENCY_CITIES);
  await Promise.all(cityBatches.map((batch) => limitCities(() => processBatch(batch))));

  // === Pass 2 : thématiques séquentiel + throttle ===
  console.log(
    `\n[seed-claude] Pass 2/2 — ${thematicBatches.length} thématiques séquentiel + throttle ${THEMATIC_DELAY_MS / 1000}s...`,
  );
  for (const batch of thematicBatches) {
    await processBatch(batch);
    await new Promise((r) => setTimeout(r, THEMATIC_DELAY_MS));
  }

  // Write output
  const banner = `/**
 * AUTO-SEEDED EXTERNAL LINKS — Generated by seed-external-links-from-claude.ts
 *
 * Date : ${TODAY}
 * Modèle : ${MODEL} + web_search natif Anthropic
 * Total liens auto-seedés : ${newLinks.length}
 * Coût Claude tokens : $${totalCost.toFixed(4)} (hors coût web_search à $10/1000 uses)
 * Queries succès : ${succeeded} / ${allBatches.length}
 *
 * ⚠️  status="pending_verify" pour tous — relancer
 *     \`pnpm tsx src/scripts/verify-external-links-head.ts\` pour basculer en "active".
 *
 * À review par Will : virer les non-pertinents, marquer paywall/competitor si détecté.
 */

import type { ExternalLink } from "./types";

export const LINKS_AUTO_SEEDED: ReadonlyArray<ExternalLink> = ${JSON.stringify(newLinks, null, 2)};
`;
  writeFileSync(OUTPUT_FILE, banner, "utf-8");

  const durationMs = Date.now() - startTs;
  console.log("");
  console.log("=".repeat(70));
  console.log(`[seed-claude] TOTAL : ${newLinks.length} liens auto-seedés`);
  console.log(
    `[seed-claude] Queries succès : ${succeeded} / ${allBatches.length} (échecs : ${failed})`,
  );
  console.log(`[seed-claude] Coût Claude tokens : $${totalCost.toFixed(4)}`);
  console.log(`[seed-claude] (+ web_search à $10/1000 uses, non comptabilisé ici)`);
  console.log(`[seed-claude] Durée : ${(durationMs / 1000 / 60).toFixed(1)} min`);
  console.log(`[seed-claude] Sortie : ${OUTPUT_FILE}`);
  console.log("=".repeat(70));
  console.log("");
  console.log("Prochaines étapes :");
  console.log('  1. Ajouter `import { LINKS_AUTO_SEEDED } from "./auto-seeded";` à master.ts');
  console.log("  2. Lancer : pnpm tsx src/scripts/verify-external-links-head.ts");
  console.log("  3. Review master.ts + verification-report.md");
  console.log("  4. git add + commit + push");
  console.log("");
}

main().catch((err) => {
  console.error("[seed-claude] FATAL :", err);
  process.exit(1);
});
