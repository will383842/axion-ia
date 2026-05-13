/**
 * KB-10 — Tests validation alt text. Pure.
 */

import { describe, expect, it } from "vitest";
import { validateAltText } from "./alt-text-validation";

describe("validateAltText", () => {
  it("retourne valid=true si aucune image", () => {
    const r = validateAltText("<p>texte sans image</p>");
    expect(r.valid).toBe(true);
    expect(r.totalImages).toBe(0);
  });

  it("retourne valid=true si image avec alt non vide", () => {
    const r = validateAltText('<img src="/a.png" alt="Description claire">');
    expect(r.valid).toBe(true);
    expect(r.totalImages).toBe(1);
    expect(r.imagesWithoutAlt).toBe(0);
  });

  it("retourne valid=false si image sans alt", () => {
    const r = validateAltText('<img src="/a.png">');
    expect(r.valid).toBe(false);
    expect(r.imagesWithoutAlt).toBe(1);
    expect(r.violations[0]!.src).toBe("/a.png");
  });

  it("retourne valid=false si alt vide", () => {
    const r = validateAltText('<img src="/a.png" alt="">');
    expect(r.valid).toBe(false);
    expect(r.imagesWithoutAlt).toBe(1);
  });

  it("retourne valid=false si alt='   ' (whitespace only)", () => {
    const r = validateAltText('<img src="/a.png" alt="   ">');
    expect(r.valid).toBe(false);
  });

  it("détecte plusieurs violations", () => {
    const r = validateAltText('<img src="/a.png"><img src="/b.png" alt="ok"><img src="/c.png">');
    expect(r.totalImages).toBe(3);
    expect(r.imagesWithoutAlt).toBe(2);
    expect(r.violations).toHaveLength(2);
  });

  it("accepte alt avec apostrophe single quote", () => {
    const r = validateAltText("<img src='/a.png' alt='Description'>");
    expect(r.valid).toBe(true);
  });
});
