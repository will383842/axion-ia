// P0-12 City Domination 2026-05-18 — A13 audit fix : robots.txt + ai.txt
// compliance pour KB ingest. Verrouille parsing minimal + matching UA +
// override Allow + détection ai-txt opt-out.

import { describe, it, expect, beforeEach } from "vitest";
import {
  checkUrlAllowed,
  _clearRobotsCache,
  _seedRobotsCache,
  type RobotsRules,
} from "../robots-respect";

const ORIGIN = "https://example.test";

function rules(partial: Partial<RobotsRules>): RobotsRules {
  return {
    disallow: partial.disallow ?? [],
    allow: partial.allow ?? [],
    crawlDelayMs: partial.crawlDelayMs ?? 0,
    aiOptedOut: partial.aiOptedOut ?? false,
  };
}

describe("checkUrlAllowed — robots-respect P0-12", () => {
  beforeEach(() => {
    _clearRobotsCache();
  });

  it("allow par défaut si robots.txt vide (cache empty rules)", async () => {
    _seedRobotsCache(ORIGIN, rules({}));
    const result = await checkUrlAllowed(`${ORIGIN}/article-1`);
    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.crawlDelayMs).toBe(0);
  });

  it("Disallow:/private bloque /private/article", async () => {
    _seedRobotsCache(ORIGIN, rules({ disallow: ["/private"] }));
    const result = await checkUrlAllowed(`${ORIGIN}/private/article`);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain("disallow:/private");
  });

  it("Allow:/private/public override Disallow:/private (longest-match-like)", async () => {
    _seedRobotsCache(ORIGIN, rules({ disallow: ["/private"], allow: ["/private/public"] }));
    const result = await checkUrlAllowed(`${ORIGIN}/private/public/article`);
    expect(result.allowed).toBe(true);
  });

  it("Disallow:/ bloque toutes les URLs", async () => {
    _seedRobotsCache(ORIGIN, rules({ disallow: ["/"] }));
    const result = await checkUrlAllowed(`${ORIGIN}/anything`);
    expect(result.allowed).toBe(false);
  });

  it("Crawl-Delay propagé au caller", async () => {
    _seedRobotsCache(ORIGIN, rules({ crawlDelayMs: 2000 }));
    const result = await checkUrlAllowed(`${ORIGIN}/foo`);
    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.crawlDelayMs).toBe(2000);
  });

  it("ai.txt opt-out bloque même si robots.txt allow", async () => {
    _seedRobotsCache(ORIGIN, rules({ aiOptedOut: true }));
    const result = await checkUrlAllowed(`${ORIGIN}/any`);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe("ai-txt-opt-out");
  });

  it("URL invalide → bloqué", async () => {
    const result = await checkUrlAllowed("not-a-url");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe("invalid-url");
  });

  it("URL d'origine différente (autre host) utilise un cache séparé", async () => {
    _seedRobotsCache("https://a.test", rules({ disallow: ["/"] }));
    _seedRobotsCache("https://b.test", rules({}));
    const a = await checkUrlAllowed("https://a.test/x");
    const b = await checkUrlAllowed("https://b.test/x");
    expect(a.allowed).toBe(false);
    expect(b.allowed).toBe(true);
  });
});
