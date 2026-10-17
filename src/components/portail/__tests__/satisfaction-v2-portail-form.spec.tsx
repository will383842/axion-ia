/** Lot L08 — le formulaire à chaud / à froid v2 envoie les acquis par objectif. */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { SatisfactionV2PortailForm } from "../SatisfactionV2PortailForm";

const OBJECTIFS = ["Rédiger un prompt", "Vérifier une réponse"];

function rendre(type: "satisfaction_chaud" | "satisfaction_froid") {
  const soumettre = vi.fn(async () => ({ data: { id: "q1" } }));
  render(
    <SatisfactionV2PortailForm
      questionnaireId="q1"
      type={type}
      objectifs={OBJECTIFS}
      soumettreAction={soumettre}
    />,
  );
  return soumettre;
}

describe("SatisfactionV2PortailForm", () => {
  it("refuse l'envoi sans note globale", async () => {
    const soumettre = rendre("satisfaction_chaud");
    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/satisfaction globale/i);
    expect(soumettre).not.toHaveBeenCalled();
  });

  it("à chaud : envoie la note, les aspects et le niveau par objectif", async () => {
    const soumettre = rendre("satisfaction_chaud");
    fireEvent.click(screen.getByRole("button", { name: "Satisfaction globale : 4 sur 5" }));
    fireEvent.click(screen.getAllByLabelText("Je maîtrise")[0]!);
    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));
    await waitFor(() => expect(soumettre).toHaveBeenCalledTimes(1));
    const arg = (soumettre.mock.calls[0] as unknown[])[0] as {
      noteGlobale: number;
      reponses: Record<string, unknown>;
    };
    expect(arg.noteGlobale).toBe(4);
    expect(arg.reponses["acquisParObjectif"]).toEqual({ "Rédiger un prompt": 3 });
    expect(arg.reponses).not.toHaveProperty("miseEnPratique");
  });

  it("à froid : pose la question de mise en pratique", () => {
    rendre("satisfaction_froid");
    expect(screen.getByLabelText(/mettez-vous en pratique/i)).toBeTruthy();
  });
});
