/**
 * « Mon compte » — l'écran demande ce qu'il enregistre.
 *
 * Le formulaire disait : « Si vous avez une situation nécessitant des
 * aménagements particuliers (handicap, trouble d'apprentissage, etc.) », et son
 * unique action posait `Trainee.situationHandicap = true`. Une personne qui
 * demandait une place près de la porte se retrouvait déclarée « en situation de
 * handicap ».
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DeclarationBesoinAdaptationForm } from "../DeclarationBesoinAdaptationForm";

function monter() {
  const handicap = vi.fn(async (_i: { besoin: string }) => ({ data: { ok: true } }));
  const amenagement = vi.fn(async (_i: { besoin: string }) => ({ data: { ok: true } }));
  render(
    <DeclarationBesoinAdaptationForm
      situationDeclaree={false}
      declarerHandicapAction={handicap}
      declarerBesoinAmenagementAction={amenagement}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Signaler un besoin/ }));
  return { handicap, amenagement };
}

describe("déclaration d'un besoin — deux intentions, deux enregistrements", () => {
  it("🔴 un besoin d'aménagement n'appelle PAS la déclaration de handicap", async () => {
    const { handicap, amenagement } = monter();
    fireEvent.click(screen.getByLabelText(/aménagement pratique/));
    fireEvent.change(screen.getByLabelText(/ce dont vous avez besoin/), {
      target: { value: "Une place près de la porte" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Transmettre" }));

    await vi.waitFor(() => expect(amenagement).toHaveBeenCalledOnce());
    expect(
      handicap,
      "un besoin matériel a emprunté le chemin qui coche « situation de handicap »",
    ).not.toHaveBeenCalled();
    expect(amenagement.mock.calls[0]?.[0].besoin).toBe("Une place près de la porte");
  });

  it("une déclaration de handicap emprunte bien son chemin", async () => {
    const { handicap, amenagement } = monter();
    fireEvent.click(screen.getByLabelText(/situation de handicap ou un problème de santé/));
    fireEvent.change(screen.getByLabelText(/ce dont vous avez besoin/), {
      target: { value: "Fauteuil roulant" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Transmettre" }));

    await vi.waitFor(() => expect(handicap).toHaveBeenCalledOnce());
    expect(amenagement).not.toHaveBeenCalled();
  });

  it("🔴 aucune valeur par défaut : sans choix, rien ne part", () => {
    // Un défaut « handicap » recréerait le défaut corrigé ici ; un défaut
    // « aménagement » perdrait une situation de handicap réelle.
    const { handicap, amenagement } = monter();
    fireEvent.change(screen.getByLabelText(/ce dont vous avez besoin/), {
      target: { value: "Une place près de la porte" },
    });
    expect(screen.getByRole("button", { name: "Transmettre" })).toBeDisabled();
    expect(handicap).not.toHaveBeenCalled();
    expect(amenagement).not.toHaveBeenCalled();
  });

  it("🔴 le texte dit ce qui sera enregistré dans chaque cas, et rappelle la confidentialité", () => {
    monter();
    const amenagement = screen.getByLabelText(/aménagement pratique/).closest("label");
    expect(amenagement?.textContent ?? "").toMatch(
      /Rien n'est enregistré comme une situation de handicap|Rien n’est enregistré comme une situation de handicap/,
    );
    const handicapOption = screen
      .getByLabelText(/situation de handicap ou un problème de santé/)
      .closest("label");
    expect(handicapOption?.textContent ?? "").toMatch(/référent handicap/);
    // La seule ligne qui porte la promesse de confidentialité.
    expect(document.body.textContent ?? "").toMatch(/chiffré/);
    expect(document.body.textContent ?? "").toMatch(/responsable habilité/);
  });

  it("🔴 l'ancien libellé fourre-tout a disparu", () => {
    monter();
    const texte = document.body.textContent ?? "";
    expect(
      texte,
      "le libellé qui faisait cocher « situation de handicap » pour un besoin matériel est revenu",
    ).not.toMatch(/trouble d.apprentissage/);
  });
});
