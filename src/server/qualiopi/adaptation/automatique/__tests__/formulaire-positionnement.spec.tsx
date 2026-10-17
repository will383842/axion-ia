/**
 * Chantier QNC, L04 — la déclaration STRUCTURÉE du besoin au positionnement.
 *
 * Verrouille : cocher un type PROPOSE ses mesures standard (pré-cochées) ; la
 * confirmation part en un clic ; sans consentement, aucune précision ne quitte
 * le navigateur ; et le catalogue reçu de la page est bien celui du serveur.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PositionnementPortailForm } from "@/components/portail/PositionnementPortailForm";
import {
  cataloguePortail,
  mesuresProposees,
} from "@/server/qualiopi/adaptation/automatique/catalogue-mesures";

/** Le bloc structuré est chargé par `next/dynamic` : on attend qu'il soit là. */
async function monter() {
  const soumettre = vi.fn(async (_i: { reponses: Record<string, unknown> }) => ({
    data: { id: "q-1" },
  }));
  const { container } = render(
    <PositionnementPortailForm
      questionnaireId="q-1"
      objectifs={[]}
      adaptationAutomatique
      catalogueAdaptation={cataloguePortail()}
      soumettreAction={soumettre}
    />,
  );
  const form = container.querySelector("form");
  if (form === null) throw new Error("formulaire absent");
  fireEvent.click(screen.getByLabelText(/Oui, j'ai besoin d'un aménagement/));
  await screen.findByLabelText(/J'accepte que ces précisions/);
  return { soumettre, form };
}

describe("positionnement — déclaration structurée (L04)", () => {
  it("cocher « Auditif » propose les mesures standard du catalogue, confirmées en un clic", async () => {
    const { soumettre, form } = await monter();
    fireEvent.click(screen.getByLabelText(/J'accepte que ces précisions/));
    fireEvent.click(screen.getByLabelText("Auditif"));
    // Proposées et pré-cochées : celles du serveur, ni plus ni moins.
    expect((screen.getByLabelText(/Sous-titrage/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/Interprète en langue/) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByLabelText(/Je confirme ces aménagements/));
    fireEvent.submit(form);
    await vi.waitFor(() => expect(soumettre).toHaveBeenCalledOnce());
    const r = soumettre.mock.calls[0]?.[0].reponses ?? {};
    expect(r["adaptationTypes"]).toEqual(["auditif"]);
    expect(r["adaptationMesures"]).toEqual(mesuresProposees(["auditif"]));
    expect(r["adaptationChoix"]).toBe("confirme");
    expect(r["adaptationConsentement"]).toBe(true);
    expect(r).not.toHaveProperty("detailAdaptation");
  });

  it("sans consentement : seul l'échange est possible, et rien de détaillé ne part", async () => {
    const { soumettre, form } = await monter();
    expect(
      (screen.getByLabelText(/Je confirme ces aménagements/) as HTMLInputElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByLabelText(/Je préfère un échange écrit/));
    fireEvent.submit(form);
    await vi.waitFor(() => expect(soumettre).toHaveBeenCalledOnce());
    const r = soumettre.mock.calls[0]?.[0].reponses ?? {};
    expect(r["adaptationConsentement"]).toBe(false);
    expect(r["adaptationChoix"]).toBe("echange");
    expect(r).not.toHaveProperty("adaptationTypes");
    expect(r).not.toHaveProperty("adaptationCommentaire");
  });

  it("ne part pas sans choix (confirmer ou échanger)", async () => {
    const { soumettre, form } = await monter();
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent(/échange/);
    expect(soumettre).not.toHaveBeenCalled();
  });
});
