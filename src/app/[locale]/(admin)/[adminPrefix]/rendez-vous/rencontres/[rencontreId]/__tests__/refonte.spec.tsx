import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { CarteLigne, EncartTeinte, PastilleEtat, TuilesRencontre } from "../vue-fiche";

describe("Fiche d'une rencontre — refonte visuelle", () => {
  it("les tuiles montrent les bons chiffres et tons", () => {
    const { container } = render(
      <TuilesRencontre
        d={{ compteRenduValide: false, nbFaits: 3, nbVersions: 2, suiteFaite: true }}
      />,
    );
    expect(screen.getByText("À écrire")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Faite")).toBeTruthy();
    expect(container.querySelectorAll(".admin-stat-card")).toHaveLength(4);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("une carte porte sa bordure gauche et sa pastille avec icône", () => {
    const { container } = render(
      <ul>
        <CarteLigne
          ton="success"
          pastille={
            <PastilleEtat ton="success" valide>
              Validé
            </PastilleEtat>
          }
          titre="Besoin"
        >
          Former l&apos;équipe
        </CarteLigne>
      </ul>,
    );
    const carte = container.querySelector("[data-carte='success']");
    expect(carte?.className).toContain("border-l-4");
    expect(carte?.className).toContain("--color-admin-success");
    expect(screen.getByText("Besoin").className).toContain("font-semibold");
    expect(container.querySelector("svg[data-icone='etat']")).not.toBeNull();
  });

  it("l'encadré teinté garde son rôle et son texte", () => {
    render(
      <EncartTeinte ton="destructive" role="alert">
        Échec
      </EncartTeinte>,
    );
    expect(screen.getByRole("alert").textContent).toBe("Échec");
  });

  it("la page garde ses actions, son état vide et n'ajoute aucun vocabulaire interdit", () => {
    const src = readFileSync(join(__dirname, "../page.tsx"), "utf8");
    expect(src).toContain("deplacerRencontreAction");
    expect(src).toContain("Aucun compte rendu validé");
    expect(src).toContain("AdminEmptyState");
    const ajoute = readFileSync(join(__dirname, "../vue-fiche.tsx"), "utf8");
    expect(ajoute).not.toMatch(/qualiopi|opco|financement|prise en charge|certification|cpf/i);
    expect(src).not.toMatch(/<iframe/i);
  });
});
