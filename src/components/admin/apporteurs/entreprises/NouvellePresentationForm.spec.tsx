// Rattrapage d'une déclaration (console) : le nom de l'entreprise suit le numéro vérifié.
// Essai réel du 09/10/2026 : après une première recherche (INVEST SUN), un autre SIREN vérifié
// gardait « INVEST SUN » dans la case « Entreprise » — la déclaration serait partie sous le nom
// d'une autre entreprise.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ verifier: vi.fn() }));

vi.mock("@/features/apporteurs-reseau/actions-presentations", () => ({
  creerPresentationAction: vi.fn(),
  verifierSirenAction: (...a: unknown[]) => h.verifier(...a),
}));

import { NouvellePresentationForm } from "./NouvellePresentationForm";

const ok = (denomination: string) => ({ etat: "ok", denomination, active: true, signalements: [] });

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

function rendre() {
  render(<NouvellePresentationForm apporteurs={[{ id: "a1", nom: "ESSAI" }]} />);
  return {
    siren: screen.getByLabelText(/SIREN de l'entreprise/) as HTMLInputElement,
    nom: screen.getByPlaceholderText("Rempli par le registre") as HTMLInputElement,
    verifier: screen.getByRole("button", { name: "Vérifier" }),
  };
}

describe("rattrapage : le nom de l'entreprise suit le numéro", () => {
  it("un second numéro vérifié remplace le nom trouvé pour le premier", async () => {
    const f = rendre();
    h.verifier.mockResolvedValueOnce(ok("INVEST SUN"));
    fireEvent.change(f.siren, { target: { value: "901434837" } });
    fireEvent.click(f.verifier);
    await waitFor(() => expect(f.nom.value).toBe("INVEST SUN"));

    fireEvent.change(f.siren, { target: { value: "108018631" } });
    expect(f.nom.value).toBe("");
    h.verifier.mockResolvedValueOnce(ok("AXION IA"));
    fireEvent.click(f.verifier);
    await waitFor(() => expect(f.nom.value).toBe("AXION IA"));
  });

  it("un nom tapé à la main n'est jamais écrasé", async () => {
    const f = rendre();
    fireEvent.change(f.nom, { target: { value: "Mon nom à moi" } });
    fireEvent.change(f.siren, { target: { value: "108018631" } });
    expect(f.nom.value).toBe("Mon nom à moi");
    h.verifier.mockResolvedValueOnce(ok("AXION IA"));
    fireEvent.click(f.verifier);
    await waitFor(() => expect(h.verifier).toHaveBeenCalled());
    expect(f.nom.value).toBe("Mon nom à moi");
  });
});
