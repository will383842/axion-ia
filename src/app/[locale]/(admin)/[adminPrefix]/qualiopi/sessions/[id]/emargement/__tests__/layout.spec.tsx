import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import EmargementLayout from "../layout";

describe("layout de l'émargement : pose la peau dossier", () => {
  it("enveloppe la page dans .admin-ton-dossier sans rien ajouter d'autre", () => {
    const { container } = render(
      <EmargementLayout>
        <p>contenu de la page</p>
      </EmargementLayout>,
    );
    const racine = container.firstElementChild;
    expect(racine?.className).toBe("admin-ton-dossier");
    expect(racine?.textContent).toBe("contenu de la page");
    expect(container.children).toHaveLength(1);
  });
});
