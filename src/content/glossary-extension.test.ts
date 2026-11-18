/**
 * Garde du glossaire de référence (décision du 18/11/2026).
 *
 * Chaque fiche : 120 à 200 mots de prose française (définition, fonctionnement, exemple,
 * limite), première phrase autonome et citable, aucun mot interdit, termes liés valides,
 * liens vers la base de connaissances existants.
 */

import { describe, it, expect } from "vitest";
import {
  ALL_GLOSSARY_TERMS_EXTENDED,
  GLOSSARY_FAQ_LINKS,
  GLOSSARY_MAX_WORDS,
  GLOSSARY_MIN_INDEX_WORDS,
  GLOSSARY_OFFERS,
  getGlossaryTermBySlug,
  getRelatedGlossaryTerms,
  glossaryTermWordCount,
  isGlossaryTermIndexable,
  listGlossaryTermSlugs,
  type GlossaryCategory,
} from "./glossary-extension";
import { GLOSSARY_TERMS_HARDCODE } from "@/lib/knowledge/legacy-mapping-glossary-hardcode";
import { FAQ_GLOBAL } from "./transversal";

const VALID_CATEGORIES: ReadonlySet<GlossaryCategory> = new Set([
  "foundational",
  "agents",
  "rag",
  "models",
  "infra",
  "security",
  "evaluation",
  "usages",
  "gouvernance",
  "visibilite",
]);

/** Les 60 slugs publiés avant le 18/11/2026 : on ne renomme ni ne retire jamais un slug. */
const ANCIENS_SLUGS = (
  "llm rag fine-tuning agent mcp vectorisation hallucination prompt-engineering tokens embedding " +
  "context-window inference tokenization temperature top-k-top-p streaming system-prompt guardrails " +
  "react-pattern tool-use function-calling multi-agent swarm chain-of-thought extended-thinking " +
  "semantic-search vector-database chunking re-ranking hybrid-search bm25 claude-anthropic gpt-openai " +
  "mistral-model llama-model gemini-google sonnet-model opus-model haiku-model latency-p95 throughput " +
  "batching rate-limit on-premise-ai edge-deployment prompt-injection jailbreak ai-act rgpd-gdpr dpa " +
  "opt-out-training pii-detection eval-suite golden-dataset ab-test-llm llm-as-judge benchmark-mmlu " +
  "regression-test-llm prompt-caching vision-multimodal"
).split(" ");

/** Termes demandés par la décision du 18/11/2026 (slugs). */
const TERMES_ATTENDUS = [
  "agent",
  "ia-agentique",
  "mcp",
  "rag",
  "context-window",
  "tokens",
  "hallucination",
  "prompt",
  "prompt-engineering",
  "fine-tuning",
  "embedding",
  "vector-database",
  "llm",
  "slm",
  "vision-multimodal",
  "ia-generative",
  "ia-souveraine",
  "mistral-model",
  "open-source-open-weight",
  "shadow-ai",
  "ai-act",
  "maitrise-ia-article-4",
  "systeme-ia-haut-risque",
  "rgpd-gdpr",
  "donnee-personnelle",
  "automatisation",
  "rpa",
  "no-code",
  "workflow",
  "api",
  "chatbot",
  "assistant-ia",
  "copilote",
  "geo",
  "aeo",
  "ia-et-seo",
  "ocr",
  "transcription",
  "synthese-vocale",
  "vision-par-ordinateur",
  "biais",
  "explicabilite",
  "gouvernance-ia",
  "charte-ia",
  "roi-ia",
  "poc",
  "mlops",
  "inference",
  "quantification",
];

/** Mots et formulations interdits dans le glossaire. */
const INTERDITS: ReadonlyArray<{ nom: string; motif: RegExp }> = [
  { nom: "Qualiopi", motif: /qualiopi/i },
  { nom: "OPCO", motif: /\bopco\b/i },
  { nom: "prise en charge", motif: /prise en charge/i },
  { nom: "Grenoble", motif: /grenoble/i },
  { nom: "aucun gain garanti", motif: /aucun gain garanti/i },
  { nom: "faites-le vous-même", motif: /fai(?:tes|re)[- ]le vous[- ]m[eê]me/i },
  { nom: "formation obligatoire", motif: /formations? (?:est |sont )?obligatoires?/i },
  { nom: "conformité garantie", motif: /conformit[ée] garantie/i },
  { nom: "certifiant ou certifié", motif: /certifiant|certifi[ée]/i },
  { nom: "nom du fondateur", motif: /\bwilliams?\b|jullin/i },
  { nom: "montant en euros", motif: /€|\beuros?\b/i },
  { nom: "témoignage inventé", motif: /t[ée]moignage|notre client|nos clients ont/i },
];

