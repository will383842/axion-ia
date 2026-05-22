/**
 * SEED V3 EXTERNAL LINKS — Métier-ciblé Axion-IA (5 verticales × 6 queries)
 *
 * Usage :
 *   pnpm tsx src/scripts/seed-external-links-vertical-deep.ts
 *
 * Différence vs seed-external-links-from-claude.ts :
 *  - PAS de villes / régions / national_fr générique
 *  - 30 queries ultra-spécialisées sur les outils/frameworks réels utilisés
 *    par Axion-IA dans ses articles (Cnam, RNCP, ISO 42001, OWASP, LangChain,
 *    AWS Bedrock, Anthropic SDK, llms.txt, AI Overviews, etc.)
 *  - Output dans auto-seeded-vertical.ts (séparé, non-overlap avec auto-seeded.ts)
 *
 * Coût estimé : ~$2-3 (Sonnet 4.6 + web_search × 30 queries)
 * Durée : ~16 min (séquentiel + throttle 32s anti rate limit)
 *
 * Sprint External Links Database — v3 vertical-deep, 2026-05-22.
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
import type { ExternalLink, ExternalLinkCategory } from "../data/external-links/types";

const THEMATIC_DELAY_MS = 32_000;
const MODEL = "claude-sonnet-4-6" as const;
const MAX_WEB_SEARCH_USES = 1;
const OUTPUT_FILE = resolve(process.cwd(), "src/data/external-links/auto-seeded-vertical.ts");
const TODAY = new Date().toISOString().slice(0, 10);
const NOW_ISO = new Date().toISOString();

interface VerticalBatch {
  readonly label: string;
  readonly query: string;
  readonly defaultCategory: ExternalLinkCategory;
  readonly defaultAuthority: 3 | 4 | 5;
  readonly verticales: ReadonlyArray<string>;
  readonly topics: ReadonlyArray<string>;
  readonly language: "fr" | "en";
}

// ============================================================
// 30 QUERIES MÉTIER-CIBLÉES (6 par verticale)
// ============================================================

const BATCHES: ReadonlyArray<VerticalBatch> = [
  // ──────── FORMATION IA (6) ────────
  {
    label: "formation-cnam",
    query: `Donne 10 URLs exactes officielles du Cnam (Conservatoire National des Arts et Métiers) sur les formations Intelligence Artificielle, certificats RNCP IA, et masters IA. Format strict : "1. [Titre] - URL". URLs VÉRIFIÉES sur cnam.fr uniquement.`,
    defaultCategory: "academic",
    defaultAuthority: 5,
    verticales: ["interventions_formations"],
    topics: ["formation-pro", "cnam"],
    language: "fr",
  },
  {
    label: "formation-rncp",
    query: `Donne 10 URLs France Compétences RNCP exactes pour les certifications professionnelles Intelligence Artificielle / Data Science / Machine Learning. Format strict : "1. [Titre] - URL". URLs francecompetences.fr/recherche uniquement.`,
    defaultCategory: "gov_fr",
    defaultAuthority: 5,
    verticales: ["interventions_formations"],
    topics: ["formation-pro", "rncp", "certifications"],
    language: "fr",
  },
  {
    label: "formation-opco",
    query: `Donne 10 URLs OPCO françaises (OPCO Atlas, OPCO EP, OPCommerce, AKTO, OPCO 2I, Afdas, Constructys, Mobilités, OCAPIAT, Uniformation) avec leurs pages dédiées au financement de formations Intelligence Artificielle. Format strict : "1. [Titre] - URL". URLs VÉRIFIÉES uniquement.`,
    defaultCategory: "opco",
    defaultAuthority: 4,
    verticales: ["interventions_formations"],
    topics: ["formation-pro", "opco", "financement-formation"],
    language: "fr",
  },
  {
    label: "formation-mooc",
    query: `Donne 10 URLs de cours MOOC officiels Intelligence Artificielle accessibles en France 2024-2026 (Coursera, edX, FUN-MOOC, OpenClassrooms exclu, Google AI, Microsoft Learn, AWS Skill Builder, Hugging Face Learn). Format strict : "1. [Titre] - URL". URLs VÉRIFIÉES uniquement.`,
    defaultCategory: "academic",
    defaultAuthority: 4,
    verticales: ["interventions_formations"],
    topics: ["formation-pro", "mooc", "ia-generative"],
    language: "en",
  },
  {
    label: "formation-cpf",
    query: `Donne 10 URLs officielles Mon Compte Formation (moncompteformation.gouv.fr), guides Caisse des Dépôts CPF Intelligence Artificielle, et critères d'éligibilité Qualiopi pour formations IA. Format strict : "1. [Titre] - URL". URLs gov.fr uniquement.`,
    defaultCategory: "gov_fr",
    defaultAuthority: 5,
    verticales: ["interventions_formations"],
    topics: ["cpf", "qualiopi", "formation-pro"],
    language: "fr",
  },
  {
    label: "formation-anthropic-edu",
    query: `Donne 10 URLs Anthropic Claude pour entreprises et éducation (claude.ai/education, anthropic.com/business, Claude API documentation pour cas d'usage formation IA). Format strict : "1. [Titre] - URL". URLs anthropic.com / claude.ai uniquement.`,
    defaultCategory: "research_industry",
    defaultAuthority: 5,
    verticales: ["interventions_formations", "implementations"],
    topics: ["anthropic", "claude-api", "ia-generative"],
    language: "en",
  },

  // ──────── AUDIT IA (6) ────────
  {
    label: "audit-iso-42001",
    query: `Donne 10 URLs officielles ISO 42001 (AI Management System) : page produit, guidelines, certification path, audit checklist. Format strict : "1. [Titre] - URL". URLs iso.org uniquement.`,
    defaultCategory: "official_doc",
    defaultAuthority: 5,
    verticales: ["audits"],
    topics: ["iso-42001", "audit-ia", "ai-management"],
    language: "en",
  },
  {
    label: "audit-nist-ai-rmf",
    query: `Donne 10 URLs NIST AI Risk Management Framework + AI 100-1 + GenAI Profile playbook documents officiels NIST 2023-2026. Format strict : "1. [Titre] - URL". URLs nist.gov uniquement.`,
    defaultCategory: "official_doc",
    defaultAuthority: 5,
    verticales: ["audits"],
    topics: ["nist-ai-rmf", "ai-risk", "ai-governance"],
    language: "en",
  },
  {
    label: "audit-cnil",
    query: `Donne 10 URLs CNIL spécifiques aux audits IA : recommandations IA générative, RGPD IA, analyse d'impact AIPD pour systèmes IA, guides PME IA. Format strict : "1. [Titre] - URL". URLs cnil.fr uniquement.`,
    defaultCategory: "gov_fr",
    defaultAuthority: 5,
    verticales: ["audits"],
    topics: ["cnil", "rgpd", "ai-act", "aipd"],
    language: "fr",
  },
  {
    label: "audit-anssi",
    query: `Donne 10 URLs ANSSI / cyber.gouv.fr spécifiques sécurité IA, audit cybersécurité LLM, recommandations IA générative pour entreprises. Format strict : "1. [Titre] - URL". URLs ssi.gouv.fr ou cyber.gouv.fr uniquement.`,
    defaultCategory: "gov_fr",
    defaultAuthority: 5,
    verticales: ["audits"],
    topics: ["anssi", "ia-securite", "llm-security"],
    language: "fr",
  },
  {
    label: "audit-owasp",
    query: `Donne 10 URLs OWASP Top 10 for LLM Applications + OWASP AI Exchange + sub-pages mitigations spécifiques (LLM01 Prompt Injection, LLM02 Insecure Output, etc.). Format strict : "1. [Titre] - URL". URLs owasp.org uniquement.`,
    defaultCategory: "official_doc",
    defaultAuthority: 5,
    verticales: ["audits"],
    topics: ["owasp", "llm-security", "prompt-injection"],
    language: "en",
  },
  {
    label: "audit-ai-act",
    query: `Donne 10 URLs EU AI Act + EU Commission + EDPB + AI Act Tracker spécifiques aux obligations audit/conformité art. 50 (transparence) + art. 6 (high-risk) + GPAI obligations 2026. Format strict : "1. [Titre] - URL". URLs europa.eu ou artificialintelligenceact.eu uniquement.`,
    defaultCategory: "gov_eu",
    defaultAuthority: 5,
    verticales: ["audits"],
    topics: ["ai-act", "regulation-ia", "europe", "gpai"],
    language: "en",
  },

  // ──────── INTERVENTIONS IA (6) ────────
  {
    label: "interventions-anthropic-cookbook",
    query: `Donne 10 URLs Anthropic Cookbook + Anthropic Education + prompt engineering guides officiels Anthropic 2024-2026. Format strict : "1. [Titre] - URL". URLs anthropic.com ou github.com/anthropics uniquement.`,
    defaultCategory: "research_industry",
    defaultAuthority: 5,
    verticales: ["interventions_formations", "implementations"],
    topics: ["anthropic-cookbook", "prompt-engineering", "claude-api"],
    language: "en",
  },
  {
    label: "interventions-openai-guides",
    query: `Donne 10 URLs OpenAI Cookbook + OpenAI Platform docs sur ChatGPT for business, GPT-5/4o use cases, function calling, agents framework. Format strict : "1. [Titre] - URL". URLs openai.com / cookbook.openai.com / platform.openai.com uniquement.`,
    defaultCategory: "research_industry",
    defaultAuthority: 5,
    verticales: ["interventions_formations", "implementations"],
    topics: ["openai", "gpt", "agents"],
    language: "en",
  },
  {
    label: "interventions-google-ai",
    query: `Donne 10 URLs Google AI / Gemini for Workspace, NotebookLM, Google AI Studio docs, Vertex AI starter pour interventions IA en entreprise. Format strict : "1. [Titre] - URL". URLs ai.google.dev / cloud.google.com / workspace.google.com uniquement.`,
    defaultCategory: "research_industry",
    defaultAuthority: 5,
    verticales: ["interventions_formations", "implementations"],
    topics: ["google-ai", "gemini", "notebooklm"],
    language: "en",
  },
  {
    label: "interventions-microsoft-copilot",
    query: `Donne 10 URLs Microsoft Copilot for Microsoft 365 + Copilot Studio + Azure AI Foundry docs pour cas d'usage interventions entreprise. Format strict : "1. [Titre] - URL". URLs microsoft.com / learn.microsoft.com uniquement.`,
    defaultCategory: "research_industry",
    defaultAuthority: 5,
    verticales: ["interventions_formations", "implementations"],
    topics: ["microsoft-copilot", "azure-ai", "ia-pme"],
    language: "en",
  },
  {
    label: "interventions-bpi-france-num",
    query: `Donne 10 URLs Bpifrance et France Num spécifiques aux interventions IA pour PME : programmes IA Booster, diagnostics IA, financements PME IA 2024-2026. Format strict : "1. [Titre] - URL". URLs bpifrance.fr ou francenum.gouv.fr uniquement.`,
    defaultCategory: "gov_fr",
    defaultAuthority: 5,
    verticales: ["interventions_formations", "implementations", "un_a_un"],
    topics: ["bpifrance", "france-num", "ia-pme", "ia-booster"],
    language: "fr",
  },
  {
    label: "interventions-stanford-hai",
    query: `Donne 10 URLs Stanford HAI (Human-Centered AI Institute) + Stanford AI Index Reports 2024-2026 + Stanford Online AI courses adultes. Format strict : "1. [Titre] - URL". URLs hai.stanford.edu / aiindex.stanford.edu / online.stanford.edu uniquement.`,
    defaultCategory: "academic",
    defaultAuthority: 5,
    verticales: ["interventions_formations", "un_a_un"],
    topics: ["stanford-hai", "ai-research", "academic-research"],
    language: "en",
  },

  // ──────── 1-TO-1 (6) ────────
  {
    label: "1to1-hbr-ai-leaders",
    query: `Donne 10 URLs Harvard Business Review articles 2024-2026 spécifiques AI for executives, AI strategy CEOs, leading with AI, AI transformation leadership. Format strict : "1. [Titre] - URL". URLs hbr.org uniquement.`,
    defaultCategory: "academic",
    defaultAuthority: 5,
    verticales: ["un_a_un"],
    topics: ["hbr", "executive-leadership", "ai-strategy"],
    language: "en",
  },
  {
    label: "1to1-mit-sloan-ai",
    query: `Donne 10 URLs MIT Sloan Management Review articles 2024-2026 sur AI in business, AI ROI, generative AI executive playbook, AI organizational transformation. Format strict : "1. [Titre] - URL". URLs sloanreview.mit.edu uniquement.`,
    defaultCategory: "academic",
    defaultAuthority: 5,
    verticales: ["un_a_un"],
    topics: ["mit-sloan", "executive-leadership", "ai-roi"],
    language: "en",
  },
  {
    label: "1to1-mckinsey-state-of-ai",
    query: `Donne 10 URLs McKinsey State of AI surveys, McKinsey QuantumBlack research insights sur AI executive transformation, GenAI value, CEO playbooks 2023-2026. Format strict : "1. [Titre] - URL". URLs mckinsey.com uniquement.`,
    defaultCategory: "research_industry",
    defaultAuthority: 4,
    verticales: ["un_a_un", "implementations"],
    topics: ["mckinsey-state-of-ai", "ai-strategy"],
    language: "en",
  },
  {
    label: "1to1-bcg-bain-ai",
    query: `Donne 10 URLs BCG Insights AI + Bain Insights AI articles 2024-2026 sur AI leadership, GenAI strategic adoption, CEO AI playbook. Format strict : "1. [Titre] - URL". URLs bcg.com / bain.com uniquement.`,
    defaultCategory: "research_industry",
    defaultAuthority: 4,
    verticales: ["un_a_un", "implementations"],
    topics: ["bcg", "bain", "ai-strategy"],
    language: "en",
  },
  {
    label: "1to1-ethan-mollick",
    query: `Donne 10 URLs Ethan Mollick (Wharton) sur AI for work, Co-Intelligence, oneusefulthing.org articles AI executive, AI prompt frameworks. Format strict : "1. [Titre] - URL". URLs oneusefulthing.org ou substack.com Mollick uniquement.`,
    defaultCategory: "academic",
    defaultAuthority: 4,
    verticales: ["un_a_un", "interventions_formations"],
    topics: ["ethan-mollick", "co-intelligence", "ai-work"],
    language: "en",
  },
  {
    label: "1to1-wef-ai-executives",
    query: `Donne 10 URLs World Economic Forum publications 2024-2026 sur AI for business leaders, future of work IA, AI governance executives. Format strict : "1. [Titre] - URL". URLs weforum.org uniquement.`,
    defaultCategory: "international",
    defaultAuthority: 4,
    verticales: ["un_a_un"],
    topics: ["wef", "future-of-work", "ai-governance"],
    language: "en",
  },

  // ──────── IMPLEMENTATIONS IA (6) ────────
  {
    label: "impl-langchain",
    query: `Donne 10 URLs LangChain docs officiels : tutorials Agents, RAG patterns, LCEL, integrations, LangSmith observability. Format strict : "1. [Titre] - URL". URLs python.langchain.com / js.langchain.com / smith.langchain.com uniquement.`,
    defaultCategory: "official_doc",
    defaultAuthority: 4,
    verticales: ["implementations", "sites_web_augmentes"],
    topics: ["langchain", "rag", "ai-agents"],
    language: "en",
  },
  {
    label: "impl-anthropic-sdk",
    query: `Donne 10 URLs Anthropic SDK / API docs officiels : Claude messages API, tool use, computer use, prompt caching, batch API, model card Sonnet/Opus. Format strict : "1. [Titre] - URL". URLs docs.anthropic.com uniquement.`,
    defaultCategory: "official_doc",
    defaultAuthority: 5,
    verticales: ["implementations", "sites_web_augmentes"],
    topics: ["anthropic-api", "claude-api", "tool-use"],
    language: "en",
  },
  {
    label: "impl-aws-bedrock",
    query: `Donne 10 URLs AWS Bedrock docs officiels : models page, agents framework, knowledge bases, guardrails, prompt management. Format strict : "1. [Titre] - URL". URLs aws.amazon.com/bedrock ou docs.aws.amazon.com/bedrock uniquement.`,
    defaultCategory: "official_doc",
    defaultAuthority: 4,
    verticales: ["implementations"],
    topics: ["aws-bedrock", "cloud-ai", "ai-agents"],
    language: "en",
  },
  {
    label: "impl-azure-ai-foundry",
    query: `Donne 10 URLs Azure AI Foundry docs officiels : models catalog, agents, prompt flow, content safety, GenAI evaluation. Format strict : "1. [Titre] - URL". URLs learn.microsoft.com/azure/ai-foundry ou ai.azure.com uniquement.`,
    defaultCategory: "official_doc",
    defaultAuthority: 4,
    verticales: ["implementations"],
    topics: ["azure-ai", "ai-foundry", "cloud-ai"],
    language: "en",
  },
  {
    label: "impl-vertex-ai",
    query: `Donne 10 URLs Google Cloud Vertex AI docs officiels : Gemini models, Agent Builder, Model Garden, evaluation, prompt design. Format strict : "1. [Titre] - URL". URLs cloud.google.com/vertex-ai uniquement.`,
    defaultCategory: "official_doc",
    defaultAuthority: 4,
    verticales: ["implementations"],
    topics: ["vertex-ai", "gemini", "cloud-ai"],
    language: "en",
  },
  {
    label: "impl-huggingface",
    query: `Donne 10 URLs Hugging Face docs officiels : Transformers, Inference Endpoints, Datasets, Spaces, AutoTrain, model hub trending 2025. Format strict : "1. [Titre] - URL". URLs huggingface.co uniquement.`,
    defaultCategory: "research_industry",
    defaultAuthority: 4,
    verticales: ["implementations"],
    topics: ["huggingface", "transformers", "open-source-ai"],
    language: "en",
  },

  // ──────── SITES WEB AUGMENTÉS IA (6) ────────
  {
    label: "web-google-ai-overviews",
    query: `Donne 10 URLs Google Search Central + Google AI Overviews documentation officielle 2024-2026 sur SGE/AI Overviews ranking, structured data pour AI search, helpful content & AI. Format strict : "1. [Titre] - URL". URLs developers.google.com/search uniquement.`,
    defaultCategory: "official_doc",
    defaultAuthority: 5,
    verticales: ["sites_web_augmentes"],
    topics: ["google-search", "ai-overviews", "seo"],
    language: "en",
  },
  {
    label: "web-llms-txt-protocol",
    query: `Donne 10 URLs spécifiques au protocole llms.txt (Answer.AI standard), llms-full.txt, exemples implementations, et adoption par sites majeurs (Anthropic, Vercel, Cloudflare). Format strict : "1. [Titre] - URL". URLs VÉRIFIÉES uniquement.`,
    defaultCategory: "official_doc",
    defaultAuthority: 4,
    verticales: ["sites_web_augmentes"],
    topics: ["llms-txt", "ai-discoverability", "geo"],
    language: "en",
  },
  {
    label: "web-schema-org-ai",
    query: `Donne 10 URLs Schema.org documentation officielle Article, FAQPage, HowTo, Organization, Person, Speakable, et types pertinents pour articles AI-generated 2024-2026. Format strict : "1. [Titre] - URL". URLs schema.org uniquement.`,
    defaultCategory: "official_doc",
    defaultAuthority: 5,
    verticales: ["sites_web_augmentes"],
    topics: ["schema-org", "structured-data", "json-ld"],
    language: "en",
  },
  {
    label: "web-vercel-ai-sdk",
    query: `Donne 10 URLs Vercel AI SDK docs officiels : Streaming UI, Tools, RAG patterns, Next.js AI integration, useChat / useCompletion hooks. Format strict : "1. [Titre] - URL". URLs sdk.vercel.ai ou vercel.com uniquement.`,
    defaultCategory: "official_doc",
    defaultAuthority: 4,
    verticales: ["sites_web_augmentes", "implementations"],
    topics: ["vercel-ai-sdk", "nextjs-ai", "streaming"],
    language: "en",
  },
  {
    label: "web-web-vitals-2026",
    query: `Donne 10 URLs web.dev (Google) sur Core Web Vitals 2025-2026, INP, LCP, CLS optimisations, performance budget, lighthouse 12+. Format strict : "1. [Titre] - URL". URLs web.dev uniquement.`,
    defaultCategory: "official_doc",
    defaultAuthority: 5,
    verticales: ["sites_web_augmentes"],
    topics: ["web-vitals", "performance", "lcp-cls-inp"],
    language: "en",
  },
  {
    label: "web-perplexity-chatgpt-search",
    query: `Donne 10 URLs Perplexity (perplexity.ai/hub) + OpenAI ChatGPT Search documentation pour indexation et visibilité dans les moteurs de recherche IA 2024-2026. Format strict : "1. [Titre] - URL". URLs perplexity.ai ou openai.com uniquement.`,
    defaultCategory: "research_industry",
    defaultAuthority: 4,
    verticales: ["sites_web_augmentes"],
    topics: ["perplexity", "chatgpt-search", "ai-search-visibility"],
    language: "en",
  },
];

// ============================================================
// Helpers
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
    (host.includes("iso.") ||
      host.includes("ieee.") ||
      host.includes("w3.") ||
      host.includes("schema.") ||
      host.includes("owasp."))
  )
    return "official_doc";
  if (
    host.includes("oecd") ||
    host.includes("unesco") ||
    host.includes("worldbank") ||
    host.includes("weforum")
  )
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
    console.error("\n  ❌ ANTHROPIC_API_KEY env var absente.\n");
    process.exit(1);
  }

  const startTs = Date.now();
  const existingUrls = new Set(ALL_EXTERNAL_LINKS.map((l) => l.url));
  console.log(`[seed-v3] Catalogue existant : ${existingUrls.size} URLs déjà cataloguées`);
  console.log(
    `[seed-v3] ${BATCHES.length} queries métier-ciblées à exécuter (séquentiel + throttle ${THEMATIC_DELAY_MS / 1000}s)`,
  );

  const newLinks: ExternalLink[] = [];
  let totalCost = 0;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < BATCHES.length; i++) {
    const batch = BATCHES[i]!;
    try {
      const result = await claudeSearch({
        query: batch.query,
        model: MODEL,
        maxTokens: 2000,
        enableWebSearch: true,
        maxWebSearchUses: MAX_WEB_SEARCH_USES,
      });
      succeeded += 1;
      totalCost += computeClaudeCost(MODEL, result.tokensInput, result.tokensOutput);

      const parsed = parseLinksFromContent(result.content);
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
          id: makeId(`v3-${batch.label}`, newLinks.length + 1),
          url: p.url,
          title: p.title || p.url,
          organization: inferOrganization(p.url),
          category: inferCategory(p.url, batch.defaultCategory),
          scope: "international",
          verticales: batch.verticales,
          topics: batch.topics,
          language: batch.language,
          authority: batch.defaultAuthority,
          verifiedAt: TODAY,
          lastCheckedAt: NOW_ISO,
          status: "pending_verify",
          isCompetitor: competitor,
          paywall: false,
          indexable: true,
          isHttps: true,
          usageCount: 0,
          notes: `Auto-seeded v3 metier-ciblé ${TODAY} (batch=${batch.label})`,
        };
        newLinks.push(link);
        existingUrls.add(p.url);
        added += 1;
      }
      console.log(
        `  [✓] [${i + 1}/${BATCHES.length}] ${batch.label} +${added} liens (tokens=${result.tokensInput}/${result.tokensOutput})`,
      );
    } catch (err) {
      failed += 1;
      const msg =
        err instanceof ClaudeSearchError ? `${err.status} ${err.message}` : (err as Error).message;
      console.log(`  [✗] [${i + 1}/${BATCHES.length}] ${batch.label} ${msg}`);
    }

    // Throttle entre queries (skip après la dernière)
    if (i < BATCHES.length - 1) {
      await new Promise((r) => setTimeout(r, THEMATIC_DELAY_MS));
    }
  }

  const banner = `/**
 * AUTO-SEEDED V3 EXTERNAL LINKS — Métier-ciblé Axion-IA
 * Generated by seed-external-links-vertical-deep.ts
 *
 * Date : ${TODAY}
 * Modèle : ${MODEL} + web_search natif Anthropic
 * Queries : ${BATCHES.length} (6 par verticale × 5 verticales)
 * Liens auto-seedés : ${newLinks.length}
 * Coût tokens : $${totalCost.toFixed(4)} (hors web_search ~$${(BATCHES.length * 0.01).toFixed(2)})
 * Queries succès : ${succeeded} / ${BATCHES.length}
 *
 * ⚠️  status="pending_verify" pour tous — relancer
 *     \`pnpm tsx src/scripts/verify-external-links-head.ts\` pour basculer en "active".
 */

import type { ExternalLink } from "./types";

export const LINKS_AUTO_SEEDED_VERTICAL: ReadonlyArray<ExternalLink> = ${JSON.stringify(newLinks, null, 2)};
`;
  writeFileSync(OUTPUT_FILE, banner, "utf-8");

  const durationMs = Date.now() - startTs;
  console.log("");
  console.log("=".repeat(70));
  console.log(`[seed-v3] TOTAL : ${newLinks.length} liens auto-seedés (métier-ciblé)`);
  console.log(`[seed-v3] Queries succès : ${succeeded} / ${BATCHES.length} (échecs : ${failed})`);
  console.log(`[seed-v3] Coût Claude tokens : $${totalCost.toFixed(4)}`);
  console.log(`[seed-v3] Durée : ${(durationMs / 1000 / 60).toFixed(1)} min`);
  console.log(`[seed-v3] Sortie : ${OUTPUT_FILE}`);
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("[seed-v3] FATAL :", err);
  process.exit(1);
});
