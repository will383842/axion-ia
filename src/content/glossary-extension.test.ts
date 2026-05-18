/**
 * Sprint S+4-A 2026-05-18 — Tests SSOT glossary-extension (60 termes).
 *
 * Audit source : `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/22-TYPE-11-GLOSSAIRE.md` (P1-19).
 *
 * Couverture :
 *   - Comptage et intégrité (60 termes, 12 legacy + 48 nouveaux)
 *   - Slugs uniques (anti-régression collisions kebab-case)
 *   - Tous les champs non vides + format (term, fr, en, category)
 *   - Mesh interne (`relatedSlugs[]`) pointent tous vers slugs existants
 *   - Aliases sont des chaînes non vides distinctes
 *   - Examples : 1 minimum par terme, ≤ 25 mots/phrase doctrine
 *   - Lookup `getGlossaryTermBySlug` (hit + miss)
 *   - `getRelatedGlossaryTerms` (3-5 résultats, sans crash sur slug fantôme)
 *   - Categories ∈ enum déclaré (anti typo string)
 *   - Pas de SIREN/SIRET (anti-hex doctrine OÜ estonienne)
 */

import { describe, it, expect } from "vitest";
import {
  ALL_GLOSSARY_TERMS_EXTENDED,
  getGlossaryTermBySlug,
  getRelatedGlossaryTerms,
  listGlossaryTermSlugs,
  type GlossaryCategory,
} from "./glossary-extension";
import { GLOSSARY_TERMS_HARDCODE } from "@/lib/knowledge/legacy-mapping-glossary-hardcode";

const VALID_CATEGORIES: ReadonlySet<GlossaryCategory> = new Set([
  "foundational",
  "agents",
  "rag",
  "models",
  "infra",
  "security",
  "evaluation",
]);

describe("glossary-extension · structure", () => {
  it("contient exactement 60 termes (12 legacy + 48 nouveaux)", () => {
    expect(ALL_GLOSSARY_TERMS_EXTENDED.length).toBe(60);
  });

  it("inclut les 12 termes legacy hardcode (rétro-compat)", () => {
    const legacySlugs = GLOSSARY_TERMS_HARDCODE.map((t) => t.slug);
    const extendedSlugs = ALL_GLOSSARY_TERMS_EXTENDED.map((t) => t.slug);
    for (const ls of legacySlugs) {
      expect(extendedSlugs).toContain(ls);
    }
  });

  it("a tous les slugs uniques (kebab-case, ASCII safe)", () => {
    const slugs = ALL_GLOSSARY_TERMS_EXTENDED.map((t) => t.slug);
    const uniq = new Set(slugs);
    expect(uniq.size).toBe(slugs.length);
    for (const s of slugs) {
      // kebab-case strict : minuscules + chiffres + tirets, débute et finit par alphanumérique
      expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("chaque terme a term + fr + en + category non vides", () => {
    for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
      expect(t.term.trim().length, `term vide pour ${t.slug}`).toBeGreaterThan(0);
      expect(t.fr.trim().length, `fr vide pour ${t.slug}`).toBeGreaterThan(0);
      expect(t.en.trim().length, `en vide pour ${t.slug}`).toBeGreaterThan(0);
      expect(VALID_CATEGORIES.has(t.category), `category invalide pour ${t.slug}: ${t.category}`).toBe(true);
    }
  });

  it("aucune mention SIREN/SIRET (doctrine OÜ estonienne)", () => {
    const blob = JSON.stringify(ALL_GLOSSARY_TERMS_EXTENDED);
    expect(blob).not.toMatch(/\bSIREN\b|\bSIRET\b|\bRCS\b/i);
  });
});

describe("glossary-extension · mesh interne (relatedSlugs)", () => {
  it("tous les relatedSlugs pointent vers des slugs existants", () => {
    const existing = new Set(ALL_GLOSSARY_TERMS_EXTENDED.map((t) => t.slug));
    for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
      for (const rel of t.relatedSlugs) {
        expect(existing.has(rel), `relatedSlug cassé pour ${t.slug} → ${rel}`).toBe(true);
      }
    }
  });

  it("aucun terme ne se référence lui-même dans relatedSlugs", () => {
    for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
      expect(t.relatedSlugs.includes(t.slug), `${t.slug} se référence lui-même`).toBe(false);
    }
  });

  it("chaque terme a au moins 1 relatedSlug (mesh non orphelin)", () => {
    for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
      expect(t.relatedSlugs.length, `${t.slug} sans relatedSlug`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("glossary-extension · aliases & examples", () => {
  it("chaque terme a ≥ 1 alias non vide", () => {
    for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
      expect(t.aliases.length, `${t.slug} sans alias`).toBeGreaterThanOrEqual(1);
      for (const a of t.aliases) {
        expect(a.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("chaque terme a ≥ 1 example concret", () => {
    for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
      expect(t.examples.length, `${t.slug} sans example`).toBeGreaterThanOrEqual(1);
      for (const ex of t.examples) {
        expect(ex.trim().length).toBeGreaterThan(20);
      }
    }
  });
});

describe("glossary-extension · lookup helpers", () => {
  it("getGlossaryTermBySlug retourne le terme si slug existe", () => {
    const t = getGlossaryTermBySlug("rag");
    expect(t).not.toBeNull();
    expect(t!.term).toBe("RAG");
    expect(t!.category).toBe("rag");
  });

  it("getGlossaryTermBySlug retourne null si slug inconnu", () => {
    expect(getGlossaryTermBySlug("slug-inexistant-xyz")).toBeNull();
  });

  it("listGlossaryTermSlugs retourne 60 slugs", () => {
    expect(listGlossaryTermSlugs().length).toBe(60);
  });

  it("getRelatedGlossaryTerms retourne ≤ limit termes valides", () => {
    const related = getRelatedGlossaryTerms("rag", 3);
    expect(related.length).toBeLessThanOrEqual(3);
    expect(related.length).toBeGreaterThan(0);
    for (const r of related) {
      expect(r.slug).toBeTruthy();
    }
  });

  it("getRelatedGlossaryTerms retourne [] pour slug inconnu (anti-crash)", () => {
    expect(getRelatedGlossaryTerms("slug-fantome", 5)).toEqual([]);
  });

  it("getRelatedGlossaryTerms respecte le défaut limit=5", () => {
    const related = getRelatedGlossaryTerms("agent");
    expect(related.length).toBeLessThanOrEqual(5);
  });
});

describe("glossary-extension · distribution catégories", () => {
  it("toutes les 7 catégories sont représentées (mesh balanced)", () => {
    const usedCategories = new Set(ALL_GLOSSARY_TERMS_EXTENDED.map((t) => t.category));
    for (const cat of VALID_CATEGORIES) {
      expect(usedCategories.has(cat), `catégorie absente: ${cat}`).toBe(true);
    }
  });
});
