/**
 * A5 — « Valable jusqu'au » sur la fiche d'un devis en brouillon.
 * Décrit ce que voit l'admin : champ pré-rempli, appel de l'action existante avec la bonne
 * date et le bon `attenduMajLe`, message d'erreur de l'action affiché tel quel.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const actionMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("@/server/actions/qualiopi/devis-classique-modifier", () => ({
  fixerValiditeDevisBrouillonAction: (...args: unknown[]) => actionMock(...args),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn() }),
}));

import { ValiditeBrouillon } from "../ValiditeBrouillon";

const ID = "11111111-1111-1111-1111-111111111111";
const MAJ = "2026-11-10T09:00:00.000Z";

const rendre = (statut = "brouillon") =>
  render(
    <ValiditeBrouillon
      devisId={ID}
      statut={statut}
      dateValidite="2026-12-15T22:59:59.000Z"
      majLe={MAJ}
    />,
  );

describe("ValiditeBrouillon", () => {
  beforeEach(() => {
    actionMock.mockReset();
    refreshMock.mockReset();
  });

  it("s'affiche pour un brouillon, champ relié à son libellé et pré-rempli (jour de Paris)", () => {
    rendre();
    const champ = screen.getByLabelText("Valable jusqu'au") as HTMLInputElement;
    expect(champ.type).toBe("date");
    expect(champ.value).toBe("2026-12-15");
    expect(screen.getByRole("button", { name: "Enregistrer la date" })).toBeTruthy();
  });

  it("n'apparaît pas pour un devis qui n'est pas un brouillon", () => {
    const { container } = rendre("envoye");
    expect(container.innerHTML).toBe("");
  });

  it("appelle l'action avec la date saisie et attenduMajLe, puis confirme", async () => {
    actionMock.mockResolvedValue({ data: { majLe: "2026-11-17T08:00:00.000Z" } });
    rendre();
    fireEvent.change(screen.getByLabelText("Valable jusqu'au"), {
      target: { value: "2026-12-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la date" }));
    await waitFor(() => expect(screen.getByText("Date de validité enregistrée.")).toBeTruthy());
    expect(actionMock).toHaveBeenCalledWith({
      id: ID,
      attenduMajLe: MAJ,
      dateValidite: "2026-12-20",
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("affiche tel quel le message d'erreur renvoyé par l'action", async () => {
    actionMock.mockResolvedValue({ error: "Ce devis a été modifié ailleurs." });
    rendre();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la date" }));
    await waitFor(() => expect(screen.getByText("Ce devis a été modifié ailleurs.")).toBeTruthy());
    expect(screen.queryByText("Date de validité enregistrée.")).toBeNull();
  });
});
