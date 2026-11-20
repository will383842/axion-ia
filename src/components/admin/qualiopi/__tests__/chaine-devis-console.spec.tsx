import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const relance = vi.hoisted(() => vi.fn());
vi.mock("@/features/dossier-client/fiche/actions-relance-devis", () => ({
  preparerRelanceDevisAction: relance,
}));

import { PastilleHorodatage } from "../PastilleHorodatage";
import { RelanceDevisDepuisLaPage } from "../RelanceDevisDepuisLaPage";
import { BandeauAssistantEssai } from "../BandeauAssistantEssai";
import { PastilleAContresigner } from "../PastilleAContresigner";

describe("PastilleHorodatage", () => {
  it("affiche le libellé", () => {
    render(
      <PastilleHorodatage
        etat={{ genre: "attente", libelle: "Horodatage : en attente depuis le 18/11/2026" }}
      />,
    );
    expect(screen.getByText(/en attente depuis le 18\/11\/2026/)).toBeTruthy();
  });
});

describe("RelanceDevisDepuisLaPage", () => {
  it("formulaire vers l'action existante, avec le retour sur la page du devis", () => {
    const { container } = render(
      <RelanceDevisDepuisLaPage clientId="c1" devisId="d1" emailsHref="/fr/x/qualiopi/emails" />,
    );
    expect(screen.getByRole("button", { name: "Préparer une relance" })).toBeTruthy();
    expect((container.querySelector('input[name="clientId"]') as HTMLInputElement).value).toBe(
      "c1",
    );
    expect((container.querySelector('input[name="devisId"]') as HTMLInputElement).value).toBe("d1");
    expect((container.querySelector('input[name="retourDevis"]') as HTMLInputElement).value).toBe(
      "d1",
    );
  });
  it("affiche le résultat scellé reçu", () => {
    render(
      <RelanceDevisDepuisLaPage
        clientId="c1"
        devisId="d1"
        emailsHref="/e"
        message="La relance est prête."
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("La relance est prête.");
  });
  it("affiche l'erreur en alerte", () => {
    render(<RelanceDevisDepuisLaPage clientId="c1" devisId="d1" emailsHref="/e" erreur="Échec." />);
    expect(screen.getByRole("alert").textContent).toContain("Échec.");
  });
});

describe("BandeauAssistantEssai", () => {
  it("role=status, phrase exacte et lien vers la liste des clients", () => {
    render(<BandeauAssistantEssai clientsHref="/fr/x/qualiopi/clients" />);
    const s = screen.getByRole("status");
    expect(s.textContent).toContain("Assistant en essai : ouvrez-le depuis une fiche d'essai.");
    expect(screen.getByRole("link").getAttribute("href")).toBe("/fr/x/qualiopi/clients");
  });
});

describe("PastilleAContresigner", () => {
  it("devis à contresigner : pastille ; sinon rien", () => {
    const { rerender, container } = render(
      <PastilleAContresigner
        devis={{ statut: "envoye", documentGenereId: "p1" }}
        pieces={new Set(["p1"])}
      />,
    );
    expect(screen.getByText("À contresigner")).toBeTruthy();
    rerender(
      <PastilleAContresigner
        devis={{ statut: "envoye", documentGenereId: "p2" }}
        pieces={new Set(["p1"])}
      />,
    );
    expect(container.textContent).toBe("");
  });
});
