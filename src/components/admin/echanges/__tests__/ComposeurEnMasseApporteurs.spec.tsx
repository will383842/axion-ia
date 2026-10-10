/** L6b — panneau de l'envoi groupé apporteurs : compte avant, confirmation, exclus nommés. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const action = vi.fn();
vi.mock("@/features/admin-submissions/actions-reponse-en-masse-apporteurs", () => ({
  repondreEnMasseApporteursAction: (...a: unknown[]) => action(...a),
}));

import { ComposeurEnMasseApporteurs } from "@/components/admin/contacts/ComposeurEnMasseApporteurs";
import { MODELES_REPONSE_APPORTEUR } from "@/content/apporteurs/modeles-reponse";
import { motsInterditsApporteur } from "@/lib/commercial-application/vocabulaire-apporteur";

afterEach(cleanup);

const MODELES = MODELES_REPONSE_APPORTEUR.filter((m) => m.id !== "libre");

function monter() {
  return render(
    <form>
      <input type="checkbox" name="ids" value="a" defaultChecked aria-label="a" />
      <input type="checkbox" name="ids" value="b" defaultChecked aria-label="b" />
      <ComposeurEnMasseApporteurs modeles={MODELES} plafond={50} fichiers={[]} />
    </form>,
  );
}

describe("ComposeurEnMasseApporteurs", () => {
  it("dit combien, exige la confirmation, puis nomme les exclus", async () => {
    action.mockResolvedValueOnce({
      ok: true,
      envoyees: 1,
      ecartees: 1,
      echouees: 0,
      details: [{ id: "b", motif: "opposee", variables: [], nom: "Gérard T." }],
    });
    const { container } = monter();
    expect(screen.getByText("2 personnes sélectionnées.")).toBeTruthy();
    const envoyer = screen.getByRole("button", { name: "Envoyer à la sélection" });
    expect((envoyer as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/Je confirme/));
    fireEvent.click(envoyer);
    await waitFor(() => expect(screen.getByText("Gérard T.")).toBeTruthy());
    expect(action).toHaveBeenCalledWith({
      ids: ["a", "b"],
      modele: MODELES[0]!.id,
      fichierIds: [],
    });
    expect(screen.getByText(/s'est opposée/)).toBeTruthy();
    expect(motsInterditsApporteur(container.textContent ?? "")).toEqual([]);
  });
});
