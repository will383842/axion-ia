/**
 * Une action de masse ne part plus au premier clic.
 *
 * Audit UI du 2026-09-02 : « Relancer tous les échecs » (1 462 jobs),
 * « Approuver / Rejeter en masse », « Tout annuler », « Régénérer le lot
 * tier-1 », « Synchroniser les villes » soumettaient directement. Le bouton
 * partagé demande une confirmation navigateur et, si elle est refusée,
 * empêche la soumission du formulaire.
 */
// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConfirmSubmitButton } from "../ConfirmSubmitButton";

afterEach(() => {
  vi.restoreAllMocks();
});

function renderInForm(onSubmit: () => void) {
  render(
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <ConfirmSubmitButton confirmMessage="Relancer TOUS les jobs en échec ?">
        Relancer tous les échecs
      </ConfirmSubmitButton>
    </form>,
  );
}

describe("ConfirmSubmitButton", () => {
  it("pose la question avec le message fourni", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderInForm(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Relancer tous les échecs" }));
    expect(confirm).toHaveBeenCalledWith("Relancer TOUS les jobs en échec ?");
  });

  it("refus → le formulaire n'est PAS soumis", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const onSubmit = vi.fn();
    renderInForm(onSubmit);
    fireEvent.click(screen.getByRole("button"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accord → le formulaire est soumis", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onSubmit = vi.fn();
    renderInForm(onSubmit);
    fireEvent.click(screen.getByRole("button"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("reste un bouton de soumission (type=submit), avec titre et classe transmis", () => {
    render(
      <ConfirmSubmitButton confirmMessage="?" className="admin-button" title="Explication">
        Go
      </ConfirmSubmitButton>,
    );
    const btn = screen.getByRole("button", { name: "Go" });
    expect(btn).toHaveAttribute("type", "submit");
    expect(btn).toHaveAttribute("title", "Explication");
    expect(btn).toHaveClass("admin-button");
  });
});
