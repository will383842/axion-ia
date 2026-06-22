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
// Doctrine Axion-IA (révisée 2026-06-22 — alignée sur robots.txt) :
//   - TRAINING refusé : le contenu éditorial n'a pas à entraîner gratuitement
//     les modèles (GPTBot/ClaudeBot/Google-Extended/Applebot-Extended bloqués).
//   - CITATION autorisée : les bots de search/answer (OAI-SearchBot/Claude-Web/
//     PerplexityBot/Bingbot) citent en temps réel = visibilité AEO/GEO.
//   - Conformité commerciale : réutilisation concurrentielle sans accord écrit
//     interdite.
//
// Cf. `robots.txt` route.ts (même doctrine : block training / allow citation,
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

# Le contenu public peut être CITÉ en temps réel par les moteurs de réponse,
# mais NON réutilisé pour l'ENTRAÎNEMENT de modèles sans accord (licence
# éditoriale Axion-IA, axion-ia.com — voir mentions légales).
ai-training: disallow

# ─── Bots de CITATION (search-time) — autorisés ───────────────────────────
# Cités en temps réel par ChatGPT Search / Claude / Perplexity / Bing Copilot.
# Doctrine AEO/GEO 2026 : citation = nouveau « rang #1 ». Distincts des bots de
# training (≠ GPTBot/ClaudeBot), donc citation autorisée SANS autoriser le train.
User-Agent: OAI-SearchBot
ai-training: disallow
ai-citation: allow

User-Agent: Claude-Web
ai-training: disallow
ai-citation: allow

User-Agent: Claude-SearchBot
ai-training: disallow
ai-citation: allow

User-Agent: PerplexityBot
ai-training: disallow
ai-citation: allow

User-Agent: Bingbot
ai-training: disallow
ai-citation: allow

# ─── Bots de TRAINING — refusés ───────────────────────────────────────────
User-Agent: GPTBot
ai-training: disallow

User-Agent: ClaudeBot
ai-training: disallow

User-Agent: Google-Extended
ai-training: disallow

User-Agent: Applebot-Extended
ai-training: disallow

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
