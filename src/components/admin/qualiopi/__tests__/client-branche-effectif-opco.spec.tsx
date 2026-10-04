/**
 * Lot OPCO A1 / A7b — formulaire branche : effectif + UN SEUL sélecteur d'OPCO
 * (le champ typé `opco`), suggestion d'OPCO en LECTURE SEULE jusqu'au clic
 * « Retenir ». Soumet le formulaire et lit ce qui part au serveur.
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
import { suggererOpco } from "@/server/qualiopi/financements/opco-suggestion";

/** Ce que la page calcule et transmet. */
const suggere = (texte: string | null) => suggererOpco({ opco: null, opcoIdentifie: texte });

const ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  a.updateClientAction.mockReset();
  a.updateClientAction.mockResolvedValue({ data: { id: ID } });
});
afterEach(cleanup);

function envoye(): Record<string, unknown> {
  return a.updateClientAction.mock.calls[0]?.[0] as Record<string, unknown>;
}

function soumettre(): void {
  fireEvent.submit(screen.getByRole("button", { name: "Enregistrer" }).closest("form")!);
}

describe("ClientBrancheForm — effectif et OPCO typé", () => {
  it("UN SEUL sélecteur d'OPCO (liste et fiche)", () => {
    render(<ClientBrancheForm id={ID} suggestion={suggere("atlas")} opco={null} />);
    expect(screen.getAllByRole("combobox", { name: /OPCO/ })).toHaveLength(1);
    cleanup();
    render(<ClientBrancheForm id={ID} suggestion={suggere("atlas")} opco={null} complet />);
    expect(screen.getAllByRole("combobox", { name: /OPCO/ })).toHaveLength(1);
    expect(screen.queryByText("OPCO (référentiel)")).toBeNull();
  });

  it("affiche « OPCO suggéré » depuis le texte libre, sans rien écrire", async () => {
    render(<ClientBrancheForm id={ID} suggestion={suggere("OPCO Santé")} opco={null} />);

    expect(screen.getByText("OPCO suggéré : OPCO Santé")).toBeTruthy();

    soumettre();
    await waitFor(() => expect(a.updateClientAction).toHaveBeenCalledTimes(1));
    expect("opco" in envoye()).toBe(false);
    expect("opcoIdentifie" in envoye()).toBe(false);
    expect("effectif" in envoye()).toBe(false);
  });

  it("« Retenir » pose la suggestion dans le sélecteur, puis elle part dans `opco`", async () => {
    render(<ClientBrancheForm id={ID} suggestion={suggere("OPCO Santé")} opco={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Retenir" }));
    soumettre();

    await waitFor(() => expect(a.updateClientAction).toHaveBeenCalledTimes(1));
    expect(envoye().opco).toBe("opco_sante");
  });

  it("n'affiche aucune suggestion quand l'OPCO typé est déjà posé", () => {
    render(<ClientBrancheForm id={ID} suggestion={null} opco="akto" />);

    expect(screen.queryByText(/OPCO suggéré/)).toBeNull();
  });

  it("envoie l'effectif saisi et l'OPCO typé choisi", async () => {
    render(<ClientBrancheForm id={ID} opco={null} effectif={null} />);

    fireEvent.change(screen.getByLabelText("Effectif"), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText("OPCO"), { target: { value: "uniformation" } });
    soumettre();

    await waitFor(() => expect(a.updateClientAction).toHaveBeenCalledTimes(1));
    expect(envoye().effectif).toBe(42);
    expect(envoye().opco).toBe("uniformation");
  });

  it("« — » remet en inféré : `opco` et `opcoIdentifie` partent à null", async () => {
    render(<ClientBrancheForm id={ID} suggestion={null} opco="akto" />);

    fireEvent.change(screen.getByLabelText("OPCO"), { target: { value: "" } });
    soumettre();

    await waitFor(() => expect(a.updateClientAction).toHaveBeenCalledTimes(1));
    expect(envoye().opco).toBeNull();
    expect(envoye().opcoIdentifie).toBeNull();
  });

  it("fiche : enveloppe saisie en euros → centimes entiers ; adhérent et deux faits OPCO", async () => {
    render(<ClientBrancheForm id={ID} opco="mobilites" complet />);

    fireEvent.change(screen.getByLabelText("Enveloppe annuelle (€)"), {
      target: { value: "3 200,50" },
    });
    fireEvent.change(screen.getByLabelText("N° d'adhérent"), { target: { value: "M-9" } });
    fireEvent.change(screen.getByLabelText("Offre de services Mobilités"), {
      target: { value: "oui" },
    });
    fireEvent.change(screen.getByLabelText("Versement volontaire"), {
      target: { value: "non" },
    });
    soumettre();

    await waitFor(() => expect(a.updateClientAction).toHaveBeenCalledTimes(1));
    expect(envoye().opcoEnveloppeAnnuelleCents).toBe(320_050);
    expect(envoye().opcoNumeroAdherent).toBe("M-9");
    expect(envoye().opcoAdhesionOffreMobilites).toBe(true);
    expect(envoye().opcoVersementVolontaire).toBe(false);
  });

  it("fiche : enveloppe illisible → message, rien n'est envoyé", async () => {
    render(<ClientBrancheForm id={ID} complet />);

    fireEvent.change(screen.getByLabelText("Enveloppe annuelle (€)"), {
      target: { value: "beaucoup" },
    });
    soumettre();

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(a.updateClientAction).not.toHaveBeenCalled();
  });

  it("liste : ni enveloppe ni adhérent (la saisie complète est sur la fiche)", () => {
    render(<ClientBrancheForm id={ID} />);
    expect(screen.queryByLabelText("Enveloppe annuelle (€)")).toBeNull();
    expect(screen.queryByLabelText("N° d'adhérent")).toBeNull();
  });

  it("masque effectif et OPCO pour un particulier", () => {
    render(<ClientBrancheForm id={ID} estParticulier complet />);

    expect(screen.queryByLabelText("Effectif")).toBeNull();
    expect(screen.queryByLabelText("OPCO")).toBeNull();
    expect(screen.queryByLabelText("Enveloppe annuelle (€)")).toBeNull();
  });
});
