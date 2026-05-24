/**
 * SEED BOOST RÉGIONS sous-couvertes — Normandie, Occitanie, Grand Est
 *
 * Usage : pnpm tsx src/scripts/seed-external-links-regions-boost.ts
 *
 * Mini-seed pour équilibrer les régions ayant ≤ 3 liens dans le catalogue.
 * Claude knowledge-only (pas de web_search → rapide + gratuit).
 *
 * Durée : ~1 min (3 queries séquentielles avec petit délai).
 * Coût : ~$0.10 tokens.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  claudeSearch,
  computeClaudeCost,
  ClaudeSearchError,
} from "../server/clients/claude-search";
import { ALL_EXTERNAL_LINKS } from "../data/external-links/master";
import { isCompetitorDomain } from "../data/external-links/types";
import type { ExternalLink } from "../data/external-links/types";

const MODEL = "claude-sonnet-4-6" as const;
const OUTPUT_FILE = resolve(process.cwd(), "src/data/external-links/auto-seeded-regions-boost.ts");
const TODAY = new Date().toISOString().slice(0, 10);
const NOW_ISO = new Date().toISOString();

const REGIONS = [
  {
    slug: "normandie",
    name: "Normandie",
    query: `Liste 10 sites web officiels de la région Normandie spécifiquement liés à : conseil régional Normandie, agence de développement économique (Normandie Attractivité), CCI Normandie, observatoire régional emploi/formation, pôles de compétitivité Normands (Cosmetic Valley, Moveo, etc.), Carif-Oref. Format strict : "1. [Nom] - URL exacte". URLs PRÉCISES et VÉRIFIÉES (ex : www.normandie.fr, www.normandie-attractivite.fr, normandie.cci.fr).`,
  },
  {
    slug: "occitanie",
    name: "Occitanie",
    query: `Liste 10 sites web officiels de la région Occitanie spécifiquement liés à : conseil régional Occitanie (laregion.fr), AD'OCC agence dev éco Occitanie, CCI Occitanie, Carif-Oref Occitanie, pôles de compétitivité Occitans (Aerospace Valley, Eau, Agri Sud-Ouest Innovation), Cellule Régionale Innovation Bpifrance Occitanie. Format strict : "1. [Nom] - URL". URLs VÉRIFIÉES.`,
  },
  {
    slug: "grand-est",
    name: "Grand Est",
    query: `Liste 10 sites web officiels de la région Grand Est spécifiquement liés à : conseil régional Grand Est (grandest.fr), Grand E-Nov agence innovation, CCI Grand Est, Carif-Oref Grand Est, pôles de compétitivité (Materalia, Hydreos, Pôle Véhicule du Futur), Université de Strasbourg / Lorraine pour IA. Format strict : "1. [Nom] - URL". URLs VÉRIFIÉES.`,
  },
];

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("\n  ❌ ANTHROPIC_API_KEY absente.\n");
    process.exit(1);
  }

  const existingUrls = new Set(ALL_EXTERNAL_LINKS.map((l) => l.url));
  const newLinks: ExternalLink[] = [];
  let totalCost = 0;

  for (const r of REGIONS) {
    try {
      const result = await claudeSearch({
        query: r.query,
        model: MODEL,
        maxTokens: 1500,
        enableWebSearch: false, // Knowledge-only — Claude connaît ces régions
      });
      totalCost += computeClaudeCost(MODEL, result.tokensInput, result.tokensOutput);

      const lines = result.content.split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^\s*\d+\.\s*\[?([^\]]*?)\]?\s*[-–—:]\s*(https?:\/\/\S+)/);
        if (!m || !m[1] || !m[2]) continue;
        const url = m[2].replace(/[.,;:!?\)\]]+$/, "");
        if (existingUrls.has(url) || !url.startsWith("https://")) continue;
        let host: string;
        try {
          host = new URL(url).hostname;
        } catch {
          continue;
        }
        const link: ExternalLink = {
          id: `boost-region-${r.slug}-${String(newLinks.length + 1).padStart(3, "0")}`,
          url,
          title: m[1].trim(),
          organization:
            host
              .replace(/^www\./, "")
              .split(".")[0]
              ?.toUpperCase() ?? "Unknown",
          category: host.endsWith(".gouv.fr") ? "gov_fr" : "industry_assoc",
          scope: "regional",
          regionSlug: r.slug,
          verticales: ["implementations", "interventions_formations", "un_a_un"],
          topics: ["region", "developpement-economique"],
          language: "fr",
          authority: 4,
          verifiedAt: TODAY,
          lastCheckedAt: NOW_ISO,
          status: "pending_verify",
          isCompetitor: isCompetitorDomain(host),
          paywall: false,
          indexable: true,
          isHttps: true,
          usageCount: 0,
          notes: `Boost régions sous-couvertes ${TODAY} (knowledge-only, ${r.name})`,
        };
        newLinks.push(link);
        existingUrls.add(url);
      }
      console.log(
        `  [✓] ${r.slug} +${newLinks.length} cumulé (tokens=${result.tokensInput}/${result.tokensOutput})`,
      );
    } catch (err) {
      console.log(
        `  [✗] ${r.slug}: ${err instanceof ClaudeSearchError ? err.message : (err as Error).message}`,
      );
    }
    // Mini-delay pour rester sous 50 req/min
    await new Promise((res) => setTimeout(res, 2_000));
  }

  const banner = `/**
 * AUTO-SEEDED REGIONS BOOST — Normandie, Occitanie, Grand Est
 * Generated by seed-external-links-regions-boost.ts ${TODAY}
 * ${newLinks.length} liens, $${totalCost.toFixed(4)} tokens.
 */
import type { ExternalLink } from "./types";
export const LINKS_AUTO_SEEDED_REGIONS_BOOST: ReadonlyArray<ExternalLink> = ${JSON.stringify(newLinks, null, 2)};
`;
  writeFileSync(OUTPUT_FILE, banner, "utf-8");
  console.log(`\n[boost] TOTAL: ${newLinks.length} liens, $${totalCost.toFixed(4)}`);
  console.log(`[boost] Output: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("[boost] FATAL:", err);
  process.exit(1);
});
