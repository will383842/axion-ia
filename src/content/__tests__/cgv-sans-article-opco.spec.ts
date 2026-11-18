/**
 * Les CGV ne contiennent plus d'article de financement par un OPCO (retiré le 18/11/2026,
 * décision du dirigeant : aucune mention OPCO ni prise en charge sur le site public).
 */
import { describe, expect, it } from "vitest";
import { getLegal } from "@/content/legal";

const CGV = getLegal("conditions-generales");

describe("CGV sans article OPCO", () => {
  it.each(["fr", "en"] as const)("aucun article OPCO ni subrogation (%s)", (locale) => {
    const texte = CGV[locale].sections.map((s) => `${s.title} ${s.body}`).join("\n");
    expect(texte).not.toMatch(/OPCO|subrogation/i);
  });
});