describe("glossaire de référence : structure", () => {
  it("compte au moins 100 termes", () => {
    expect(ALL_GLOSSARY_TERMS_EXTENDED.length).toBeGreaterThanOrEqual(100);
  });

  it("garde les 60 anciens slugs et les 12 slugs historiques", () => {
    const slugs = new Set(listGlossaryTermSlugs());
    for (const s of [...ANCIENS_SLUGS, ...GLOSSARY_TERMS_HARDCODE.map((t) => t.slug)]) {
      expect(slugs.has(s), `slug retiré : ${s}`).toBe(true);
    }
  });

  it("contient tous les termes demandés", () => {
    const slugs = new Set(listGlossaryTermSlugs());
    for (const s of TERMES_ATTENDUS) expect(slugs.has(s), `terme absent : ${s}`).toBe(true);
  });

  it("a des slugs uniques en kebab-case", () => {
    const slugs = listGlossaryTermSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("a des catégories valides et des champs non vides", () => {
    for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
      expect(VALID_CATEGORIES.has(t.category), `catégorie de ${t.slug}`).toBe(true);
      for (const champ of [t.term, t.definition, t.fonctionnement, t.exemple, t.limite]) {
        expect(champ.trim().length, `champ vide : ${t.slug}`).toBeGreaterThan(0);
      }
      expect(t.aliases.length, `alias de ${t.slug}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("n'a aucun SIREN, SIRET ou RCS", () => {
    expect(JSON.stringify(ALL_GLOSSARY_TERMS_EXTENDED)).not.toMatch(/\bSIREN\b|\bSIRET\b|\bRCS\b/i);
  });
});

describe("glossaire de référence : longueur et première phrase", () => {
  it("chaque fiche fait entre 120 et 200 mots", () => {
    for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
      const n = glossaryTermWordCount(t);
      expect(n, `${t.slug} : ${n} mots`).toBeGreaterThanOrEqual(GLOSSARY_MIN_INDEX_WORDS);
      expect(n, `${t.slug} : ${n} mots`).toBeLessThanOrEqual(GLOSSARY_MAX_WORDS);
    }
  });

  it("chaque définition commence par une première phrase autonome terminée par un point", () => {
    for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
      const premiere = t.definition.split(/(?<=[.!?])\s+/)[0] ?? "";
      expect(premiere.split(/\s+/).length, `première phrase de ${t.slug}`).toBeGreaterThanOrEqual(
        12,
      );
      expect(premiere.endsWith("."), `point final de ${t.slug}`).toBe(true);
      expect(/^[A-ZÀÂÉÈÊÎÔÛÇ«]/.test(premiere), `majuscule de ${t.slug}`).toBe(true);
      expect(
        /\b(est|sont|désigne|consiste|correspond|regroupe|combine|vise)\b/i.test(premiere),
        `verbe de définition de ${t.slug}`,
      ).toBe(true);
    }
  });

  it("chaque fiche est indexable (SSOT page, sitemap et site explorer)", () => {
    for (const s of listGlossaryTermSlugs()) expect(isGlossaryTermIndexable(s), s).toBe(true);
  });
});

describe("glossaire de référence : mots interdits", () => {
  it("aucune fiche ne contient de mot interdit", () => {
    for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
      const texte = [
        t.term,
        t.definition,
        t.fonctionnement,
        t.exemple,
        t.limite,
        ...t.aliases,
      ].join("\n");
      for (const i of INTERDITS) {
        expect(i.motif.test(texte), `« ${i.nom} » dans ${t.slug}`).toBe(false);
      }
    }
  });

  it("AI Act : formulation prudente de l'article 4", () => {
    const t = getGlossaryTermBySlug("maitrise-ia-article-4");
    if (!t) throw new Error("fiche article 4 absente");
    const texte = `${t.definition} ${t.fonctionnement} ${t.limite}`;
    expect(texte).toMatch(/prendre des mesures pour favoriser/);
    expect(texte).toMatch(/2026\/1744/);
    expect(texte).toMatch(/27 juillet 2026/);
    expect(texte).toMatch(/Aucun niveau précis/);
  });
});

describe("glossaire de référence : liens internes", () => {
  it("les termes liés existent, sans auto-référence, 3 à 5 par fiche", () => {
    const existing = new Set(listGlossaryTermSlugs());
    for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
      expect(t.relatedSlugs.length, `liés de ${t.slug}`).toBeGreaterThanOrEqual(3);
      expect(t.relatedSlugs.length, `liés de ${t.slug}`).toBeLessThanOrEqual(5);
      for (const rel of t.relatedSlugs) {
        expect(existing.has(rel), `${t.slug} → ${rel} inexistant`).toBe(true);
        expect(rel).not.toBe(t.slug);
      }
    }
  });

  it("chaque fiche a une offre reconnue", () => {
    for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
      expect(GLOSSARY_OFFERS[t.offre], `offre de ${t.slug}`).toBeDefined();
    }
  });

  it("les liens vers la base de connaissances (FAQ) désignent des fiches existantes", () => {
    const ids = new Set(FAQ_GLOBAL.map((f) => f.id));
    for (const [slug, faqs] of Object.entries(GLOSSARY_FAQ_LINKS)) {
      expect(getGlossaryTermBySlug(slug), `terme inconnu : ${slug}`).not.toBeNull();
      for (const id of faqs) expect(ids.has(id), `${slug} → faq ${id}`).toBe(true);
    }
  });

  it("getRelatedGlossaryTerms respecte la limite et ignore un slug inconnu", () => {
    expect(getRelatedGlossaryTerms("rag", 3).length).toBeLessThanOrEqual(3);
    expect(getRelatedGlossaryTerms("slug-fantome", 5)).toEqual([]);
    expect(getGlossaryTermBySlug("slug-inexistant-xyz")).toBeNull();
  });
});
