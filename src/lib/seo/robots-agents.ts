// Les robots que nous bloquons, et les robots d'IA que nous laissons lire — UNE seule liste,
// lue par `robots.txt` (src/app/robots.ts) et par `ai.txt` (src/app/ai.txt/route.ts).
//
// Décision du fondateur : option « cité partout ». Les robots d'IA (citation ET
// entraînement) héritent du groupe `*` de robots.txt ; seuls les scrapers parasites
// ci-dessous sont bloqués. `ai.txt` disait l'inverse (« ai-training: disallow » pour
// GPTBot, ClaudeBot, Google-Extended, CCBot) : deux fichiers officiels contradictoires,
// corrigé le 2026-11-11 en dérivant les deux de cette liste.

/** Scrapers parasites sans valeur retour : les seuls robots bloqués. */
export const BOTS_BLOQUES = [
  "Bytespider", // TikTok
  "omgili", // scraper parasite
  "Diffbot", // scraper sans retour
] as const;

/**
 * Robots d'IA nommés dans `ai.txt`. Ils n'ont AUCUNE règle propre dans robots.txt :
 * ils héritent du groupe `*` (cf. `robots.spec.ts`, « option A cité partout »).
 */
export const AGENTS_IA_AUTORISES = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "Claude-SearchBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "PerplexityBot",
  "CCBot",
  "Bingbot",
] as const;
