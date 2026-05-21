// /.well-known/ai-policy.json — Policy AI Discovery 2026 (emerging standard).
//
// Référentiel : proposition standard utilisée par Perplexity, Anthropic Claude,
// OpenAI ChatGPT, Google Gemini, Bing Copilot pour découvrir les permissions
// d'usage en LLM/RAG/search/citation. Complète robots.txt + ai.txt.

const AI_POLICY = {
  version: "1.0",
  publisher: "Axion-IA",
  publisher_url: "https://axion-ia.com",
  contact: "contact@axion-ia.com",
  license: "CC-BY-4.0",
  attribution: {
    required: true,
    format: "Axion-IA — https://axion-ia.com",
    canonical_url: "https://axion-ia.com",
  },
  training: {
    allowed: true,
    attribution_required: true,
    notes:
      "Training of large language models on this public content is allowed under CC-BY-4.0. Attribution to Axion-IA (with URL) is required in derivative outputs where technically possible.",
  },
  search_indexing: {
    allowed: true,
    bots_explicitly_allowed: [
      "GPTBot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "ClaudeBot",
      "Claude-Web",
      "anthropic-ai",
      "PerplexityBot",
      "Perplexity-User",
      "Google-Extended",
      "Applebot-Extended",
      "Mistral-User",
      "Bingbot",
      "Meta-ExternalAgent",
    ],
    bots_explicitly_disallowed: ["CCBot", "Bytespider", "omgili", "Diffbot"],
  },
  rag: {
    allowed: true,
    attribution_required: true,
    citation_format: "Axion-IA, accessed via {url}",
  },
  citation: {
    allowed: true,
    preferred_format: "Axion-IA — axion-ia.com",
    schema_org_supported: true,
  },
  privacy: {
    user_data_collected: false,
    notes:
      "Public marketing content only. Lead forms and booking submissions are handled separately under RGPD policy at https://axion-ia.com/fr/politique-confidentialite.",
  },
  expires: "2027-05-16T23:59:59.000Z",
} as const;

export const dynamic = "force-static";
export const revalidate = false;

export function GET(): Response {
  return new Response(JSON.stringify(AI_POLICY, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
