import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import DevisLayout from "../layout";

describe("layout de « Corriger un devis » : pose la peau dossier", () => {
  it("enveloppe la page dans .admin-ton-dossier sans rien ajouter d'autre", () => {
    const { container } = render(
      <DevisLayout>
        <p>contenu de la page</p>
      </DevisLayout>,
    );
    const racine = container.firstElementChild;
    expect(racine?.className).toBe("admin-ton-dossier");
    expect(racine?.textContent).toBe("contenu de la page");
    expect(container.children).toHaveLength(1);
  });
});
