/**
 * Maillage offres → glossaire (V2-12, décision du 18/11/2026).
 *
 * Chaque page d'offre renvoie vers 3 ou 4 termes de `/fr/glossaire/*` ; le sens inverse
 * (terme → offre la plus proche) est déjà porté par `GLOSSARY_OFFERS`. Les guides, dont le
 * texte vient de la base, choisissent leurs termes dans leur propre texte
 * (`termesPourTexte`), avec un repli sûr.
 *
 * Règles : slugs existants et fiches indexables seulement (jamais de lien vers une page en
 * noindex ou inexistante), aucune URL `/en`, rendu côté serveur
 * (`TermesGlossaireLies`, aucun JavaScript client). Verrouillé par
 * `src/content/__tests__/maillage-glossaire.spec.ts`.
 */

import {
  ALL_GLOSSARY_TERMS_EXTENDED,
  getGlossaryTermBySlug,
  isGlossaryTermIndexable,
  type GlossaryTermExtended,
} from "@/content/glossary-extension";

const FORMATIONS: Readonly<Record<string, readonly string[]>> = {
  "ia-pour-bien-commencer": [
    "intelligence-artificielle",
    "ia-generative",
    "prompt",
    "hallucination",
  ],
  "ia-pour-bien-commencer-journee": [
    "intelligence-artificielle",
    "ia-generative",
    "prompt",
    "hallucination",
  ],
  "ia-pour-les-equipes": ["copilote", "assistant-ia", "prompt-engineering", "charte-ia"],
  "ia-pour-l-automatisation": ["automatisation", "workflow", "no-code", "rpa"],
  "ia-pour-les-rh": ["donnee-personnelle", "biais", "rgpd-gdpr", "assistant-ia"],
  "ia-pour-le-marketing": ["ia-generative", "prompt-engineering", "geo", "aeo"],
  "ia-pour-les-commerciaux": ["assistant-ia", "copilote", "chatbot", "transcription"],
  "ia-pour-la-finance": ["ocr", "automatisation", "hallucination", "roi-ia"],
  "ia-pour-le-juridique": ["rgpd-gdpr", "hallucination", "ai-act", "donnee-personnelle"],
  "ia-pour-la-production": ["vision-par-ordinateur", "automatisation", "workflow", "roi-ia"],
  "ia-pour-les-achats": ["ocr", "automatisation", "workflow", "assistant-ia"],
  "ia-pour-la-relation-client": ["chatbot", "rag", "assistant-ia", "transcription"],
  "ia-pour-l-it": ["api", "llm", "agent", "prompt-injection"],
  "ia-pour-la-sante": ["donnee-personnelle", "rgpd-gdpr", "hallucination", "transcription"],
  "ia-pour-le-btp": ["vision-par-ordinateur", "ocr", "automatisation", "assistant-ia"],
  "ia-pour-l-immobilier": ["ocr", "assistant-ia", "chatbot", "ia-generative"],
  "ia-pour-le-commerce": ["chatbot", "ia-generative", "assistant-ia", "automatisation"],
  "ia-pour-l-hotellerie-restauration": [
    "chatbot",
    "assistant-ia",
    "synthese-vocale",
    "automatisation",
  ],
  "ia-pour-l-industrie": ["vision-par-ordinateur", "automatisation", "workflow", "roi-ia"],
  "ia-pour-le-transport-logistique": ["automatisation", "workflow", "ocr", "vision-par-ordinateur"],
  "ia-pour-la-banque-assurance": ["rgpd-gdpr", "ai-act", "hallucination", "explicabilite"],
  "seminaire-ia-toute-l-entreprise-1j": [
    "intelligence-artificielle",
    "ia-generative",
    "charte-ia",
    "maitrise-ia-article-4",
  ],
};

/** Repli pour une formation ajoutée au catalogue sans entrée ci-dessus. */
const FORMATION_PAR_DEFAUT: readonly string[] = [
  "intelligence-artificielle",
  "ia-generative",
  "prompt",
];

