/**
 * KB Ingest — robots.txt + ai.txt compliance helper.
 *
 * City Domination 2026-05-18 P0-12 — A13 audit a relevé que `url-extractor.ts`
 * et `sitemap-parser.ts` fetchaient des URLs externes sans respecter les
 * directives `Disallow` / `Crawl-Delay` des sources. Risques :
 *   - Légal : violation Terms of Service de la source → bloc IP, action légale
 *   - SEO : Googlebot pénalise les bots non-conformes (signal Spam Brain)
 *   - Éthique : ingérer du contenu opt-out détériore réputation Axion-IA
 *
 * Spec : RFC 9309 (robots.txt) + Spawning.ai ai.txt draft.
 *
 * Stratégie :
 *   1. Avant chaque fetch d'URL externe, check `${origin}/robots.txt` :
 *      - Si Disallow match path pour notre User-Agent → skip URL (retour false)
 *      - Si Crawl-Delay > 0 → respect delay entre requêtes même origin
 *   2. Cache in-memory `{origin → RobotsRules}` TTL 10 min (évite re-fetch
 *      à chaque URL d'un sitemap géant).
 *   3. Fail-soft : si robots.txt absent (404) ou erreur réseau → assume allow
 *      (comportement standard Googlebot — pas de robots.txt = pas de restriction).
 *   4. Aussi check `${origin}/ai.txt` (Spawning.ai) si présent — directive
 *      `ai-training: disallow` ou `ai-citation: disallow` → skip.
 *
 * NB : on ne respecte volontairement PAS Allow + précédence longest-match
 * RFC 9309 strict — implémentation minimale couvrant 95 % des cas réels.
 */

import { ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";

const ROBOTS_FETCH_TIMEOUT_MS = 5_000;
const ROBOTS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
const OUR_USER_AGENTS = [
  "Axion-IA-KB-Ingest", // notre UA spécifique (cf. url-extractor.ts L29)
  "Axion-IA",
  "AxionIA",
  "*", // fallback générique
];

export interface RobotsRules {
  /** Path prefixes interdits pour notre UA (déjà filtrés). */
  readonly disallow: ReadonlyArray<string>;
  /** Path prefixes explicitement autorisés (override Disallow). */
  readonly allow: ReadonlyArray<string>;
  /** Crawl-Delay en millisecondes (0 = pas de delay). */
  readonly crawlDelayMs: number;
  /** True si ai.txt présent et `ai-training: disallow` ou `ai-citation: disallow`. */
  readonly aiOptedOut: boolean;
}

interface CacheEntry {
  readonly rules: RobotsRules;
  readonly fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

const EMPTY_RULES: RobotsRules = {
  disallow: [],
  allow: [],
  crawlDelayMs: 0,
  aiOptedOut: false,
};

function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/**
 * Parse robots.txt minimaliste — extrait Disallow / Allow / Crawl-Delay pour
 * notre UA. Respecte la convention des "user-agent blocks" séparés par lignes
 * vides. Le matching UA est case-insensitive (RFC 9309 §2.2.1).
 */
function parseRobotsTxt(text: string): RobotsRules {
  const lines = text.split(/\r?\n/);
  let currentApplies = false;
  let sawWildcardBlock = false;
  let sawOurUaBlock = false;
  const disallowOur: string[] = [];
  const allowOur: string[] = [];
  const disallowWildcard: string[] = [];
  const allowWildcard: string[] = [];
  let crawlDelayOur = 0;
  let crawlDelayWildcard = 0;

  // Tracking séparé : on a un bloc spécifique pour notre UA OU on récupère le
  // bloc wildcard "*". RFC 9309 : si bloc UA spécifique présent, le bloc "*"
  // est ignoré pour cet UA.
  let currentIsWildcard = false;
  let currentIsOurUa = false;

  for (const raw of lines) {
    const line = raw.split("#")[0]!.trim();
    if (!line) {
      // ligne vide = fin de bloc
      currentApplies = false;
      currentIsWildcard = false;
      currentIsOurUa = false;
      continue;
    }
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const field = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (field === "user-agent") {
      const ua = value.toLowerCase();
      if (ua === "*") {
        currentApplies = true;
        currentIsWildcard = true;
        currentIsOurUa = false;
        sawWildcardBlock = true;
      } else if (
        OUR_USER_AGENTS.some((our) => our.toLowerCase() === ua || ua.includes(our.toLowerCase()))
      ) {
        currentApplies = true;
        currentIsWildcard = false;
        currentIsOurUa = true;
        sawOurUaBlock = true;
      } else {
        // bloc pour un autre UA → ignoré
        currentApplies = false;
        currentIsWildcard = false;
        currentIsOurUa = false;
      }
      continue;
    }

    if (!currentApplies) continue;

    if (field === "disallow") {
      if (value === "") continue; // "Disallow:" vide = aucune restriction
      if (currentIsOurUa) disallowOur.push(value);
      else if (currentIsWildcard) disallowWildcard.push(value);
    } else if (field === "allow") {
      if (value === "") continue;
      if (currentIsOurUa) allowOur.push(value);
      else if (currentIsWildcard) allowWildcard.push(value);
    } else if (field === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) {
        const ms = Math.min(n * 1000, 30_000); // cap 30s pour ne pas hang
        if (currentIsOurUa) crawlDelayOur = ms;
        else if (currentIsWildcard) crawlDelayWildcard = ms;
      }
    }
  }

  // Priorité : si bloc spécifique pour notre UA → utilise-le, sinon wildcard.
  if (sawOurUaBlock) {
    return {
      disallow: disallowOur,
      allow: allowOur,
      crawlDelayMs: crawlDelayOur,
      aiOptedOut: false,
    };
  }
  if (sawWildcardBlock) {
    return {
      disallow: disallowWildcard,
      allow: allowWildcard,
      crawlDelayMs: crawlDelayWildcard,
      aiOptedOut: false,
    };
  }
  return EMPTY_RULES;
}

/**
 * Parse ai.txt (Spawning.ai draft) minimaliste — détecte `ai-training: disallow`
 * ou `ai-citation: disallow` au niveau global ou pour notre UA.
 */
function parseAiTxt(text: string): boolean {
  const lines = text.split(/\r?\n/);
  let currentApplies = true; // global par défaut (avant tout User-Agent:)

  for (const raw of lines) {
    const line = raw.split("#")[0]!.trim();
    if (!line) {
      currentApplies = true; // reset bloc
      continue;
    }
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const field = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line
      .slice(colonIdx + 1)
      .trim()
      .toLowerCase();

    if (field === "user-agent") {
      const ua = value;
      currentApplies =
        ua === "*" ||
        OUR_USER_AGENTS.some((our) => our.toLowerCase() === ua || ua.includes(our.toLowerCase()));
      continue;
    }

    if (!currentApplies) continue;

    if ((field === "ai-training" || field === "ai-citation") && value === "disallow") {
      return true;
    }
  }
  return false;
}

async function fetchTextSoft(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await ssrfSafeFetch(url, {
      headers: { "User-Agent": OUR_USER_AGENTS[0]!, Accept: "text/plain" },
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getRobotsRules(origin: string): Promise<RobotsRules> {
  const cached = cache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_CACHE_TTL_MS) {
    return cached.rules;
  }

  const [robotsText, aiTxtText] = await Promise.all([
    fetchTextSoft(`${origin}/robots.txt`, ROBOTS_FETCH_TIMEOUT_MS),
    fetchTextSoft(`${origin}/ai.txt`, ROBOTS_FETCH_TIMEOUT_MS),
  ]);

  const baseRules = robotsText ? parseRobotsTxt(robotsText) : EMPTY_RULES;
  const aiOptedOut = aiTxtText ? parseAiTxt(aiTxtText) : false;
  const rules: RobotsRules = { ...baseRules, aiOptedOut };

  cache.set(origin, { rules, fetchedAt: Date.now() });
  return rules;
}

/**
 * Vérifie si une URL externe est autorisée à être fetché par notre KB ingest.
 * Returns:
 *   - { allowed: true,  crawlDelayMs: 0  } si OK
 *   - { allowed: false, reason: ... }     si bloqué
 *
 * Le caller doit respecter `crawlDelayMs` (await sleep) entre requêtes même
 * origin pour éviter rate-limit côté source.
 */
export async function checkUrlAllowed(
  url: string,
): Promise<
  | { readonly allowed: true; readonly crawlDelayMs: number }
  | { readonly allowed: false; readonly reason: string }
> {
  const origin = originOf(url);
  if (origin === null) return { allowed: false, reason: "invalid-url" };

  const rules = await getRobotsRules(origin);

  if (rules.aiOptedOut) {
    return { allowed: false, reason: "ai-txt-opt-out" };
  }

  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return { allowed: false, reason: "invalid-url" };
  }

  // Si une règle Allow matche → autorise (override Disallow général).
  const allowMatch = rules.allow.find((p) => pathname.startsWith(p));
  if (allowMatch !== undefined) {
    return { allowed: true, crawlDelayMs: rules.crawlDelayMs };
  }

  // Si une règle Disallow matche → skip.
  const disallowMatch = rules.disallow.find((p) => p !== "" && pathname.startsWith(p));
  if (disallowMatch !== undefined) {
    return { allowed: false, reason: `disallow:${disallowMatch}` };
  }

  return { allowed: true, crawlDelayMs: rules.crawlDelayMs };
}

/** Pour les tests : vide le cache in-memory. */
export function _clearRobotsCache(): void {
  cache.clear();
}

/** Pour les tests : injection cache pré-rempli. */
export function _seedRobotsCache(origin: string, rules: RobotsRules): void {
  cache.set(origin, { rules, fetchedAt: Date.now() });
}
