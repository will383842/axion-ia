/**
 * KB V4 — Tests quality gates heuristiques.
 */

import { describe, expect, it } from "vitest";
import { runHeuristicGates } from "./quality-gates";

const LONG_BODY = `<h2>Section 1</h2>${"<p>contenu réel avec des mots utiles.</p> ".repeat(80)}<h2>Section 2</h2><p>encore plus de contenu</p>`;

describe("runHeuristicGates", () => {
  it("OK sur article long avec H2 + https", () => {
    const r = runHeuristicGates({
      type: "article",
      title: "T",
      body: LONG_BODY,
    });
    expect(r.valid).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("REJECT si body < min words pour article", () => {
    const r = runHeuristicGates({
      type: "article",
      title: "T",
      body: "<h2>Court</h2><p>juste 10 mots dans ce body très court abc def</p>",
    });
    expect(r.valid).toBe(false);
    expect(r.violations.map((v) => v.gate)).toContain("min_word_count");
  });

  it("OK si type faq malgré body court", () => {
    const r = runHeuristicGates({
      type: "faq",
      title: "T",
      body: "<p>juste 10 mots ok pour faq</p>",
    });
    expect(r.valid).toBe(true);
  });

  it("REJECT si pas de H2 sur article long", () => {
    const r = runHeuristicGates({
      type: "article",
      title: "T",
      body: "<p>" + "mot ".repeat(500) + "</p>",
    });
    expect(r.violations.map((v) => v.gate)).toContain("no_h2_heading");
  });

  it("REJECT si lien http (non-https)", () => {
    const r = runHeuristicGates({
      type: "article",
      title: "T",
      body: LONG_BODY + '<a href="http://insecure.com">link</a>',
    });
    expect(r.violations.map((v) => v.gate)).toContain("non_https_links");
  });

  it("REJECT si iframe non whitelisté", () => {
    const r = runHeuristicGates({
      type: "article",
      title: "T",
      body: LONG_BODY + '<iframe src="https://evil.com/widget"></iframe>',
    });
    expect(r.violations.map((v) => v.gate)).toContain("non_whitelisted_embed");
  });

  it("OK avec iframe YouTube", () => {
    const r = runHeuristicGates({
      type: "article",
      title: "T",
      body: LONG_BODY + '<iframe src="https://www.youtube.com/embed/abc"></iframe>',
    });
    expect(r.valid).toBe(true);
  });

  it("OK avec iframe Vimeo", () => {
    const r = runHeuristicGates({
      type: "article",
      title: "T",
      body: LONG_BODY + '<iframe src="https://player.vimeo.com/video/123"></iframe>',
    });
    expect(r.valid).toBe(true);
  });

  it("OK avec iframe Loom", () => {
    const r = runHeuristicGates({
      type: "article",
      title: "T",
      body: LONG_BODY + '<iframe src="https://www.loom.com/embed/abc"></iframe>',
    });
    expect(r.valid).toBe(true);
  });
});
