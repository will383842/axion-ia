/**
 * Positionnement (portail) — la question du besoin d'adaptation.
 *
 * Constat sur la seule session réelle : une personne sans handicap ni
 * contrainte de santé a coché « J'ai un besoin d'adaptation (matériel, rythme,
 * accessibilité, situation de handicap) ». « Matériel » et « rythme » sont des
 * souhaits que tout participant peut avoir ; et une case NON cochée partait en
 * « non » même si la question n'avait jamais été lue.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PositionnementPortailForm } from "../PositionnementPortailForm";

function monter() {
  const soumettre = vi.fn(async (_i: { reponses: Record<string, unknown> }) => ({
    data: { id: "q-1" },
  }));
  const { container } = render(
    <PositionnementPortailForm questionnaireId="q-1" objectifs={[]} soumettreAction={soumettre} />,
  );
  const form = container.querySelector("form");
  if (form === null) throw new Error("formulaire absent");
  return { soumettre, form };
}

describe("positionnement — besoin d'adaptation", () => {
  it("🔴 ne part PAS sans réponse : pas de « non » supposé", async () => {
    const { soumettre, form } = monter();
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("oui ou non");
    expect(soumettre).not.toHaveBeenCalled();
  });

  it("🔴 la question vise l'aménagement lié au handicap, à la santé ou à l'accès — pas le rythme", () => {
    const { form } = monter();
    const texte = form.textContent ?? "";
    expect(texte).toMatch(/handicap/);
    expect(texte).toMatch(/santé/);
    expect(texte).not.toMatch(/matériel, rythme/);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("un « non » explicite part en `false` (la clé et son type ne changent pas)", async () => {
    const { soumettre, form } = monter();
    fireEvent.click(screen.getByLabelText(/Non, aucun aménagement/));
    fireEvent.submit(form);
    await vi.waitFor(() => expect(soumettre).toHaveBeenCalledOnce());
    expect(soumettre.mock.calls[0]?.[0].reponses["besoinAdaptation"]).toBe(false);
    // D6 — le marqueur que le serveur exige, et qu'un ancien formulaire ne porte pas.
    expect(soumettre.mock.calls[0]?.[0].reponses["besoinAdaptationRepondu"]).toBe(true);
  });

  it("un « oui » explicite part en `true`", async () => {
    const { soumettre, form } = monter();
    fireEvent.click(screen.getByLabelText(/Oui, j'ai besoin d'un aménagement/));
    fireEvent.submit(form);
    await vi.waitFor(() => expect(soumettre).toHaveBeenCalledOnce());
    expect(soumettre.mock.calls[0]?.[0].reponses["besoinAdaptation"]).toBe(true);
  });
});
