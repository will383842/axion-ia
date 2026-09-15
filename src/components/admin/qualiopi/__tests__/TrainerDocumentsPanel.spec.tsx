/**
 * TrainerDocumentsPanel — une pièce validée qui ne PROUVE rien ne s'affiche pas
 * « Validé » tout court.
 *
 * 🔴 Relecture de la PR 1085 (constat I21-02). Une pièce de compétence validée
 * SANS fichier ne couvre plus l'indicateur 21, mais le panneau l'affichait
 * toujours « Validé », en vert. Le même formateur apparaissait donc « SANS pièce
 * de compétence validée » à l'écran de conformité et « Validé » dans son
 * dossier. Les cas ci-dessous décrivent ce que voit l'admin.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/server/actions/qualiopi/trainer-documents", () => ({
  createTrainerDocumentAction: vi.fn(),
  validateTrainerDocumentAction: vi.fn(),
  deleteTrainerDocumentAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { TrainerDocumentsPanel, type TrainerDocumentView } from "../TrainerDocumentsPanel";

function piece(over: Partial<TrainerDocumentView> = {}): TrainerDocumentView {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    type: "cv",
    numeroPiece: null,
    fichierUrl: "https://drive.example/cv.pdf",
    dateEmission: new Date("2026-06-01T00:00:00Z"),
    dateExpiration: null,
    statutValidation: "valide",
    rejetMotif: null,
    createdAt: new Date("2026-06-02T00:00:00Z"),
    ecarteeDeLaPreuve: null,
    ...over,
  };
}

/** La cellule « Statut » de la seule ligne de pièce affichée. */
function celluleStatut(documents: TrainerDocumentView[]): HTMLElement {
  render(<TrainerDocumentsPanel trainerId="t-1" documents={documents} />);
  const lignes = screen.getAllByRole("row");
  const cellules = within(lignes[1] as HTMLElement).getAllByRole("cell");
  return cellules[4] as HTMLElement;
}

describe("TrainerDocumentsPanel — statut d'une pièce de compétence", () => {
  it("validée SANS fichier : dit qu'elle ne compte pas comme preuve, et le geste qui existe", () => {
    const cellule = celluleStatut([piece({ fichierUrl: null, ecarteeDeLaPreuve: "sans_fichier" })]);
    expect(cellule.textContent).not.toBe("Validé");
    expect(cellule.textContent).toMatch(/ne compte pas comme preuve/);
    expect(cellule.textContent).toMatch(/aucun fichier joint/i);
    expect(cellule.textContent).toMatch(/nouvelle pièce/);
    // Le geste prescrit doit rester disponible sur la ligne.
    expect(screen.getByRole("button", { name: "Rejeter" })).toBeTruthy();
  });

  it("validée mais EXPIRÉE : dit qu'elle ne compte pas comme preuve", () => {
    const cellule = celluleStatut([
      piece({
        type: "certification",
        dateExpiration: new Date("2020-01-01T00:00:00Z"),
        ecarteeDeLaPreuve: "expiree",
      }),
    ]);
    expect(cellule.textContent).toMatch(/ne compte pas comme preuve/);
    expect(cellule.textContent).toMatch(/expirée/i);
  });

  it("validée avec son fichier : « Validé », sans réserve", () => {
    const cellule = celluleStatut([piece()]);
    expect(cellule.textContent).toBe("Validé");
  });
});
