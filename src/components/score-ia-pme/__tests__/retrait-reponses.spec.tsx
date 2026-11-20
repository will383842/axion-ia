// Retrait : focus à l'ouverture (WCAG 2.4.3), message exact selon la saisie, deux zones ARIA.
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RetraitBloc } from "../RetraitBloc";
import { RETRAIT } from "@/content/score-ia-pme/textes";

vi.mock("@/server/actions/score-ia-pme/retirer", () => ({ retirerReponsesScore: vi.fn() }));
vi.mock("next/dynamic", async () => {
  const mod = await import("../RetraitReponses");
  return { default: () => mod.RetraitReponses };
});

describe("Retirer mes réponses", () => {
  it("place le focus sur le champ « Code de retrait » après le clic d'ouverture", async () => {
    const user = userEvent.setup();
    render(<RetraitBloc />);
    await user.click(screen.getByRole("button", { name: RETRAIT.titre }));
    expect(document.activeElement).toBe(screen.getByLabelText(RETRAIT.champ));
  });

  it("n'affiche pas l'intro en double dans le formulaire", async () => {
    const user = userEvent.setup();
    render(<RetraitBloc />);
    await user.click(screen.getByRole("button", { name: RETRAIT.titre }));
    expect(screen.queryByText(RETRAIT.intro)).toBeNull();
  });

  it("champ vide → « vide » ; code incomplet → « invalide », dans la zone role=alert", async () => {
    const user = userEvent.setup();
    render(<RetraitBloc />);
    await user.click(screen.getByRole("button", { name: RETRAIT.titre }));
    const bouton = screen.getAllByRole("button", { name: RETRAIT.bouton })[0] as HTMLElement;
    await user.click(bouton);
    expect(screen.getByRole("alert").textContent).toBe(RETRAIT.vide);
    await user.type(screen.getByLabelText(RETRAIT.champ), "ABCD EF");
    await user.click(bouton);
    expect(screen.getByRole("alert").textContent).toBe(RETRAIT.invalide);
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
