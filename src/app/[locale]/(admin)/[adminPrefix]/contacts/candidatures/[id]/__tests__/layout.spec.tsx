import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import FicheLayout from "../layout";

describe("layout de la fiche candidature : pose la peau dossier", () => {
  it("enveloppe la page dans .admin-ton-dossier sans rien ajouter d'autre", () => {
    const { container } = render(
      <FicheLayout>
        <p>contenu de la page</p>
      </FicheLayout>,
    );
    const racine = container.firstElementChild;
    expect(racine?.className).toBe("admin-ton-dossier");
    expect(racine?.textContent).toBe("contenu de la page");
    expect(container.children).toHaveLength(1);
  });
});
