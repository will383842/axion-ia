import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssistantDevis } from "../AssistantDevis";
import { etatInitial } from "../etat";
import { BlocMotsDuClient } from "../etapes/un/BlocMotsDuClient";
import { ChoixModele } from "../etapes/un/ChoixModele";
import { ListeLignes } from "../etapes/un/ListeLignes";
import { Stepper } from "../Stepper";

const etat = () => etatInitial({ validiteParDefaut: "2026-12-08", formulesActives: true });

describe("refonte visuelle — rôles et noms accessibles inchangés", () => {
  it("Stepper : aria-current seulement sur l'étape courante, futures inertes", () => {
    const { container } = render(<Stepper etape={2} onAller={vi.fn()} />);
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(container.querySelectorAll('[aria-disabled="true"]')).toHaveLength(2);
    expect(container.querySelector("nav")?.className).toContain("sticky");
  });

  it("coque : Retour et Continuer sont de grands boutons (admin-button-lg)", () => {
    render(
      <AssistantDevis validiteParDefaut="2026-12-08" formulesActives rendreEtape={() => null} />,
    );
    for (const nom of ["Retour", "Continuer"]) {
      expect(screen.getByRole("button", { name: nom }).className).toContain("admin-button-lg");
    }
    expect(screen.getByRole("heading", { level: 2, name: "Client et projet" })).toBeTruthy();
  });

  it("ChoixModele : vrais radios, détail relié, coche réservée et visible si choisi", () => {
    const dispatch = vi.fn();
    const { rerender, container } = render(<ChoixModele etat={etat()} dispatch={dispatch} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    for (const r of radios) {
      const detail = document.getElementById(r.getAttribute("aria-describedby") ?? "");
      expect(detail?.className).toContain("sr-only");
      expect(r.closest("label")?.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    }
    fireEvent.click(radios[0]!);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "modele" }));
    rerender(<ChoixModele etat={{ ...etat(), modele: "audit" }} dispatch={dispatch} />);
    expect((screen.getByRole("radio", { name: /audit/i }) as HTMLInputElement).checked).toBe(true);
    const label = screen.getByRole("radio", { name: /audit/i }).closest("label");
    expect(label?.className).toContain("has-[:checked]:font-semibold");
    expect(label?.className).toContain("forced-colors:has-[:checked]:outline");
    expect(container.querySelector("svg.group-has-\\[\\:checked\\]\\:visible")).toBeTruthy();
  });

  it("ListeLignes : aide « ? » repliée mais dans le DOM, boutons d'ajout admin-button-lg", () => {
    render(<ListeLignes etat={etat()} dispatch={vi.fn()} offres={[]} />);
    const aide = screen.getByLabelText("En savoir plus sur le contenu du devis");
    expect((aide.closest("details") as HTMLDetailsElement).open).toBe(false);
    expect(screen.getByText(/Autant de lignes que vous voulez/)).toBeTruthy();
    const ajout = screen.getByRole("button", { name: "+ Formation" });
    expect(ajout.className).toContain("admin-button-lg");
    expect(screen.getByRole("button", { name: "Supprimer la ligne 1" })).toBeTruthy();
    const repli = screen.getByText("Plus d'options").closest("details") as HTMLDetailsElement;
    expect(repli.open).toBe(false);
  });

  it("BlocMotsDuClient : replié à vide, ouvert si un champ est rempli ; id d'aide gardé", () => {
    const { unmount } = render(<BlocMotsDuClient etat={etat()} dispatch={vi.fn()} />);
    expect(
      (screen.getByText("Ce que le client vous a dit").closest("details") as HTMLDetailsElement)
        .open,
    ).toBe(false);
    expect(document.getElementById("aide-mots")).toBeTruthy();
    unmount();
    render(
      <BlocMotsDuClient etat={{ ...etat(), resultatVise: "Gagner du temps" }} dispatch={vi.fn()} />,
    );
    expect(
      (screen.getByText("Ce que le client vous a dit").closest("details") as HTMLDetailsElement)
        .open,
    ).toBe(true);
  });
});
