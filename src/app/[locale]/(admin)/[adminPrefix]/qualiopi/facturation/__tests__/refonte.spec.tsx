import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ListeFactures, TuilesFacturation } from "../FacturationVisuel";
import type { CarteFactureProps } from "../FacturationVisuel";

function carte(over: Partial<CarteFactureProps> = {}): CarteFactureProps {
  return {
    id: "f1",
    numero: "AXI-FAC-2026-001",
    estAvoir: false,
    statut: "en_retard",
    statutLibelle: "En retard",
    activite: "Formation",
    client: "Société Test",
    chorusPro: false,
    refClient: "CMD-7",
    montant: "1 200,00 €",
    canal: "Plateforme agréée",
    emise: "01/10/2026",
    echeance: "31/10/2026",
    detailHref: "/fr/x/qualiopi/facturation/f1",
    ...over,
  };
}

describe("Facturation — tuiles", () => {
  it("affiche chaque chiffre clé avec son libellé", () => {
    render(
      <TuilesFacturation
        tuiles={[
          { label: "Émis (TTC)", value: "10 000,00 €", ton: "info" },
          { label: "En retard (2)", value: "500,00 €", ton: "destructive" },
        ]}
      />,
    );
    const liste = screen.getByRole("list", { name: "Chiffres clés" });
    expect(within(liste).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("10 000,00 €")).toBeTruthy();
    expect(screen.getByText("En retard (2)")).toBeTruthy();
  });
});

describe("Facturation — cartes", () => {
  it("rend une carte par facture, pastille d'état pleine avec icône, bordure d'état", () => {
    const { container } = render(
      <ListeFactures
        cartes={[carte(), carte({ id: "f2", statut: "payee", statutLibelle: "Payée" })]}
        titreVide="Aucune facture"
        descriptionVide="vide"
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]!.className).toContain("border-l-4");
    expect(items[0]!.className).toContain("--color-admin-destructive");
    expect(items[1]!.className).toContain("--color-admin-success");
    const pastille = screen.getByText("En retard").closest(".admin-badge-v2");
    expect(pastille?.className).toContain("admin-badge-plein--destructive");
    expect(pastille?.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("table")).toBeNull();
    expect(screen.getAllByText("AXI-FAC-2026-001").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Détail/ })[0]!.getAttribute("href")).toBe(
      "/fr/x/qualiopi/facturation/f1",
    );
  });

  it("montre l'avoir, le badge Chorus Pro et l'action passée telle quelle", () => {
    render(
      <ListeFactures
        cartes={[
          carte({
            estAvoir: true,
            chorusPro: true,
            action: <button type="button">Encaisser</button>,
          }),
        ]}
        titreVide="Aucune facture"
        descriptionVide="vide"
      />,
    );
    expect(screen.getByText(/\(avoir\)/)).toBeTruthy();
    expect(screen.getByText("Chorus Pro")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Encaisser" })).toBeTruthy();
  });

  it("état vide avec icône quand il n'y a aucune facture", () => {
    const { container } = render(
      <ListeFactures
        cartes={[]}
        titreVide="Aucune facture"
        descriptionVide="Créer un devis puis le facturer, ou émettre une facture libre."
      />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Aucune facture")).toBeTruthy();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("Facturation — garde de vocabulaire (textes ajoutés)", () => {
  it("les libellés ajoutés n'emploient aucun terme réservé", () => {
    const { container } = render(
      <>
        <TuilesFacturation tuiles={[{ label: "Encaissé", value: "0 €", ton: "success" }]} />
        <ListeFactures cartes={[]} titreVide="Aucune facture" descriptionVide="Rien." />
      </>,
    );
    expect(container.textContent ?? "").not.toMatch(
      /qualiopi|opco|financement|prise en charge|certification|cpf/i,
    );
  });
});
