/**
 * Sprint S+4-B City Domination 2026-05-18 — validation des fiches détail
 * outils stack-ia (`_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/
 * 20-TYPE-9-STACK-IA.md` gap P1-17).
 *
 * Garanties :
 * - 11 fiches exactement (1:1 avec `STACK_TOOLS`).
 * - Aucun outil de `STACK_TOOLS` sans fiche détail correspondante.
 * - Aucun slug `comparableSlugs` qui pointe vers un outil inexistant
 *   (mesh interne sans 404).
 * - Tous les champs requis sont présents et non vides en FR + EN.
 * - Le `useCases` array contient 3-5 items (cible AEO Product).
 */

import { describe, it, expect } from "vitest";
import { STACK_TOOLS } from "@/content/stack-ia";
import {
  STACK_TOOL_DETAILS,
  getAllStackToolDetails,
  getAllStackToolSlugs,
  getStackToolByDetailSlug,
  getComparableStackTools,
} from "@/content/stack-ia-details";

const LOCALES = ["fr", "en"] as const;

describe("stack-ia-details · cardinalité", () => {
  it("contient exactement 11 fiches détail (1 par outil de STACK_TOOLS)", () => {
    expect(STACK_TOOL_DETAILS.length).toBe(11);
    expect(STACK_TOOLS.length).toBe(11);
  });

  it("a un slug par outil de STACK_TOOLS (alignement 1:1)", () => {
    const toolIds = new Set(STACK_TOOLS.map((t) => t.id));
    const detailIds = new Set(STACK_TOOL_DETAILS.map((d) => d.id));
    expect(detailIds.size).toBe(toolIds.size);
    for (const id of toolIds) {
      expect(detailIds.has(id)).toBe(true);
    }
  });

  it("utilise des slugs uniques", () => {
    const ids = STACK_TOOL_DETAILS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("stack-ia-details · contenu requis", () => {
  it.each(LOCALES)("expose tous les champs FR+EN non vides en %s", (loc) => {
    for (const detail of STACK_TOOL_DETAILS) {
      const copy = detail[loc];
      // Summary : cible 50-80 mots (TL;DR AEO).
      expect(copy.summary.length).toBeGreaterThan(80);
      expect(copy.summary.length).toBeLessThan(800);
      // 3 pros + 3 cons + 3-5 useCases.
      expect(copy.pros.length).toBe(3);
      expect(copy.cons.length).toBe(3);
      expect(copy.useCases.length).toBeGreaterThanOrEqual(3);
      expect(copy.useCases.length).toBeLessThanOrEqual(5);
      // Verdict : 1-2 phrases.
      expect(copy.axionVerdict.length).toBeGreaterThan(20);
      // Aucun item vide.
      for (const p of copy.pros) expect(p.trim().length).toBeGreaterThan(0);
      for (const c of copy.cons) expect(c.trim().length).toBeGreaterThan(0);
      for (const u of copy.useCases) expect(u.trim().length).toBeGreaterThan(0);
    }
  });

  it("déclare un `pricingTier` parmi les valeurs supportées", () => {
    const valid = new Set(["free", "freemium", "paid", "enterprise"]);
    for (const d of STACK_TOOL_DETAILS) expect(valid.has(d.pricingTier)).toBe(true);
  });

  it("déclare au moins 1 région d'hébergement valide", () => {
    const valid = new Set(["US", "EU", "France", "On-prem"]);
    for (const d of STACK_TOOL_DETAILS) {
      expect(d.hostingRegions.length).toBeGreaterThanOrEqual(1);
      for (const r of d.hostingRegions) expect(valid.has(r)).toBe(true);
    }
  });

  it("déclare 2-3 slugs comparables qui pointent vers des outils existants", () => {
    const allIds = new Set(STACK_TOOL_DETAILS.map((d) => d.id));
    for (const d of STACK_TOOL_DETAILS) {
      expect(d.comparableSlugs.length).toBeGreaterThanOrEqual(2);
      expect(d.comparableSlugs.length).toBeLessThanOrEqual(3);
      // Aucun self-référencement.
      expect(d.comparableSlugs).not.toContain(d.id);
      // Tous les comparables existent.
      for (const cmp of d.comparableSlugs) {
        expect(allIds.has(cmp)).toBe(true);
      }
    }
  });
});

describe("stack-ia-details · helpers", () => {
  it("getAllStackToolDetails retourne la liste canonique", () => {
    expect(getAllStackToolDetails().length).toBe(STACK_TOOL_DETAILS.length);
  });

  it("getAllStackToolSlugs retourne 11 slugs", () => {
    const slugs = getAllStackToolSlugs();
    expect(slugs.length).toBe(11);
    expect(new Set(slugs).size).toBe(11);
  });

  it("getStackToolByDetailSlug résout un outil connu", () => {
    const resolved = getStackToolByDetailSlug("claude");
    expect(resolved).toBeDefined();
    expect(resolved?.tool.name).toBe("Claude");
    expect(resolved?.detail.id).toBe("claude");
  });

  it("getStackToolByDetailSlug retourne undefined pour un slug inconnu", () => {
    expect(getStackToolByDetailSlug("does-not-exist")).toBeUndefined();
  });

  it("getComparableStackTools résout uniquement les outils existants", () => {
    const detail = STACK_TOOL_DETAILS.find((d) => d.id === "claude")!;
    const cmps = getComparableStackTools(detail);
    expect(cmps.length).toBe(detail.comparableSlugs.length);
    for (const cmp of cmps) {
      expect(detail.comparableSlugs).toContain(cmp.tool.id);
    }
  });
});
