/**
 * Lot OPCO A1 — formulaire branche : effectif + OPCO typé, et suggestion
 * d'OPCO en LECTURE SEULE. Soumet le formulaire et lit ce qui part au serveur.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const a = vi.hoisted(() => ({ updateClientAction: vi.fn() }));
vi.mock("@/server/actions/qualiopi/clients", () => ({
  updateClientAction: (...x: unknown[]) => a.updateClientAction(...x),
}));

import { ClientBrancheForm } from "../ClientBrancheForm";

const ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  a.updateClientAction.mockReset();
  a.updateClientAction.mockResolvedValue({ data: { id: ID } });
});
afterEach(cleanup);

function envoye(): Record<string, unknown> {
  return a.updateClientAction.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe("ClientBrancheForm — effectif et OPCO typé", () => {
  it("affiche « OPCO suggéré » depuis le texte libre, sans rien écrire", async () => {
    render(<ClientBrancheForm id={ID} opcoIdentifie="OPCO Santé" opco={null} />);

    expect(screen.getByText("OPCO suggéré : OPCO Santé")).toBeTruthy();

    fireEvent.submit(screen.getByRole("button", { name: "Enregistrer" }).closest("form")!);
    await waitFor(() => expect(a.updateClientAction).toHaveBeenCalledTimes(1));
    expect("opco" in envoye()).toBe(false);
    expect("opcoIdentifie" in envoye()).toBe(false);
    expect("effectif" in envoye()).toBe(false);
  });

  it("n'affiche aucune suggestion quand l'OPCO typé est déjà posé", () => {
    render(<ClientBrancheForm id={ID} opcoIdentifie="atlas" opco="akto" />);

    expect(screen.queryByText(/OPCO suggéré/)).toBeNull();
  });

  it("envoie l'effectif saisi et l'OPCO typé choisi", async () => {
    render(<ClientBrancheForm id={ID} opcoIdentifie={null} opco={null} effectif={null} />);

    fireEvent.change(screen.getByLabelText("Effectif"), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText("OPCO (référentiel)"), {
      target: { value: "uniformation" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Enregistrer" }).closest("form")!);

    await waitFor(() => expect(a.updateClientAction).toHaveBeenCalledTimes(1));
    expect(envoye().effectif).toBe(42);
    expect(envoye().opco).toBe("uniformation");
  });

  it("masque effectif et OPCO typé pour un particulier", () => {
    render(<ClientBrancheForm id={ID} estParticulier />);

    expect(screen.queryByLabelText("Effectif")).toBeNull();
    expect(screen.queryByLabelText("OPCO (référentiel)")).toBeNull();
  });
});
