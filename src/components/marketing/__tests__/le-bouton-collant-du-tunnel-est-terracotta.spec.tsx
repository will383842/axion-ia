/**
 * Le bouton collant des pages du tunnel apporteurs est TERRACOTTA : la charte
 * d'Axion-IA réserve le bleu aux liens. Le bouton par défaut des autres pages
 * du site ne change pas.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { StickyMobileCta } from "../StickyMobileCta";

function classes(el: HTMLElement): string {
  return Array.from(el.querySelectorAll("a"))
    .map((a) => a.className)
    .join(" ");
}

describe("StickyMobileCta — couleur terracotta", () => {
  it("n'a AUCUNE classe bleue ni primaire, et porte les jetons terracotta du site", () => {
    const { container } = render(
      <StickyMobileCta href="#x" label="Je candidate" couleur="terracotta" />,
    );
    const c = classes(container);
    expect(c).not.toMatch(/blue|bg-primary|text-primary|hover:bg-primary|ring-primary|indigo|sky/i);
    expect(c).toContain("bg-terracotta");
    expect(c).toContain("hover:bg-terracotta-deep");
    // Les deux boutons (barre mobile et pastille ordinateur).
    expect(container.querySelectorAll("a")).toHaveLength(2);
    for (const a of Array.from(container.querySelectorAll("a"))) {
      expect(a.className).toContain("bg-terracotta");
    }
  });

  it("sans `couleur`, les autres pages gardent leur bouton d'origine", () => {
    const { container } = render(<StickyMobileCta href="#x" label="Réserver" />);
    expect(classes(container)).toContain("bg-primary");
  });
});
