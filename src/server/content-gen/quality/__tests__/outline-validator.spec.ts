import { describe, expect, it } from "vitest";
import { validateOutline, outlineFeedback } from "../outline-validator";

describe("validateOutline (VIS-11)", () => {
  it("valide une structure correcte (1 H1 + H2 + H3 imbriqués)", () => {
    const html = "<h1>Titre</h1><h2>A</h2><h3>a1</h3><h2>B</h2><h3>b1</h3><h3>b2</h3>";
    const r = validateOutline(html, { minH2: 2 });
    expect(r.valid).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("détecte plusieurs H1", () => {
    const html = "<h1>Un</h1><h2>A</h2><h2>B</h2><h1>Deux</h1>";
    const r = validateOutline(html);
    expect(r.valid).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("multiple_h1");
  });

  it("détecte un manque de H2", () => {
    const html = "<h1>T</h1><h2>seul</h2>";
    const r = validateOutline(html, { minH2: 3 });
    expect(r.issues.map((i) => i.code)).toContain("missing_h2");
  });

  it("détecte un saut de niveau H2 → H4", () => {
    const html = "<h2>A</h2><h4>trop profond</h4><h2>B</h2>";
    const r = validateOutline(html);
    expect(r.issues.map((i) => i.code)).toContain("heading_level_skip");
  });

  it("détecte un H3 avant le 1er H2", () => {
    const html = "<h3>orphelin</h3><h2>A</h2><h2>B</h2>";
    const r = validateOutline(html);
    expect(r.issues.map((i) => i.code)).toContain("subheading_before_h2");
  });

  it("un seul H1 est accepté (le body content-gen peut en avoir 1, strippé au render)", () => {
    const html = "<h1>Titre keyword</h1><h2>A</h2><h2>B</h2>";
    const r = validateOutline(html, { minH2: 2 });
    expect(r.valid).toBe(true);
  });

  it("dédup les messages par code (un seul par type)", () => {
    const html = "<h2>A</h2><h4>x</h4><h2>B</h2><h4>y</h4>"; // 2 sauts
    const r = validateOutline(html);
    const skips = r.issues.filter((i) => i.code === "heading_level_skip");
    expect(skips).toHaveLength(1);
  });

  it("outlineFeedback renvoie '' si valide, une string sinon", () => {
    expect(outlineFeedback("<h1>T</h1><h2>A</h2><h2>B</h2>", { minH2: 2 })).toBe("");
    expect(outlineFeedback("<h3>x</h3>")).toContain("structure de titres");
  });
});
