// I2-3 — « J'ai relu — envoyer à … » reste verrouillé jusqu'à l'aperçu à jour.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { EmailOutboxItem } from "@/components/admin/qualiopi/EmailOutboxItem";

function monter() {
  const apercuAction = vi.fn(async () => ({
    data: {
      html: "<p>Bonjour</p>",
      texte: "Bonjour",
      objet: "Objet",
      de: "Axion <a@exemple.test>",
      a: "x@exemple.test",
      repondreA: null,
      preEntete: null,
      piecesJointes: ["devis.pdf"],
    },
  }));
  const utils = render(
    <EmailOutboxItem
      id="id-1"
      template="devis-envoi"
      destinataire="x@exemple.test"
      sujet="Objet"
      clientNom={null}
      creeLe="17/11/2026"
      apercu={[]}
      nbPiecesJointes={1}
      accepteMessagePersonnalise
      approuverAction={vi.fn()}
      refuserAction={vi.fn()}
      apercuAction={apercuAction}
    />,
  );
  return { ...utils, apercuAction };
}

const caseRelu = () => screen.getByLabelText(/J.ai relu/) as HTMLInputElement;
const envoyer = () => screen.getByRole("button", { name: /Approuver et envoyer/ });
const voir = () => screen.getByRole("button", { name: /Voir l.e-mail tel qu.il partira/ });

describe("EmailOutboxItem — aperçu exact", () => {
  it("6) verrouillé avant l'aperçu, ouvert après, verrouillé de nouveau après une modification", async () => {
    const { apercuAction } = monter();
    expect(caseRelu().disabled).toBe(true);
    expect((envoyer() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(voir());
    await waitFor(() => expect(apercuAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(caseRelu().disabled).toBe(false));
    fireEvent.click(caseRelu());
    expect((envoyer() as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(screen.getByLabelText("Objet"), { target: { value: "Objet modifié" } });
    expect(caseRelu().disabled).toBe(true);
    expect((envoyer() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(voir());
    await waitFor(() => expect(apercuAction).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(caseRelu().disabled).toBe(false));
  });

  it("le message personnalisé modifié reverrouille aussi", async () => {
    monter();
    fireEvent.click(voir());
    await waitFor(() => expect(caseRelu().disabled).toBe(false));
    fireEvent.change(screen.getByPlaceholderText(/Comme convenu/), { target: { value: "Un mot" } });
    expect(caseRelu().disabled).toBe(true);
  });

  it("l'aperçu passe par le lecteur isolé : cadre sandbox vide", async () => {
    const { container } = monter();
    fireEvent.click(voir());
    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
    expect(container.querySelector("iframe")?.getAttribute("sandbox")).toBe("");
  });

  it("7) aucun texte visible ajouté ne contient le mot de la certification", () => {
    const src = readFileSync("src/components/admin/qualiopi/EmailOutboxItem.tsx", "utf8");
    const ajoute = src.split("\n").filter((l) => /Voir l.e-mail|aperçu/i.test(l));
    expect(ajoute.join("\n")).not.toMatch(/qualiopi|opco|prise en charge|financeur/i);
  });
});
