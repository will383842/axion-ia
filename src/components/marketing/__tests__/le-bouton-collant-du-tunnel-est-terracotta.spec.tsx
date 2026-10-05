/**
 * Le bouton collant des pages du tunnel apporteurs est TERRACOTTA : la charte
 * d'Axion-IA réserve le bleu aux liens. Le bouton par défaut des autres pages
 * du site ne change pas.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";

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

describe("StickyMobileCta — masqué tant que le formulaire est visible", () => {
  type Rappel = (e: Array<{ isIntersecting: boolean }>) => void;
  let rappel: Rappel | null = null;
  let deconnecte = false;

  class FauxObservateur {
    constructor(cb: Rappel) {
      rappel = cb;
    }
    observe() {}
    disconnect() {
      deconnecte = true;
    }
  }

  afterEach(() => {
    rappel = null;
    deconnecte = false;
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  function monter() {
    vi.stubGlobal("IntersectionObserver", FauxObservateur);
    const formulaire = document.createElement("div");
    formulaire.id = "vsl-formulaire";
    document.body.appendChild(formulaire);
    // Page défilée au-delà du seuil, loin du bas : le bouton serait affiché.
    Object.defineProperty(window, "scrollY", { value: 800, configurable: true });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 5000,
      configurable: true,
    });
    return render(
      <StickyMobileCta
        href="#x"
        label="Je candidate"
        couleur="terracotta"
        masquerQuandVisible="vsl-formulaire"
      />,
    );
  }

  const barre = (c: HTMLElement) => c.querySelector("div[aria-hidden]") as HTMLElement;

  it("s'affiche au défilement, se masque quand le formulaire entre à l'écran, revient quand il en sort", () => {
    const { container } = monter();
    expect(barre(container).getAttribute("aria-hidden")).toBe("false");

    act(() => rappel?.([{ isIntersecting: true }]));
    expect(barre(container).getAttribute("aria-hidden")).toBe("true");
    expect(barre(container).className).toContain("translate-y-full");

    act(() => rappel?.([{ isIntersecting: false }]));
    expect(barre(container).getAttribute("aria-hidden")).toBe("false");
  });

  it("sans prop, aucun observateur : les autres pages ne changent pas", () => {
    vi.stubGlobal("IntersectionObserver", FauxObservateur);
    Object.defineProperty(window, "scrollY", { value: 800, configurable: true });
    render(<StickyMobileCta href="#x" label="Réserver" />);
    expect(rappel).toBeNull();
  });

  it("n'ajoute aucune animation hors du glissement existant (reduced-motion respecté) et nettoie l'observateur", () => {
    const { container, unmount } = monter();
    expect(barre(container).className).toContain("motion-reduce:transition-none");
    unmount();
    expect(deconnecte).toBe(true);
  });
});
