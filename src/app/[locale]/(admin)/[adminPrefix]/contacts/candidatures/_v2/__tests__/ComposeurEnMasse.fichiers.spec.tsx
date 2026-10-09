/**
 * L6b — la réponse groupée peut joindre les MÊMES fichiers ; changer les
 * fichiers cochés fait retomber la confirmation (comme changer le texte).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/features/admin-job-applications/actions-reponse-en-masse", () => ({
  repondreEnMasseAction: vi.fn(),
}));

import { ComposeurEnMasse } from "../ComposeurEnMasse";

afterEach(cleanup);

const MODELES = [{ value: "libre", label: "Message libre", quand: "", objet: "", corps: "" }];
const LUT = {
  id: "33333333-3333-4333-8333-333333333333",
  titre: "LUT-Axion.cube",
  libelleCategorie: "LUT",
};

describe("ComposeurEnMasse — fichiers joints", () => {
  it("bibliothèque éteinte : aucune section de fichiers", () => {
    render(
      <form>
        <ComposeurEnMasse modeles={MODELES} plafond={50} fichiers={null} />
      </form>,
    );
    expect(screen.queryByText("Joindre les mêmes fichiers")).toBeNull();
  });

  it("les fichiers partent sous le nom `fichierIds`, et en cocher un défait la confirmation", () => {
    const { container } = render(
      <form>
        <input type="checkbox" name="ids" value="a" defaultChecked aria-label="A" />
        <ComposeurEnMasse modeles={MODELES} plafond={50} fichiers={[LUT]} />
      </form>,
    );
    fireEvent.click(screen.getByText("Écrire à la sélection"));
    fireEvent.change(screen.getByLabelText("Objet"), { target: { value: "Essai" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Bonjour" } });
    const confirmer = screen.getByLabelText(/Je confirme/) as HTMLInputElement;
    fireEvent.click(confirmer);
    expect(confirmer.checked).toBe(true);
    fireEvent.click(screen.getByLabelText(/LUT-Axion\.cube/));
    expect(confirmer.checked).toBe(false);
    const coche = container.querySelector('input[name="fichierIds"]') as HTMLInputElement;
    expect(coche.value).toBe(LUT.id);
    expect(coche.checked).toBe(true);
    expect(screen.getByText(/son propre lien/)).toBeTruthy();
  });
});
