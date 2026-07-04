/**
 * Prospection — Respect de robots.txt (T5, local — décision D-T0-1).
 *
 * Ré-implémentation légère (on ne réutilise pas la brique content-gen pour rester
 * cloisonné). Parse les groupes `User-agent`, applique le nôtre + `*`, décide
 * `allow/disallow` par plus long préfixe. Fail-open : robots.txt absent/illisible
 * → tout est autorisé (comportement standard). `fetchImpl` injecté (testable).
 */

import { PROSPECTION_CRAWLER_USER_AGENT } from "@/lib/prospection/crawl-targets";

export interface RobotsRules {
  disallow: string[];
  allow: string[];
  crawlDelayMs: number;
}

export const ALLOW_ALL: RobotsRules = { disallow: [], allow: [], crawlDelayMs: 0 };

/** Parse un robots.txt pour un user-agent donné (+ groupe `*`). */
export function parseRobots(text: string, userAgent = PROSPECTION_CRAWLER_USER_AGENT): RobotsRules {
  const ua = userAgent.toLowerCase();
  const lines = text.split(/\r?\n/);
  // Regroupe par user-agent.
  const groups: Array<{ agents: string[]; rules: RobotsRules }> = [];
  let current: { agents: string[]; rules: RobotsRules } | null = null;
  let expectingAgent = false;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (line === "") continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "user-agent") {
      if (!expectingAgent || !current) {
        current = { agents: [], rules: { disallow: [], allow: [], crawlDelayMs: 0 } };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      expectingAgent = true;
    } else if (current) {
      expectingAgent = false;
      if (field === "disallow" && value) current.rules.disallow.push(value);
      else if (field === "allow" && value) current.rules.allow.push(value);
      else if (field === "crawl-delay") {
        const s = Number(value);
        if (Number.isFinite(s)) current.rules.crawlDelayMs = s * 1000;
      }
    }
  }
  // Priorité : groupe qui nomme notre UA, sinon `*`.
  const mine = groups.find((g) => g.agents.some((a) => ua.includes(a) && a !== "*"));
  const star = groups.find((g) => g.agents.includes("*"));
  return (mine ?? star)?.rules ?? { ...ALLOW_ALL };
}

/** Décide si un chemin est autorisé (plus long préfixe gagne ; allow > disallow à égalité). */
export function isPathAllowed(rules: RobotsRules, path: string): boolean {
  const matchLen = (patterns: string[]): number => {
    let best = -1;
    for (const p of patterns) {
      if (p === "") continue;
      if (path.startsWith(p) && p.length > best) best = p.length;
    }
    return best;
  };
  const dis = matchLen(rules.disallow);
  const allow = matchLen(rules.allow);
  if (dis < 0) return true;
  return allow >= dis; // à égalité ou plus spécifique → autorisé
}

export interface RobotsFetch {
  (url: string): Promise<{ ok: boolean; status: number; text: () => Promise<string> } | null>;
}

/** Récupère + parse le robots.txt d'une origine. Fail-open (absent → ALLOW_ALL). */
export async function fetchRobotsRules(
  origin: string,
  fetchImpl: RobotsFetch,
): Promise<RobotsRules> {
  try {
    const res = await fetchImpl(`${origin.replace(/\/$/, "")}/robots.txt`);
    if (!res || !res.ok) return { ...ALLOW_ALL };
    return parseRobots(await res.text());
  } catch {
    return { ...ALLOW_ALL };
  }
}
