/**
 * Un bloc d'article n'est pas une section de page.
 *
 * 2026-09-02, mesuré sur https://axion-ia.com/fr/blog/comment-former-dirigeants-ia :
 * page de 15 057 px, dix `<section class="py-24 sm:py-28 lg:py-36">` après le
 * corps de l'article, chacune 150 px de contenu entre 288 px de blanc. Le mode
 * `compact` ramène le rythme à 32 → 48 px ; le mode par défaut et le héros
 * (h1) ne bougent pas.
 */
// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Section } from "../Section";

function classesOf(ui: React.ReactElement): string {
  const { container } = render(ui);
  return container.querySelector("section")?.className ?? "";
}

describe("Section — spacing", () => {
  it("par défaut : section de page, 96 → 144 px", () => {
    const cls = classesOf(<Section title="Titre">x</Section>);
    expect(cls).toContain("py-24");
    expect(cls).toContain("lg:py-36");
    expect(cls).not.toContain("py-8");
  });

  it("compact : bloc d'article, 32 → 48 px", () => {
    const cls = classesOf(
      <Section spacing="compact" title="Titre">
        x
      </Section>,
    );
    expect(cls).toContain("py-8");
    expect(cls).toContain("lg:py-12");
    expect(cls).not.toContain("py-24");
    expect(cls).not.toContain("lg:py-36");
  });

  it("le héros (h1) garde son rythme propre, quel que soit spacing", () => {
    const cls = classesOf(
      <Section titleAs="h1" title="Héros" spacing="compact">
        x
      </Section>,
    );
    expect(cls).toContain("pt-12");
    expect(cls).not.toContain("py-8");
  });
});
