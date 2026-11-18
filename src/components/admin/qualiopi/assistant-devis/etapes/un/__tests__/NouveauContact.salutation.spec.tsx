import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NouveauContact } from "../NouveauContact";

function monter() {
  const creerClient = vi.fn().mockResolvedValue({ data: { id: "c1", numero: "AXI-CLI-001" } });
  render(<NouveauContact creerClient={creerClient} onCree={vi.fn()} onAnnuler={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Raison sociale"), { target: { value: "Société Test" } });
  return creerClient;
}

describe("NouveauContact — salutation", () => {
  it("envoie civilité, prénom et nom de famille à creerClient", async () => {
    const creerClient = monter();
    fireEvent.change(screen.getByLabelText("Nom du contact"), { target: { value: "Léa Dupont" } });
    fireEvent.change(screen.getByLabelText("Civilité"), { target: { value: "madame" } });
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: " Léa " } });
    fireEvent.change(screen.getByLabelText("Nom de famille"), { target: { value: "Dupont" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer le contact" }));
    await waitFor(() => expect(creerClient).toHaveBeenCalledTimes(1));
    expect(creerClient.mock.calls[0]?.[0]).toEqual({
      type: "entreprise",
      raisonSociale: "Société Test",
      contactNom: "Léa Dupont",
      contactCivilite: "madame",
      contactPrenom: "Léa",
      contactNomFamille: "Dupont",
    });
  });

  it("n'envoie rien quand les champs sont vides, et ne découpe jamais le nom", async () => {
    const creerClient = monter();
    fireEvent.change(screen.getByLabelText("Nom du contact"), { target: { value: "Léa Dupont" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer le contact" }));
    await waitFor(() => expect(creerClient).toHaveBeenCalledTimes(1));
    const entree = creerClient.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entree).not.toHaveProperty("contactCivilite");
    expect(entree).not.toHaveProperty("contactPrenom");
    expect(entree).not.toHaveProperty("contactNomFamille");
  });

  it("chaque champ a un libellé et au moins 44 px", () => {
    monter();
    for (const l of ["Civilité", "Prénom", "Nom de famille"]) {
      expect(screen.getByLabelText(l).className).toContain("min-h-[44px]");
    }
  });
});
