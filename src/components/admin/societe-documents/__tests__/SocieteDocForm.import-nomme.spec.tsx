/**
 * Importer une pièce NOMMÉE ne doit pas redemander laquelle.
 *
 * La liste des pièces manquantes nomme chaque trou du dossier. Tant qu'elle
 * ne portait pas le geste, la seule voie d'import était le bouton général en
 * haut de page, puis un menu déroulant de dix entrées : l'utilisateur devait
 * re-désigner à la main la pièce qu'il venait de désigner du doigt.
 *
 * Ces cas décrivent ce que voit l'admin après le clic, jamais l'implémentation.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const importerMock = vi.fn(async (..._args: unknown[]) => ({ ok: true as const }));

vi.mock("@/server/actions/societe-documents/documents.actions", () => ({
  importerSocieteDocAction: (...args: unknown[]) => importerMock(...args),
  modifierSocieteDocAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { SocieteDocForm } from "../SocieteDocForm";
import { typesDeRubrique } from "@/server/societe-documents/rubriques";

const TYPES = typesDeRubrique("pieces_legales");

describe("import depuis une pièce nommée", () => {
  it("pré-sélectionne la nature cliquée, pas la première du menu", () => {
    render(
      <SocieteDocForm
        types={TYPES}
        typeInitial="statuts"
        titreInitial="Statuts de la société"
        labelBouton="Importer"
        variante="ligne"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Importer" }));

    const nature = screen.getByLabelText(/Nature de la pièce/) as HTMLSelectElement;
    expect(nature.value).toBe("statuts");
    // Contre-témoin : sans la prop, ce serait la première entrée de la rubrique.
    expect(nature.value).not.toBe(TYPES[0]?.key);
  });

  it("pré-remplit le titre avec le libellé de la pièce", () => {
    render(
      <SocieteDocForm
        types={TYPES}
        typeInitial="statuts"
        titreInitial="Statuts de la société"
        labelBouton="Importer"
        variante="ligne"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Importer" }));

    expect((screen.getByLabelText(/^Titre/) as HTMLInputElement).value).toBe(
      "Statuts de la société",
    );
  });

  it("laisse le champ fichier requis : le clic désigne la pièce, pas son contenu", () => {
    render(<SocieteDocForm types={TYPES} typeInitial="kbis" labelBouton="Importer" />);

    fireEvent.click(screen.getByRole("button", { name: "Importer" }));

    expect(screen.getByLabelText(/Fichier/)).toBeRequired();
  });

  /*
    Défaut constaté en déposant deux pièces de suite dans la console de
    production : la seconde arrivait avec la date d'émission de la première.
  */
  it("ne garde pas la date d'émission de la pièce précédente", async () => {
    render(<SocieteDocForm types={TYPES} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Importer une pièce" }));
    const emission = screen.getByLabelText(/Date d'émission/) as HTMLInputElement;
    fireEvent.change(emission, { target: { value: "2026-07-30" } });
    expect(emission.value).toBe("2026-07-30");

    fireEvent.submit(screen.getByRole("button", { name: "Enregistrer" }).closest("form")!);
    await waitFor(() => expect(importerMock).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole("button", { name: "+ Importer une pièce" }));
    expect((screen.getByLabelText(/Date d'émission/) as HTMLInputElement).value).toBe("");
  });

  it("sans pré-sélection, retombe sur la première nature de la rubrique", () => {
    render(<SocieteDocForm types={TYPES} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Importer une pièce" }));

    expect((screen.getByLabelText(/Nature de la pièce/) as HTMLSelectElement).value).toBe(
      TYPES[0]?.key,
    );
  });
});