const IMPLEMENTATION: Readonly<Record<string, readonly string[]>> = {
  "ia-custom": ["fine-tuning", "llm", "rag", "api"],
  chatbot: ["chatbot", "rag", "hallucination", "guardrails"],
  processus: ["automatisation", "workflow", "rpa", "roi-ia"],
  structuration: ["base-de-connaissances", "rag", "semantic-search", "chunking"],
  "crm-erp": ["api", "webhook", "automatisation", "workflow"],
  documents: ["ocr", "rag", "nlp", "base-de-connaissances"],
  agents: ["agent", "tool-use", "human-in-the-loop", "mcp"],
  integrations: ["api", "webhook", "function-calling", "mcp"],
  "no-code": ["no-code", "workflow", "automatisation", "webhook"],
};

const SITES_WEB: Readonly<Record<string, readonly string[]>> = {
  "chatbot-rag": ["chatbot", "rag", "hallucination"],
  "creer-saas-ia": ["llm", "api", "agent"],
  magento: ["chatbot", "api", "ia-generative"],
  personnalisation: ["assistant-ia", "ia-generative", "machine-learning"],
  "plateforme-native": ["api", "llm", "ia-generative"],
  prestashop: ["chatbot", "api", "ia-generative"],
  "recherche-semantique": ["semantic-search", "embedding", "vector-database", "rag"],
  recommandation: ["machine-learning", "embedding", "ia-generative"],
  "sans-refonte": ["api", "chatbot", "webhook"],
  shopify: ["chatbot", "api", "ia-generative"],
  "ux-ui-product-design": ["ia-generative", "assistant-ia", "prompt"],
  woocommerce: ["chatbot", "api", "ia-generative"],
  wordpress: ["chatbot", "api", "ia-generative"],
};

const AUDIT: Readonly<Record<string, readonly string[]>> = {
  cible: ["roi-ia", "poc", "automatisation"],
  "strategique-pme": ["roi-ia", "poc", "shadow-ai", "charte-ia"],
  "strategique-eti": ["gouvernance-ia", "ai-act", "roi-ia", "systeme-ia-haut-risque"],
};

export type FamilleOffre = "formation" | "implementation" | "sites-web" | "audit";

export const MAILLAGE_OFFRES: Readonly<
  Record<FamilleOffre, Readonly<Record<string, readonly string[]>>>
> = {
  formation: FORMATIONS,
  implementation: IMPLEMENTATION,
  "sites-web": SITES_WEB,
  audit: AUDIT,
};

/** Garde-fou de rendu : slugs connus ET fiches indexables, 4 au plus, sans doublon. */
function termesLinkables(slugs: readonly string[], max = 4): readonly GlossaryTermExtended[] {
  const vus = new Set<string>();
  const out: GlossaryTermExtended[] = [];
  for (const slug of slugs) {
    if (vus.has(slug) || !isGlossaryTermIndexable(slug)) continue;
    const t = getGlossaryTermBySlug(slug);
    if (!t) continue;
    vus.add(slug);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Les termes d'une page d'offre (formation, implémentation, site web, audit). */
export function termesPourOffre(
  famille: FamilleOffre,
  slug: string,
): readonly GlossaryTermExtended[] {
  const choisis =
    MAILLAGE_OFFRES[famille][slug] ?? (famille === "formation" ? FORMATION_PAR_DEFAUT : []);
  return termesLinkables(choisis);
}

function echapper(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Termes les plus présents dans un texte (guides, dont le contenu vient de la base). Au moins
 * 3 termes : un repli sûr complète quand le texte en nomme moins.
 */
export function termesPourTexte(texte: string, max = 4): readonly GlossaryTermExtended[] {
  const bas = texte.toLowerCase();
  const notes: Array<{ slug: string; n: number }> = [];
  for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
    if (!isGlossaryTermIndexable(t.slug)) continue;
    let n = 0;
    for (const nom of [t.term, ...t.aliases]) {
      if (nom.length < 3) continue;
      const re = new RegExp(
        `(?<![\\p{L}\\p{N}])${echapper(nom.toLowerCase())}s?(?![\\p{L}\\p{N}])`,
        "gu",
      );
      n += bas.match(re)?.length ?? 0;
    }
    if (n > 0) notes.push({ slug: t.slug, n });
  }
  notes.sort((a, b) => b.n - a.n || a.slug.localeCompare(b.slug));
  return termesLinkables([...notes.map((x) => x.slug), ...FORMATION_PAR_DEFAUT], Math.max(3, max));
}
