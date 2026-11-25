import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { STRATEGIC_PATHS } from "../indexnow-chemins";

describe("IndexNow — chemins stratégiques", () => {
  it("contient l'accueil et le hub des apporteurs d'affaires", () => {
    expect(STRATEGIC_PATHS).toContain("/");
    expect(STRATEGIC_PATHS).toContain("/devenir-commercial-ia");
  });

  it("n'a ni doublon ni chemin sans barre initiale, ni préfixe de locale", () => {
    expect(new Set(STRATEGIC_PATHS).size).toBe(STRATEGIC_PATHS.length);
    for (const p of STRATEGIC_PATHS) {
      expect(p.startsWith("/")).toBe(true);
      expect(p).not.toMatch(/^\/(fr|en)(\/|$)/);
    }
  });

  it("ne liste que des pages indexables : aucune landing mise en noindex le 09/11", () => {
    for (const p of ["/leboncoin", "/indeed", "/apporteur-affaires"]) {
      expect(STRATEGIC_PATHS).not.toContain(p);
    }
  });

  it("le script d'envoi importe la liste au lieu d'en porter une copie", () => {
    const script = readFileSync(join(process.cwd(), "scripts/indexnow-ping.ts"), "utf8");
    expect(script).toContain('from "../src/lib/seo/indexnow-chemins"');
    expect(script).not.toMatch(/const STRATEGIC_PATHS\s*=/);
  });
});
