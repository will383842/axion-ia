// Console « validation par rendez-vous » : ce que le dirigeant lit sous la confirmation, le champ
// « Pris (convenu) le » d'une rencontre, le motif d'une saisie manuelle. Données fictives.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/apporteurs-reseau/actions-presentations", () => ({
  ecarterPropositionAction: vi.fn(),
  saisirRendezVousAction: vi.fn(),
  validerPropositionAction: vi.fn(),
}));

import { ActionsProposition, SaisirRendezVous } from "./ValidationRendezVous";

afterEach(cleanup);

const PHRASE =
  "Un e-mail part automatiquement à l'apporteur, avec la date de validation et la fin de la protection (sauf s'il est retiré du réseau).";

describe("ActionsProposition", () => {
  it("dit ce que l'apporteur recevra, sous la confirmation", () => {
    render(<ActionsProposition id="p1" dateTenueConnue aujourdhuiLocal="2026-11-20T10:00" />);
    fireEvent.click(screen.getByRole("button", { name: "Il a eu lieu" }));
    expect(screen.getByText(PHRASE)).toBeTruthy();
  });

  it("proposition « rencontre: » : « Pris (convenu) le » obligatoire, prérempli", () => {
    render(
      <ActionsProposition
        id="p1"
        dateTenueConnue
        aujourdhuiLocal="2026-11-20T10:00"
        rencontre
        prisLocal="2026-11-05T10:00"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Il a eu lieu" }));
    const champ = screen.getByLabelText("Pris (convenu) le") as HTMLInputElement;
    expect(champ.required).toBe(true);
    expect(champ.value).toBe("2026-11-05T10:00");
  });

  it("proposition Calendly : pas de champ « Pris (convenu) le »", () => {
    render(<ActionsProposition id="p1" dateTenueConnue aujourdhuiLocal="2026-11-20T10:00" />);
    fireEvent.click(screen.getByRole("button", { name: "Il a eu lieu" }));
    expect(screen.queryByLabelText("Pris (convenu) le")).toBeNull();
  });
});

describe("SaisirRendezVous", () => {
  const rendre = () =>
    render(
      <SaisirRendezVous
        entreprises={[{ id: "e1", libelle: "ACME (essai)" }]}
        aujourdhuiLocal="2026-11-20T10:00"
      />,
    );

  it("le motif est un champ obligatoire", () => {
    rendre();
    const motif = screen.getByLabelText("Motif de la saisie") as HTMLInputElement;
    expect(motif.required).toBe(true);
    expect(motif.name).toBe("motif");
  });

  it("dit ce que l'apporteur recevra, sous la confirmation", () => {
    rendre();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer : il a eu lieu" }));
    expect(screen.getByText(PHRASE)).toBeTruthy();
  });
});
