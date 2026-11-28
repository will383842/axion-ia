import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { FichePublique } from "@/lib/equipe";
import { CATEGORIES, CATEGORIES_IDS } from "@/lib/equipe";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { AvatarInitiales } from "../AvatarInitiales";
import { CarteCollaborateur } from "../CarteCollaborateur";
import { PastilleCategorie } from "../PastilleCategorie";
import { PortraitCollaborateur } from "../PortraitCollaborateur";

vi.mock("next/image", () => ({
  default: ({ fill: _f, priority: _p, ...props }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...(props as object)} />
  ),
}));

const base: FichePublique = {
  slug: "camille",
  categorie: "specialiste-ia",
  estDirigeantPrincipal: false,
  accord: "f",
  fonction: "Formatrice IA",
  reponseQui: "Camille forme des équipes.",
  ville: "Lyon",
  afficherSurCarte: true,
  nom: "Camille",
  initiales: "C",
};

describe("PastilleCategorie", () => {
  it.each(CATEGORIES_IDS)("%s : libellé, forme SVG masquée, couleur par jeton", (id) => {
    const { container } = render(<PastilleCategorie categorie={id} />);
    expect(container.textContent).toBe(CATEGORIES[id].libelleSingulier);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.innerHTML).toContain("var(--color-");
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
  });
  it("pluriel", () => {
    const { container } = render(<PastilleCategorie categorie="apporteur" pluriel />);
    expect(container.textContent).toBe("Apporteurs d'affaires");
  });
});

describe("AvatarInitiales", () => {
  it("SVG accessible, prénom seul, aucune image réseau", () => {
    const { container } = render(
      <AvatarInitiales initiales="C" nom="Camille" categorie="specialiste-ia" />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Avatar de Camille");
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("PortraitCollaborateur", () => {
  it("sans photo : avatar, conteneur carré réservé", () => {
    const { container } = render(<PortraitCollaborateur fiche={base} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.firstElementChild?.className).toContain("aspect-square");
  });
  it("photo sans consentement daté : avatar", () => {
    const fiche = {
      ...base,
      photo: { src: "/p.jpg", largeur: 800, hauteur: 800, alt: "Portrait de Camille" },
    };
    const { container } = render(<PortraitCollaborateur fiche={fiche} />);
    expect(container.querySelector("img")).toBeNull();
  });
  it("consentement non daté (texte libre) : avatar", () => {
    const fiche = {
      ...base,
      photo: { src: "/p.jpg", largeur: 8, hauteur: 8, alt: "x", consentementLe: "oui" },
    };
    expect(
      render(<PortraitCollaborateur fiche={fiche} />).container.querySelector("img"),
    ).toBeNull();
  });
  it("decoratif : avatar masqué aux lecteurs d'écran", () => {
    const { container } = render(<PortraitCollaborateur fiche={base} decoratif />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("[role=img]")).toBeNull();
  });
  it("photo avec consentement : image, alt fourni", () => {
    const fiche = {
      ...base,
      photo: {
        src: "/p.jpg",
        largeur: 800,
        hauteur: 800,
        alt: "Portrait de Camille",
        consentementLe: "2026-11-01",
      },
    };
    const { container } = render(<PortraitCollaborateur fiche={fiche} />);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Portrait de Camille");
    expect(container.firstElementChild?.className).toContain("aspect-square");
  });
});

describe("CarteCollaborateur", () => {
  it("titre = prénom seul, un seul lien, niveau réglable", () => {
    const { container } = render(<CarteCollaborateur fiche={base} href="/fr/equipe/camille" />);
    expect(container.querySelector("h3")?.textContent).toBe("Camille");
    const liens = container.querySelectorAll("a");
    expect(liens).toHaveLength(1);
    expect(liens[0]?.getAttribute("href")).toBe("/fr/equipe/camille");
    const h2 = render(<CarteCollaborateur fiche={base} href="/x" niveauTitre="h2" />);
    expect(h2.container.querySelector("h2")).not.toBeNull();
  });
});

describe("FaqAccordion questionAs", () => {
  const items = [{ id: "q", question: "Qui ?", answer: "Nous." }];
  it("par défaut : pas de titre (HTML inchangé)", () => {
    const { container } = render(<FaqAccordion items={items} emitJsonLd={false} />);
    expect(container.querySelector("h3")).toBeNull();
    expect(container.querySelector("summary > span[data-faq-q]")).not.toBeNull();
  });
  it('questionAs="h3" : la question est un h3 avec data-faq-q', () => {
    const { container } = render(<FaqAccordion items={items} emitJsonLd={false} questionAs="h3" />);
    expect(container.querySelector("summary > h3[data-faq-q]")?.textContent).toBe("Qui ?");
  });
});
