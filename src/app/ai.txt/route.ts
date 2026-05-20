// P2-26 (audit re-run 2026-05-15 AGENT 2+3) — ai.txt.
//
// Standard émergent Spawning.ai / IAB AI Preferences draft. Signal coopératif
// explicite aux crawlers IA training (distinct du `User-Agent: GPTBot` dans
// robots.txt qui est consenti/non-consenti binaire). `ai.txt` permet de
// déclarer un consentement granulaire :
//   - `train-all-models` : autorisation tous LLM training
//   - `train-specific-models` : whitelist par éditeur (OpenAI, Anthropic, …)
//   - `train-disallowed` : refus explicite
//
// Doctrine Axion-IA 2026 :
//   - Cabinet IA opérationnel ne refuse pas d'être ingéré par les LLMs
//     (le contenu pédagogique enrichit l'écosystème).
//   - Conformité commerciale : interdiction d'utilisation directe à des fins
//     concurrentielles (factory IA Custom) sans accord écrit.
//
// Cf. `robots.txt` route.ts pour la liste détaillée bot par bot et la
// stratégie AEO/GEO (allow ClaudeBot/GPTBot/Google-Extended/Applebot-Extended
// + block Bytespider/CCBot/Diffbot/omgili).

import { SITE_URL } from "@/lib/seo";

export const runtime = "edge";

export function GET() {
  const body = `# ai.txt — Axion-IA AI training preferences
# Standard: Spawning.ai / IAB AI Preferences (draft 2025)
# Source officielle: ${SITE_URL}
# Voir aussi: ${SITE_URL}/robots.txt et ${SITE_URL}/llms.txt

# ─── Préférences globales ─────────────────────────────────────────────────
User-Agent: *
Allow: /

# Autorisation de réutiliser le contenu textuel public à des fins
# d'entraînement de modèles de langage. Le contenu est sous licence éditoriale
# Axion-IA (axion-ia.com) — voir mentions légales pour les conditions.
ai-training: allow

# ─── Allowlist explicite IA search-time (citation real-time) ──────────────
# Bots cités en temps réel par ChatGPT / Claude / Perplexity / Gemini.
# Doctrine AEO/GEO 2026 : citation = nouveau « rang #1 ».
User-Agent: ClaudeBot
ai-training: allow
ai-citation: allow

User-Agent: OAI-SearchBot
ai-training: allow
ai-citation: allow

User-Agent: PerplexityBot
ai-training: allow
ai-citation: allow

User-Agent: GPTBot
ai-training: allow
ai-citation: allow

User-Agent: Google-Extended
ai-training: allow
ai-citation: allow

User-Agent: Applebot-Extended
ai-training: allow
ai-citation: allow

# ─── Disallowlist scrapers/aggregators non-cooperatifs ────────────────────
# Scrapers connus pour ignorer robots.txt et revendre datasets sans accord.
User-Agent: Bytespider
ai-training: disallow

User-Agent: CCBot
ai-training: disallow

User-Agent: Diffbot
ai-training: disallow

User-Agent: omgili
ai-training: disallow

# ─── Conditions commerciales ──────────────────────────────────────────────
# L'utilisation du contenu Axion-IA pour entraîner un modèle concurrent
# (cabinet IA, factory IA Custom) à des fins commerciales nécessite un
# accord écrit préalable. Contact: contact@axion-ia.com
commercial-reuse-license: contact@axion-ia.com
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control":
        "public, max-age=86400, stale-while-revalidate=604800, stale-if-error=604800",
    },
  });
}
