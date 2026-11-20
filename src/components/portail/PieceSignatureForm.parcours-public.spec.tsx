/** PieceSignatureForm : aide du bouton de code, tableau en cartes (CSS seul), question par e-mail. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PieceSignatureForm } from "./PieceSignatureForm";

afterEach(cleanup);

const base = {
  token: "t".repeat(40),
  numero: "AXI-DOC-2026-001",
  numeroDevis: "AXI-DEV-2026-014",
  dateValiditeLisible: "05/12/2026",
  organismeNom: "Axion-IA SAS",
  organismeEmail: "contact@organisme.test",
  clientRaisonSociale: "Acme SAS",
  signataireNom: "Camille Durand",
  signataireQualite: "Directrice",
  lignes: [
    {
      designation: "Atelier IA",
      quantite: 1,
      prixUnitaireHtLisible: "2 800,00 €",
      totalHtLisible: "2 800,00 €",
    },
  ],
  totalHtLisible: "2 800,00 €",
  totalTtcLisible: "3 360,00 €",
  mentionTva: null,
  pieceLibelle: "devis",
  pdfUrl: "/pdf",
  mentions: ["J'accepte le devis."],
  signerAction: vi.fn(),
  demanderCodeAction: vi.fn(),
};
const rendre = (extra: Record<string, unknown> = {}) =>
  render(
    <PieceSignatureForm
      {...({ ...base, ...extra } as unknown as React.ComponentProps<typeof PieceSignatureForm>)}
    />,
  );

describe("aide sous « Signer »", () => {
  it("avec code : nomme le bouton « Recevoir mon code »", () => {
    rendre();
    const bouton = screen.getByRole("button", { name: "Recevoir mon code" });
    expect(bouton).toBeTruthy();
    expect(
      screen.getByText(
        /Cliquez sur « Recevoir mon code », puis saisissez le code reçu par e-mail\./,
      ),
    ).toBeTruthy();
  });
});

describe("tableau des lignes en cartes sous 640 px", () => {
  it("pas de largeur minimale ni de défilement horizontal", () => {
    const { container } = rendre();
    expect(container.innerHTML).not.toContain("min-w-[32rem]");
    expect(container.innerHTML).not.toContain("overflow-x-auto");
  });
  it("classes responsives (max-sm) et étiquettes par cellule, sans JS", () => {
    const { container } = rendre();
    const table = container.querySelector("table")!;
    expect(table.className).toContain("max-sm:block");
    expect(container.querySelector("tr")!.parentElement!.tagName).toBe("THEAD");
    expect(container.querySelector("thead")!.className).toContain("max-sm:sr-only");
    const cellules = container.querySelectorAll("tbody td");
    expect([...cellules].map((c) => c.getAttribute("data-label"))).toEqual([
      "Désignation",
      "Qté",
      "PU HT",
      "Total HT",
    ]);
  });
});

describe("« Une question sur ce devis ? »", () => {
  it("mailto de l'organisme, objet = numéro du devis, rien d'autre", () => {
    rendre();
    const a = screen.getByRole("link", { name: "Une question sur ce devis ?" });
    const href = a.getAttribute("href")!;
    expect(href).toBe(
      `mailto:contact@organisme.test?subject=${encodeURIComponent("Question sur le devis AXI-DEV-2026-014")}`,
    );
    expect(href).not.toContain("Camille");
    expect(href).not.toContain("Acme");
    expect(href).not.toContain("t".repeat(40));
  });
  it("sans e-mail d'organisme ou hors devis : pas de lien", () => {
    rendre({ organismeEmail: "" });
    expect(screen.queryByRole("link", { name: /question/i })).toBeNull();
    cleanup();
    rendre({ numeroDevis: undefined });
    expect(screen.queryByRole("link", { name: /question/i })).toBeNull();
  });
});
