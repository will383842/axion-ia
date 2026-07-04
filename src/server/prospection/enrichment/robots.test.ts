import { describe, it, expect } from "vitest";
import { parseRobots, isPathAllowed, fetchRobotsRules } from "./robots";

const ROBOTS = `
User-agent: *
Disallow: /private
Allow: /private/public
Crawl-delay: 2

User-agent: Axion-IA-Prospection
Disallow: /nope
`;

describe("parseRobots", () => {
  it("prend le groupe de notre UA en priorité", () => {
    const r = parseRobots(ROBOTS, "Axion-IA-Prospection");
    expect(r.disallow).toContain("/nope");
  });
  it("repli sur le groupe *", () => {
    const r = parseRobots(ROBOTS, "AutreBot");
    expect(r.disallow).toContain("/private");
    expect(r.crawlDelayMs).toBe(2000);
  });
});

describe("isPathAllowed — plus long préfixe", () => {
  const rules = { disallow: ["/private"], allow: ["/private/public"], crawlDelayMs: 0 };
  it("bloque /private", () => {
    expect(isPathAllowed(rules, "/private/data")).toBe(false);
  });
  it("autorise /private/public (allow plus spécifique)", () => {
    expect(isPathAllowed(rules, "/private/public/x")).toBe(true);
  });
  it("autorise le reste", () => {
    expect(isPathAllowed(rules, "/contact")).toBe(true);
  });
});

describe("fetchRobotsRules — fail-open", () => {
  it("robots absent (404) → ALLOW_ALL", async () => {
    const r = await fetchRobotsRules("https://x.fr", async () => ({
      ok: false,
      status: 404,
      text: async () => "",
    }));
    expect(r.disallow).toEqual([]);
  });
  it("fetch jette → ALLOW_ALL", async () => {
    const r = await fetchRobotsRules("https://x.fr", async () => {
      throw new Error("net");
    });
    expect(isPathAllowed(r, "/anything")).toBe(true);
  });
});
