/**
 * SEED EXTERNAL LINKS DATABASE — One-shot Perplexity batch
 *
 * Usage :
 *   pnpm tsx src/scripts/seed-external-links-from-perplexity.ts
 *
 * Génère ~270 queries Perplexity réparties sur 7 catégories pour produire ~2 400 liens
 * d'autorité externes. Écrit le résultat dans `src/data/external-links/auto-seeded.ts`.
 *
 * Idempotent : ne ré-écrit pas les URLs déjà présentes dans le catalogue
 * (bootstrap manuel + auto-seeded précédent).
 *
 * Coût attendu : ~$1.62 (modèle sonar, 270 calls × ($0.005 search + ~tokens))
 * Durée attendue : ~45-60 min (concurrence 10, throttle 1.5 req/s)
 *
 * Sprint External Links Database 2026-05-22.
 * Cf. _AUDIT/EXTERNAL-LINKS-2026-05-22/PHASE-0-RACCORDEMENT.md
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  perplexitySearch,
  createConcurrencyLimiter,
  computePerplexityCost,
  PerplexitySearchError,
} from "../server/clients/perplexity-search";
import { ALL_EXTERNAL_LINKS } from "../data/external-links/master";
import { isCompetitorDomain } from "../data/external-links/types";
import type { ExternalLink, ExternalLinkCategory } from "../data/external-links/types";

// ============================================================
// Config
// ============================================================

const CONCURRENCY = 10;
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
  readonly searchDomainFilter?: ReadonlyArray<string>;
  readonly defaultCategory: ExternalLinkCategory;
  readonly defaultAuthority: 1 | 2 | 3 | 4 | 5;
  readonly defaultVerticales: ReadonlyArray<string>;
  readonly defaultTopics: ReadonlyArray<string>;
  readonly defaultLanguage: "fr" | "en";
  readonly defaultRegionSlug?: string;
  readonly defaultCityIds?: ReadonlyArray<string>;
  readonly idPrefix: string;
}

// ============================================================
// Helpers — détection métadonnées depuis URL
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
  if (host.startsWith("mairie") || /^[a-z-]+\.fr$/.test(host)) return fallback;
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
// Query batch generators
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
    query: `Quel est le site web officiel de la mairie de ${c.name} (département ${c.departmentName}) ? Donne uniquement l'URL HTTPS exacte du site officiel de la commune. Format : 1. Mairie de ${c.name} - URL`,
    searchDomainFilter: ["gouv.fr", "fr"],
    defaultCategory: "mairie",
    defaultAuthority: 4,
    defaultVerticales: ["implementations", "un_a_un"],
    defaultTopics: ["collectivite-locale", "ville"],
    defaultLanguage: "fr",
    defaultRegionSlug: c.regionSlug,
    defaultCityIds: [c.slug],
    idPrefix: `auto-city-${c.slug}`,
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
    query: `Cite 10 sites officiels de la région ${r.name} qui publient des données économiques, sur la formation pro, l'innovation IA, ou la transformation digitale entreprises : conseil régional, agence de développement économique, observatoire régional, CCI régionale, pôle de compétitivité. Format strict : "1. [Nom organisme] - https://url.exacte/" (une ligne par source).`,
    searchDomainFilter: ["gouv.fr", "fr"],
    defaultCategory: "gov_fr",
    defaultAuthority: 4,
    defaultVerticales: ["implementations", "interventions_formations", "un_a_un"],
    defaultTopics: ["region", "developpement-economique"],
    defaultLanguage: "fr",
    defaultRegionSlug: r.slug,
    idPrefix: `auto-region-${r.slug}`,
  }));
}

function buildNationalFrBatches(): QueryBatch[] {
  const topics: ReadonlyArray<{ query: string; topics: string[]; verticales: string[] }> = [
    {
      query:
        "10 publications officielles INSEE 2023-2026 sur intelligence artificielle, transformation digitale, économie numérique en France. Format strict : 1. [Titre] - https://url.insee.fr/...",
      topics: ["stats-economie", "ia-pme"],
      verticales: ["audits", "implementations"],
    },
    {
      query:
        "10 publications DARES 2023-2026 sur formation professionnelle, emploi, IA et compétences. Format : 1. [Titre] - https://dares.travail-emploi.gouv.fr/...",
      topics: ["formation-pro", "emploi"],
      verticales: ["interventions_formations"],
    },
    {
      query:
        "10 publications Bpifrance 2023-2026 sur transformation digitale PME/ETI, IA et innovation. Format : 1. [Titre] - https://bpifrance.fr/...",
      topics: ["transformation-digitale", "tpe-pme"],
      verticales: ["implementations", "un_a_un"],
    },
    {
      query:
        "10 publications CNIL 2023-2026 sur IA, RGPD, données personnelles. Format : 1. [Titre] - https://cnil.fr/...",
      topics: ["rgpd", "ai-act"],
      verticales: ["audits"],
    },
    {
      query:
        "10 publications ANSSI / cyber.gouv.fr 2023-2026 sur sécurité IA, LLM, cybersécurité entreprise. Format : 1. [Titre] - https://ssi.gouv.fr/... ou https://cyber.gouv.fr/...",
      topics: ["cybersecurite", "ia-securite"],
      verticales: ["audits"],
    },
    {
      query:
        "10 publications France Num 2023-2026 sur numérique PME/ETI, IA, e-commerce. Format : 1. [Titre] - https://francenum.gouv.fr/...",
      topics: ["transformation-digitale", "tpe-pme"],
      verticales: ["implementations", "sites_web_augmentes"],
    },
    {
      query:
        "10 publications France Compétences 2023-2026 sur certifications RNCP, formation IA. Format : 1. [Titre] - https://francecompetences.fr/...",
      topics: ["formation-pro", "rncp"],
      verticales: ["interventions_formations"],
    },
    {
      query:
        "10 publications data.gouv.fr / DINUM 2023-2026 sur open data, IA publique. Format : 1. [Titre] - URL",
      topics: ["open-data", "ia-publique"],
      verticales: ["audits", "implementations"],
    },
  ];

  return topics.map<QueryBatch>((t, idx) => ({
    scope: "national",
    label: `nat-fr-${idx + 1}`,
    query: t.query,
    searchDomainFilter: ["gouv.fr"],
    defaultCategory: "gov_fr",
    defaultAuthority: 5,
    defaultVerticales: t.verticales,
    defaultTopics: t.topics,
    defaultLanguage: "fr",
    idPrefix: `auto-natfr-${idx + 1}`,
  }));
}

function buildVerticalesBatches(): QueryBatch[] {
  const verticales = [
    {
      v: "audits",
      query:
        "10 standards officiels et publications de référence pour l'audit IA en entreprise 2024-2026 (ISO 42001, NIST AI RMF, AFNOR, OWASP LLM Top 10, EU AI Act guidelines). Format strict : 1. [Titre] - URL.",
      topics: ["audit-ia", "iso", "ai-risk"],
    },
    {
      v: "interventions_formations",
      query:
        "10 ressources officielles formation professionnelle IA en France 2024-2026 (OPCO, France Compétences RNCP, DARES, Cnam, ressources publiques). Format strict : 1. [Titre] - URL.",
      topics: ["formation-pro", "opco"],
    },
    {
      v: "un_a_un",
      query:
        "10 publications Harvard Business Review, MIT Sloan, Stanford GSB, BCG, Bain sur IA executive leadership 2024-2026. Format strict : 1. [Titre] - URL.",
      topics: ["executive-leadership", "ai-strategy"],
    },
    {
      v: "implementations",
      query:
        "10 publications McKinsey Quantum Black, Gartner, Forrester, IDC, Capgemini Research Institute, BCG sur transformation IA entreprise 2024-2026. Format strict : 1. [Titre] - URL.",
      topics: ["ai-transformation", "ai-strategy"],
    },
    {
      v: "sites_web_augmentes",
      query:
        "10 ressources officielles Google Search Central, web.dev, schema.org, MDN, W3C sur SEO IA, Core Web Vitals, structured data 2024-2026. Format strict : 1. [Titre] - URL.",
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
    }));
  });
}

function buildTopicsBatches(): QueryBatch[] {
  const topics = [
    {
      topic: "ai-research",
      query:
        "10 articles ou rapports Stanford AI Index, MIT Tech Review, OpenAI research, Anthropic research, DeepMind 2024-2026. Format strict : 1. [Titre] - URL.",
    },
    {
      topic: "ai-act",
      query:
        "10 sources officielles EU AI Act, EDPB, EUR-Lex, CNIL sur régulation IA Europe 2024-2026. Format strict : 1. [Titre] - URL.",
    },
    {
      topic: "ia-securite",
      query:
        "10 publications OWASP Top 10 LLM, NIST AI RMF, ANSSI, MITRE ATLAS sur sécurité IA. Format strict : 1. [Titre] - URL.",
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
  }));
}

function buildPressFrBatches(): QueryBatch[] {
  return [
    {
      scope: "national",
      label: "press-fr-1",
      query:
        "10 articles JDN, FrenchWeb, Numerama, Usine Digitale, Maddyness, BFM Tech 2024-2026 sur IA en entreprise France, formation, transformation digitale. Format strict : 1. [Titre] - URL.",
      searchDomainFilter: ["fr"],
      defaultCategory: "press_top",
      defaultAuthority: 3,
      defaultVerticales: ["implementations", "interventions_formations"],
      defaultTopics: ["tech-fr", "ia-pme"],
      defaultLanguage: "fr",
      idPrefix: "auto-press-fr-1",
    },
  ];
}

function buildInternationalBatches(): QueryBatch[] {
  return [
    {
      scope: "international",
      label: "intl-1",
      query:
        "10 publications OECD AI Policy Observatory, EU Commission AI policy, UNESCO IA éthique, World Economic Forum AI, World Bank IA développement 2024-2026. Format strict : 1. [Titre] - URL.",
      defaultCategory: "international",
      defaultAuthority: 5,
      defaultVerticales: ["audits", "implementations", "un_a_un"],
      defaultTopics: ["ia-policy", "international"],
      defaultLanguage: "en",
      idPrefix: "auto-intl-1",
    },
  ];
}

// ============================================================
// Parser — extrait URLs depuis content texte
// ============================================================

interface ParsedLink {
  url: string;
  title: string;
}

function parseLinksFromContent(content: string): ParsedLink[] {
  const lines = content.split(/\r?\n/);
  const out: ParsedLink[] = [];
  for (const line of lines) {
    // Format "1. [Nom] - URL" ou "1. Nom - URL"
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
  // Pré-conditions
  if (!process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY.includes("stub.invalid")) {
    console.error("");
    console.error("  ❌ PERPLEXITY_API_KEY env var absente ou stub.invalid.");
    console.error("");
    console.error("  Pour exécuter le seed :");
    console.error("    1. Configurer PERPLEXITY_API_KEY dans .env.local (ou Coolify pour CI)");
    console.error("    2. Re-lancer : pnpm tsx src/scripts/seed-external-links-from-perplexity.ts");
    console.error("");
    process.exit(1);
  }

  const startTs = Date.now();
  const existingUrls = new Set(ALL_EXTERNAL_LINKS.map((l) => l.url));
  console.log(`[seed] Bootstrap existant : ${existingUrls.size} URLs déjà cataloguées`);

  const cities = loadCities();
  console.log(`[seed] Villes top 200 chargées : ${cities.length}`);

  const allBatches: QueryBatch[] = [
    ...buildCityBatches(cities),
    ...buildRegionBatches(),
    ...buildNationalFrBatches(),
    ...buildVerticalesBatches(),
    ...buildTopicsBatches(),
    ...buildPressFrBatches(),
    ...buildInternationalBatches(),
  ];
  console.log(`[seed] ${allBatches.length} queries Perplexity à exécuter`);

  const limit = createConcurrencyLimiter(CONCURRENCY);
  const newLinks: ExternalLink[] = [];
  let totalCost = 0;
  let succeeded = 0;
  let failed = 0;

  await Promise.all(
    allBatches.map((batch) =>
      limit(async () => {
        try {
          const result = await perplexitySearch({
            query: batch.query,
            model: "sonar",
            ...(batch.searchDomainFilter ? { searchDomainFilter: batch.searchDomainFilter } : {}),
            maxTokens: 1500,
            searchRecencyFilter: "year",
          });
          succeeded += 1;
          totalCost += computePerplexityCost("sonar", result.tokensInput, result.tokensOutput);

          const parsed = parseLinksFromContent(result.content);
          // Compléter avec citations si parse < 5
          if (parsed.length < 5 && result.citations.length > 0) {
            for (const c of result.citations) {
              if (parsed.length >= 10) break;
              parsed.push({ url: c.url, title: c.title ?? "" });
            }
          }

          let added = 0;
          for (const p of parsed) {
            // Filtres URL
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
              notes: `Auto-seeded from Perplexity ${TODAY} (batch=${batch.label})`,
            };
            newLinks.push(link);
            existingUrls.add(p.url);
            added += 1;
          }
          process.stdout.write(`  [✓] ${batch.label} +${added} liens\n`);
        } catch (err) {
          failed += 1;
          const msg =
            err instanceof PerplexitySearchError
              ? `${err.status} ${err.message}`
              : (err as Error).message;
          process.stdout.write(`  [✗] ${batch.label} ${msg}\n`);
        }
      }),
    ),
  );

  // Write output
  const banner = `/**
 * AUTO-SEEDED EXTERNAL LINKS — Generated by seed-external-links-from-perplexity.ts
 *
 * Date : ${TODAY}
 * Total liens auto-seedés : ${newLinks.length}
 * Coût Perplexity : $${totalCost.toFixed(4)}
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
  console.log(`[seed] TOTAL : ${newLinks.length} liens auto-seedés`);
  console.log(`[seed] Queries succès : ${succeeded} / ${allBatches.length} (échecs : ${failed})`);
  console.log(`[seed] Coût Perplexity : $${totalCost.toFixed(4)}`);
  console.log(`[seed] Durée : ${(durationMs / 1000 / 60).toFixed(1)} min`);
  console.log(`[seed] Sortie : ${OUTPUT_FILE}`);
  console.log("=".repeat(70));
  console.log("");
  console.log("Prochaines étapes :");
  console.log('  1. Ajouter `import { LINKS_AUTO_SEEDED } from "./auto-seeded";` à master.ts');
  console.log("  2. Lancer : pnpm tsx src/scripts/verify-external-links-head.ts");
  console.log("  3. Review master.ts (virer non-pertinents)");
  console.log("  4. git add + commit + push");
  console.log("");
}

main().catch((err) => {
  console.error("[seed] FATAL :", err);
  process.exit(1);
});
