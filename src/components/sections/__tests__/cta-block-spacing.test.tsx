/**
 * Le bloc d'appel à l'action se resserre en fin d'article, pas ailleurs.
 *
 * 2026-09-02 : après le premier correctif (PR 937), six blocs de fin d'article
 * gardaient encore le rythme d'une section de page — dont ce `CtaBlock`, qui
 * est aussi utilisé sur une vingtaine de pages marketing où le rythme large
 * est voulu. D'où une option, pas un changement global.
 */
// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CtaBlock } from "../CtaBlock";

function classesOf(ui: React.ReactElement): string {
  const { container } = render(ui);
  return container.querySelector("section")?.className ?? "";
}

describe("CtaBlock — spacing", () => {
  it("par défaut : bloc de page, 96 → 144 px (pages marketing inchangées)", () => {
    const cls = classesOf(<CtaBlock title="Parlons-en" cta={<span>Nous écrire</span>} />);
    expect(cls).toContain("py-24");
    expect(cls).toContain("lg:py-36");
    expect(cls).not.toContain("py-8");
  });

  it("compact : fin d'article, 32 → 48 px", () => {
    const cls = classesOf(
      <CtaBlock
        title="Mettre en pratique"
        spacing="compact"
        cta={<span>Voir nos formations</span>}
      />,
    );
    expect(cls).toContain("py-8");
    expect(cls).toContain("lg:py-12");
    expect(cls).not.toContain("py-24");
    expect(cls).not.toContain("lg:py-36");
  });

  it("le ton reste indépendant de l'espacement", () => {
    const clair = classesOf(
      <CtaBlock title="x" tone="paper" spacing="compact" cta={<span>x</span>} />,
    );
    const sombre = classesOf(
      <CtaBlock title="x" tone="dark" spacing="compact" cta={<span>x</span>} />,
    );
    expect(clair).not.toBe(sombre);
    expect(clair).toContain("py-8");
    expect(sombre).toContain("py-8");
  });
});
