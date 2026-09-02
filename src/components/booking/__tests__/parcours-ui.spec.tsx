/**
 * Verrou — les sorties d'un écran de fin se visent au pouce.
 *
 * Mesuré le 2026-09-02 à 375 px : après une annulation, « Reprendre un
 * rendez-vous » était un lien texte de 21 px de haut, replié sur deux lignes
 * avec « · Retour à l'accueil ». La sortie principale est un bouton de 44 px
 * sur toute la largeur du téléphone ; la secondaire garde une hauteur de
 * cible minimale. Un test jsdom ne mesure pas des pixels : il vérifie que les
 * classes qui les produisent sont là, et que les deux sorties sont des liens.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { TeteDeParcours, SortiesDeParcours } from "../parcours-ui";

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

describe("<TeteDeParcours>", () => {
  it("rend le titre en h1 et le sous-titre juste après", () => {
    cleanup();
    render(
      <TeteDeParcours
        icone={<span data-testid="ico" />}
        ton="ok"
        titre="C'est fait."
        sous="Voilà."
      />,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("C'est fait.");
    expect(screen.getByText("Voilà.")).toBeTruthy();
    expect(screen.getByTestId("ico")).toBeTruthy();
  });

  it("distingue visuellement un geste accompli d'un point d'attention", () => {
    cleanup();
    const { container: ok } = render(<TeteDeParcours icone={null} ton="ok" titre="a" sous="b" />);
    const pastilleOk = ok.querySelector("h1")?.previousElementSibling?.className ?? "";
    cleanup();
    const { container: att } = render(
      <TeteDeParcours icone={null} ton="attention" titre="a" sous="b" />,
    );
    const pastilleAtt = att.querySelector("h1")?.previousElementSibling?.className ?? "";
    expect(pastilleOk).not.toBe(pastilleAtt);
  });
});

describe("<SortiesDeParcours>", () => {
  it("🔴 la sortie principale est un lien-bouton de 44 px, pleine largeur au téléphone", () => {
    cleanup();
    render(
      <SortiesDeParcours principale={{ href: "/appel", label: "Reprendre un rendez-vous" }} />,
    );
    const a = screen.getByRole("link", { name: "Reprendre un rendez-vous" });
    expect(a.getAttribute("href")).toBe("/appel");
    const classes = a.className.split(/\s+/);
    expect(classes, "44 px de haut (h-11)").toContain("h-11");
    expect(classes, "toute la largeur sous sm").toContain("w-full");
    expect(classes, "largeur naturelle au-dessus").toContain("sm:w-auto");
  });

  it("la sortie secondaire reste un lien, avec une hauteur de cible minimale", () => {
    cleanup();
    render(<SortiesDeParcours secondaire={{ href: "/", label: "Retour à l'accueil" }} />);
    const a = screen.getByRole("link", { name: "Retour à l'accueil" });
    expect(a.className.split(/\s+/)).toContain("min-h-11");
  });

  it("les deux ensemble : deux liens, aucun séparateur textuel qui se replie", () => {
    cleanup();
    const { container } = render(
      <SortiesDeParcours
        principale={{ href: "/appel", label: "Reprendre" }}
        secondaire={{ href: "/", label: "Accueil" }}
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(container.textContent).not.toContain("·");
  });
});
