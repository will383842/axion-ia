/**
 * R5a (A03, décision n°7) — « Audit sur place · 1 journée » (1 190 €) est retiré :
 * /audit/tpe-1-jour redirige définitivement vers /journee-ia, et ne figure plus au sitemap.
 * Les autres pages d'audit n'écrivent plus aucun montant dans leurs titres.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";

const RACINE = process.cwd();
const lire = (rel: string) => readFileSync(path.join(RACINE, rel), "utf8");

describe("/audit/tpe-1-jour", () => {
  const src = lire("src/app/[locale]/audit/tpe-1-jour/page.tsx");

  it("redirige en permanence vers /journee-ia, sans rendre l'ancien audit", () => {
    expect(src).toContain("permanentRedirect");
    expect(src).toMatch(/\/journee-ia/);
    expect(src).not.toContain("AuditDetailPage");
    expect(src).not.toContain("formatAmount");
  });

  it("est exclue du sitemap (une URL qui redirige n'y a pas sa place)", () => {
    const sitemap = lire("src/app/sitemap.ts");
    expect(sitemap).toMatch(/EXCLUDED_FROM_INDEX[\s\S]*?"\/audit\/tpe-1-jour"/);
  });

  it("la page /journee-ia est déclarée dans routing.pathnames (donc au sitemap)", () => {
    expect(Object.keys(routing.pathnames)).toContain("/journee-ia");
  });
});

describe("pages d'audit : aucun montant dans les métadonnées", () => {
  for (const f of ["cible", "strategique-pme", "strategique-eti"]) {
    it(`/audit/${f} n'appelle plus formatAmount`, () => {
      const src = lire(`src/app/[locale]/audit/${f}/page.tsx`);
      expect(src).not.toContain("formatAmount");
      expect(src).not.toMatch(/priceMin|priceFlat/);
    });
  }
});
