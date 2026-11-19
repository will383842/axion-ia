import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Stepper } from "../Stepper";

describe("Stepper", () => {
  it("desactive : les pastilles terminées ne sont plus cliquables", () => {
    const onAller = vi.fn();
    render(<Stepper etape={3} onAller={onAller} desactive />);
    const boutons = screen.getAllByRole("button") as HTMLButtonElement[];
    expect(boutons.length).toBeGreaterThan(0);
    for (const b of boutons) expect(b.disabled).toBe(true);
    fireEvent.click(boutons[0]!);
    expect(onAller).not.toHaveBeenCalled();
  });

  it("aria-current=step sur la seule étape courante", () => {
    render(<Stepper etape={2} onAller={() => {}} />);
    const courantes = document.querySelectorAll('[aria-current="step"]');
    expect(courantes).toHaveLength(1);
    expect(courantes[0]!.textContent).toContain("Formules");
  });

  it("pendant la sous-étape 1b, l'étape 1 reste courante, avec le sous-titre « Phases »", () => {
    render(<Stepper etape="1b" onAller={() => {}} />);
    const courante = document.querySelector('[aria-current="step"]')!;
    expect(courante.textContent).toContain("Client et projet");
    expect(courante.textContent).toContain("Phases");
    expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  });

  it("est une navigation nommée contenant une liste ordonnée de 4 étapes", () => {
    render(<Stepper etape={1} onAller={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "Étapes du devis" });
    expect(nav.querySelectorAll("ol > li")).toHaveLength(4);
  });

  it("une étape future n'est pas cliquable et sort de la tabulation", () => {
    const onAller = vi.fn();
    render(<Stepper etape={1} onAller={onAller} />);
    const future = screen.getByText("Paiement").closest("[aria-disabled]")!;
    expect(future.getAttribute("aria-disabled")).toBe("true");
    expect(future.getAttribute("tabindex")).toBe("-1");
    fireEvent.click(future);
    expect(onAller).not.toHaveBeenCalled();
  });

  it("une étape terminée est un bouton qui ramène à elle", () => {
    const onAller = vi.fn();
    render(<Stepper etape={3} onAller={onAller} />);
    fireEvent.click(screen.getByRole("button", { name: /Formules/ }));
    expect(onAller).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: /Client et projet/ }));
    expect(onAller).toHaveBeenLastCalledWith(1);
  });

  it("l'étape courante n'est pas un bouton", () => {
    render(<Stepper etape={3} onAller={() => {}} />);
    expect(screen.queryByRole("button", { name: /Paiement/ })).toBeNull();
  });
});
