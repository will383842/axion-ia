// Détection de la source de trafic (moteur de recherche / assistant IA) — séparée de
// `tracking.ts` : `trackFunnel` est importé par des dizaines de pages, et ce tableau de
// motifs n'a d'usage que dans `RefererTracker`. Dans le même module, chaque chunk de
// page qui appelle `trackFunnel` en embarquait une copie (cliquet « Poids du bundle »).

import { trackEvent } from "@/lib/analytics/plausible-tracker";

/**
 * P1-19 audit indexation 2026-05-15 — détection du moteur de recherche source.
 *
 * Avant ce patch, Plausible dashboard montrait les referers raw (chat.openai.com,
 * google.fr, bing.com…). Pas de bucket distinguant `chatgpt-direct` (utilisateur
 * arrivant d'une réponse ChatGPT) vs `chatgpt-search` (depuis le module search
 * OAI), ni `perplexity` vs `claude` (citations LLM). Cette catégorisation est
 * critique pour mesurer l'AEO/GEO ROI (trafic depuis citations LLM vs SERP).
 *
 * Mapping simplifié — extensible :
 *   - google.fr / google.com / google.* → "google"
 *   - bing.com → "bing"
 *   - qwant.com → "qwant"
 *   - duckduckgo.com → "ddg"
 *   - ecosia.org → "ecosia"
 *   - lilo.org → "lilo"
 *   - perplexity.ai → "perplexity"
 *   - chat.openai.com / chatgpt.com → "chatgpt"
 *   - claude.ai → "claude"
 *   - gemini.google.com / bard.google.com → "gemini"
 *   - mistral.ai / chat.mistral.ai → "mistral"
 *   - copilot.microsoft.com → "copilot"
 *   - (vide / null) → "direct"
 *   - reste → "other"
 *
 * Pure function — aucune dépendance DOM. Test unitaires colocalisés.
 */
export type RefererSource =
  | "google"
  | "bing"
  | "qwant"
  | "ddg"
  | "ecosia"
  | "lilo"
  | "perplexity"
  | "chatgpt"
  | "claude"
  | "gemini"
  | "mistral"
  | "copilot"
  | "direct"
  | "other";

const REFERER_PATTERNS: ReadonlyArray<{ test: RegExp; source: RefererSource }> = [
  { test: /^https?:\/\/(?:www\.)?google\.[a-z.]+\//i, source: "google" },
  { test: /^https?:\/\/(?:www\.)?bing\.com\//i, source: "bing" },
  { test: /^https?:\/\/(?:www\.)?qwant\.com\//i, source: "qwant" },
  { test: /^https?:\/\/(?:duckduckgo\.com|html\.duckduckgo\.com)\//i, source: "ddg" },
  { test: /^https?:\/\/(?:www\.)?ecosia\.org\//i, source: "ecosia" },
  { test: /^https?:\/\/(?:www\.)?lilo\.org\//i, source: "lilo" },
  { test: /^https?:\/\/(?:www\.)?perplexity\.ai\//i, source: "perplexity" },
  { test: /^https?:\/\/(?:chat\.openai\.com|chatgpt\.com)\//i, source: "chatgpt" },
  { test: /^https?:\/\/(?:www\.)?claude\.ai\//i, source: "claude" },
  { test: /^https?:\/\/(?:gemini|bard)\.google\.com\//i, source: "gemini" },
  { test: /^https?:\/\/(?:chat\.)?mistral\.ai\//i, source: "mistral" },
  { test: /^https?:\/\/copilot\.microsoft\.com\//i, source: "copilot" },
];

export function detectSearchEngine(referrer: string | null | undefined): RefererSource {
  const ref = (referrer ?? "").trim();
  if (ref.length === 0) return "direct";
  for (const { test, source } of REFERER_PATTERNS) {
    if (test.test(ref)) return source;
  }
  return "other";
}

/**
 * Track un événement "Page Referer Source" Plausible avec la source LLM/SERP
 * détectée. À appeler au mount d'une page côté client (cf. `<RefererTracker />`).
 * No-op si window.plausible absent ou si la source est "direct" (bruit).
 */
export function trackRefererSource(referrer: string | null | undefined): void {
  const source = detectSearchEngine(referrer);
  if (source === "direct") return;
  trackEvent("Page Referer Source", { props: { source } });
}
