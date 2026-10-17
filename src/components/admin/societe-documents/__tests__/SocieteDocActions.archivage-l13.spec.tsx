/**
 * CHANTIER QNC, L13 — ce que voit l'admin sur une pièce de la rubrique Société.
 *
 * Éteint (`archivage` absent) : exactement l'écran d'avant, « Supprimer » compris.
 * Allumé : plus de « Supprimer » ; « Retirer » seulement si le retrait est
 * possible (super-administrateur, base prête) ; le remplacement annonce qu'il
 * garde l'ancienne version.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/server/actions/societe-documents/documents.actions", () => ({
  remplacerFichierSocieteDocAction: vi.fn(),
  supprimerSocieteDocAction: vi.fn(),
  importerSocieteDocAction: vi.fn(),
  modifierSocieteDocAction: vi.fn(),
}));
vi.mock("@/server/actions/documents-organisme/retrait.actions", () => ({
  retirerDocumentOrganismeAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { SocieteDocActions } from "../SocieteDocActions";
import { typesDeRubrique } from "@/server/societe-documents/rubriques";

const PIECE = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "kbis" as const,
  titre: "Kbis",
  description: null,
  numeroPiece: null,
  dateEmission: null,
  dateExpiration: null,
  sensitive: false,
};
const TYPES = typesDeRubrique("pieces_legales");

describe("boutons d'une pièce Société", () => {
  it("éteint : « Supprimer » est là, le remplacement dit qu'il efface l'ancien fichier (comme avant)", () => {
    render(<SocieteDocActions piece={PIECE} types={TYPES} />);
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retirer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remplacer le fichier" }));
    expect(screen.getByText(/effacé du disque/)).toBeTruthy();
  });

  it("allumé : plus de « Supprimer », le remplacement garde l'ancienne version", () => {
    render(
      <SocieteDocActions piece={PIECE} types={TYPES} archivage={{ retraitPossible: false }} />,
    );
    expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retirer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remplacer le fichier" }));
    expect(screen.getByText(/L'ancienne est gardée/)).toBeTruthy();
  });

  it("allumé, retrait possible : « Retirer » remplace « Supprimer »", () => {
    render(<SocieteDocActions piece={PIECE} types={TYPES} archivage={{ retraitPossible: true }} />);
    expect(screen.getByRole("button", { name: "Retirer" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
  });
});
