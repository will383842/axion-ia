/**
 * Tests — `ai.txt` aligné sur `robots.txt` (audit GEO du 2026-11-11).
 *
 * Décision du fondateur : option « cité partout ». robots.txt laisse lire tous les robots
 * d'IA ; ai.txt les déclarait pourtant en « ai-training: disallow ». Les deux dérivent
 * maintenant de `src/lib/seo/robots-agents.ts`.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));

import { GET } from "./route";
import robots from "../robots";
import { AGENTS_IA_AUTORISES, BOTS_BLOQUES } from "@/lib/seo/robots-agents";

const CORPS = await GET().text();

/** Les directives d'un bloc `User-Agent: <agent>`. */
function bloc(agent: string): string {
  const parties = CORPS.split(/^User-Agent: /m);
  const trouve = parties.find((p) => p.split("\n")[0]?.trim() === agent);
  return trouve ?? "";
}

type Regle = { userAgent?: string | string[]; disallow?: string | string[] };
const REGLES = robots().rules as Regle[];

describe("ai.txt — même politique que robots.txt", () => {
  it("autorise l'entraînement et la citation par défaut", () => {
    expect(bloc("*")).toMatch(/ai-training: allow/);
    expect(bloc("*")).toMatch(/ai-citation: allow/);
  });

  it.each(["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"])(
    "%s : autorisé (il hérite du groupe * de robots.txt)",
    (agent) => {
      expect(bloc(agent)).toMatch(/ai-training: allow/);
      expect(bloc(agent)).not.toMatch(/disallow/);
    },
  );

  it("chaque robot d'IA nommé est autorisé, et robots.txt ne le bloque pas", () => {
    const bloquesRobots = REGLES.filter((r) =>
      ([] as string[]).concat(r.disallow ?? []).includes("/"),
    ).flatMap((r) => ([] as string[]).concat(r.userAgent ?? []));
    for (const agent of AGENTS_IA_AUTORISES) {
      expect(bloc(agent), agent).toMatch(/ai-training: allow/);
      expect(bloquesRobots, agent).not.toContain(agent);
    }
  });

  it("refuse exactement les robots que robots.txt bloque", () => {
    const bloquesRobots = REGLES.filter((r) =>
      ([] as string[]).concat(r.disallow ?? []).includes("/"),
    ).flatMap((r) => ([] as string[]).concat(r.userAgent ?? []));
    expect([...bloquesRobots].sort()).toEqual([...BOTS_BLOQUES].sort());
    const refusesAiTxt = CORPS.split(/^User-Agent: /m)
      .filter((p) => /ai-training: disallow/.test(p))
      .map((p) => p.split("\n")[0]?.trim());
    expect(refusesAiTxt.sort()).toEqual([...BOTS_BLOQUES].sort());
  });
});
