/**
 * B.7 P0-6 — Tests outline-simhash.ts
 *
 * Couvre :
 * 1. extractOutline : h2 + h3 dans l'ordre, strip nested tags.
 * 2. extractOutline : retourne [] si aucun h2/h3.
 * 3. computeOutlineSimhash : retourne 16 hex chars valid.
 * 4. computeOutlineSimhash : null si bodyHtml sans outline.
 * 5. outlineHammingDistance : 0 pour identique, > 0 pour different.
 * 6. SimHash stable : meme outline = meme hash.
 * 7. SimHash discriminant : outlines tres differents = distance > 8.
 * 8. SimHash similar : outlines partiellement similaires = distance bornee.
 * 9. classifyOutlineDedup : verdicts duplicate / similar / ok.
 */

import { describe, it, expect } from "vitest";
import {
  extractOutline,
  computeOutlineSimhash,
  outlineHammingDistance,
  classifyOutlineDedup,
  OUTLINE_DEDUP_THRESHOLDS,
} from "../outline-simhash";

describe("extractOutline", () => {
  it("extracts h2 and h3 in document order", () => {
    const html = `
      <p>intro</p>
      <h2>Pourquoi auditer son IA ?</h2>
      <p>Le contexte...</p>
      <h3>Cadre legal RGPD</h3>
      <p>...</p>
      <h2>Comment proceder concretement</h2>
      <h3>Etape 1 - Inventaire</h3>
      <h3>Etape 2 - Analyse risques</h3>
    `;
    expect(extractOutline(html)).toEqual([
      "Pourquoi auditer son IA ?",
      "Cadre legal RGPD",
      "Comment proceder concretement",
      "Etape 1 - Inventaire",
      "Etape 2 - Analyse risques",
    ]);
  });

  it("returns empty array when no h2/h3", () => {
    expect(extractOutline("<p>Just paragraphs</p><h1>only h1</h1>")).toEqual([]);
  });

  it("strips nested HTML tags from heading text", () => {
    const html = `<h2>Audit <strong>RGPD</strong> en <em>PME</em></h2>`;
    expect(extractOutline(html)).toEqual(["Audit RGPD en PME"]);
  });

  it("handles attributes and multiline tags", () => {
    const html = `<h2 id="x" class="title"
                    data-foo="bar">Audit RGPD</h2>`;
    expect(extractOutline(html)).toEqual(["Audit RGPD"]);
  });
});

describe("computeOutlineSimhash", () => {
  it("returns 16 hex chars for valid outline", () => {
    const html = `<h2>Pourquoi auditer</h2><h2>Comment auditer</h2><h2>Combien ca coute</h2>`;
    const hash = computeOutlineSimhash(html);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("returns null when no outline", () => {
    expect(computeOutlineSimhash("<p>no headings</p>")).toBeNull();
    expect(computeOutlineSimhash("")).toBeNull();
  });

  it("is deterministic (same input → same hash)", () => {
    const html = `<h2>Audit RGPD</h2><h2>Mise en conformite</h2><h3>Process etape par etape</h3>`;
    const a = computeOutlineSimhash(html);
    const b = computeOutlineSimhash(html);
    expect(a).toBe(b);
  });

  it("produces different hashes for very different outlines", () => {
    const a = computeOutlineSimhash(`
      <h2>Audit conformite RGPD pour PME</h2>
      <h2>Cartographie processus IA</h2>
      <h2>Plan action 90 jours</h2>
    `);
    const b = computeOutlineSimhash(`
      <h2>Recette pate carbonara italienne</h2>
      <h2>Choisir ses ingredients italiens</h2>
      <h2>Astuces cuisson pates al dente</h2>
    `);
    expect(a).not.toBe(b);
    const dist = outlineHammingDistance(a!, b!);
    // Outlines sur sujets opposes = distance attendue > 8 (couche similar/ok).
    expect(dist).toBeGreaterThan(OUTLINE_DEDUP_THRESHOLDS.SIMILAR);
  });
});

describe("outlineHammingDistance", () => {
  it("returns 0 for identical hashes", () => {
    expect(outlineHammingDistance("0123456789abcdef", "0123456789abcdef")).toBe(0);
  });

  it("returns 1 for single-bit difference", () => {
    // 0 → 1 = bit difference 1.
    expect(outlineHammingDistance("0000000000000000", "0000000000000001")).toBe(1);
  });

  it("returns 64 for opposite all bits", () => {
    expect(outlineHammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);
  });

  it("returns -1 for invalid length", () => {
    expect(outlineHammingDistance("abc", "def")).toBe(-1);
  });

  it("returns -1 for non-hex chars", () => {
    expect(outlineHammingDistance("0123456789abcdez", "0123456789abcdef")).toBe(-1);
  });
});

describe("classifyOutlineDedup", () => {
  it("classifies distance <= 4 as duplicate_template", () => {
    expect(classifyOutlineDedup(0).verdict).toBe("duplicate_template");
    expect(classifyOutlineDedup(4).verdict).toBe("duplicate_template");
  });

  it("classifies distance 5-8 as similar", () => {
    expect(classifyOutlineDedup(5).verdict).toBe("similar");
    expect(classifyOutlineDedup(8).verdict).toBe("similar");
  });

  it("classifies distance > 8 as ok", () => {
    expect(classifyOutlineDedup(9).verdict).toBe("ok");
    expect(classifyOutlineDedup(32).verdict).toBe("ok");
  });

  it("returns ok with invalid distance (-1)", () => {
    expect(classifyOutlineDedup(-1).verdict).toBe("ok");
  });

  it("includes distance in reason", () => {
    expect(classifyOutlineDedup(3).reason).toContain("3/64");
  });
});
