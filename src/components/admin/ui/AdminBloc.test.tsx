import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminBloc } from "./AdminBloc";

describe("AdminBloc", () => {
  it("rend une section titrée avec le contenu", () => {
    render(
      <AdminBloc teinte="terracotta" titre="À faire">
        <p>Relire le questionnaire</p>
      </AdminBloc>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "À faire" })).toBeDefined();
    expect(screen.getByText("Relire le questionnaire")).toBeDefined();
  });

  it("applique la classe de chaque teinte", () => {
    const teintes = ["terracotta", "bleu", "vert", "ambre", "violet", "gris"] as const;
    for (const teinte of teintes) {
      const { container, unmount } = render(
        <AdminBloc teinte={teinte} titre={teinte}>
          x
        </AdminBloc>,
      );
      const bloc = container.querySelector("section");
      expect(bloc?.className).toContain("admin-bloc");
      expect(bloc?.className).toContain(`admin-bloc--${teinte}`);
      expect(bloc?.getAttribute("data-teinte")).toBe(teinte);
      unmount();
    }
  });

  it("le titre est obligatoire : la couleur ne porte jamais seule le sens", () => {
    const { container } = render(
      <AdminBloc teinte="vert" titre="Fait">
        x
      </AdminBloc>,
    );
    expect(container.querySelector(".admin-bloc-titre")?.textContent).toBe("Fait");
  });

  it("option liseré haut et niveau de titre", () => {
    const { container } = render(
      <AdminBloc teinte="bleu" titre="Chiffres" haut niveau={3}>
        x
      </AdminBloc>,
    );
    expect(container.querySelector("section")?.className).toContain("admin-bloc--haut");
    expect(screen.getByRole("heading", { level: 3, name: "Chiffres" })).toBeDefined();
  });
});
