/**
 * L'aperçu doit MONTRER le défaut, pas le décrire à côté.
 *
 * 🔴 CE QUE CETTE GARDE EMPÊCHE — recensement OG du 2026-08-17.
 *
 * La demande était « je veux voir la vignette telle qu'elle apparaîtra », pas
 * une liste de balises. Un écran qui afficherait la même carte quelle que soit
 * la taille du fichier raterait précisément le défaut qu'il existe pour
 * révéler : sous 1200 px de large, LinkedIn abandonne la grande carte et
 * n'affiche qu'une vignette carrée. C'était le cas des 134 articles de blog
 * servis en 1080 px.
 *
 * 🔑 Le test vérifie donc que la largeur MESURÉE change le RENDU, et pas
 * seulement un libellé posé à côté.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ApercuPartage } from "@/components/admin/site-explorer/ApercuPartage";

const BASE = {
  image: "https://axion-ia.com/og/blog/exemple.webp",
  titre: "Automatiser la relance client sans perdre la main",
  description: "Dix minutes pour comprendre ce qui se délègue et ce qui ne se délègue pas.",
  url: "https://axion-ia.com/fr/blog/exemple",
};

/** La grande carte LinkedIn porte le ratio 1200/675 ; la vignette est carrée. */
function classesImage(container: HTMLElement): string {
  return container.querySelector("img")?.getAttribute("class") ?? "";
}

describe("aperçu LinkedIn", () => {
  it("image ≥ 1200 px : grande carte", () => {
    const { container } = render(
      <ApercuPartage reseau="linkedin" {...BASE} largeurReelle={1200} />,
    );

    expect(classesImage(container)).toContain("aspect-[1200/675]");
  });

  it("🔴 image en 1080 px : le rendu BASCULE en vignette, comme LinkedIn le fait", () => {
    const { container } = render(
      <ApercuPartage reseau="linkedin" {...BASE} largeurReelle={1080} />,
    );

    const classes = classesImage(container);
    expect(classes).not.toContain("aspect-[1200/675]");
    expect(classes).toContain("h-20");
  });

  it("largeur inconnue : on montre la grande carte plutôt que d'annoncer un défaut non constaté", () => {
    const { container } = render(
      <ApercuPartage reseau="linkedin" {...BASE} largeurReelle={null} />,
    );

    expect(classesImage(container)).toContain("aspect-[1200/675]");
  });
});

describe("absence d'image", () => {
  it("le dit en clair au lieu d'afficher un cadre vide muet", () => {
    render(<ApercuPartage reseau="whatsapp" {...BASE} image={null} largeurReelle={null} />);

    expect(screen.getByText(/le lien se partagera nu/i)).toBeTruthy();
  });
});

describe("titre et description manquants", () => {
  it("sont signalés explicitement, jamais rendus par du vide", () => {
    render(
      <ApercuPartage
        reseau="whatsapp"
        {...BASE}
        titre={null}
        description={null}
        largeurReelle={1200}
      />,
    );

    expect(screen.getByText(/aucun titre de partage/i)).toBeTruthy();
    expect(screen.getByText(/aucune description/i)).toBeTruthy();
  });
});

describe("l'image affichée est l'URL EXACTE que le robot ira chercher", () => {
  it("aucune réécriture par l'optimiseur, sinon un fichier cassé passerait inaperçu", () => {
    const { container } = render(<ApercuPartage reseau="slack" {...BASE} largeurReelle={1200} />);

    expect(container.querySelector("img")?.getAttribute("src")).toBe(BASE.image);
  });
});
