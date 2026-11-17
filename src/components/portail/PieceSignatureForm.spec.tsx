/**
 * PieceSignatureForm — conditions particulières (devis classique) et articles des libellés.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PieceSignatureForm } from "./PieceSignatureForm";
const PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES = "Phrase de primauté transmise par la page.";

afterEach(cleanup);

const base = {
  token: "t".repeat(40),
  numero: "AXI-DOC-2026-001",
  numeroDevis: "AXI-DEV-2026-014",
  dateValiditeLisible: "05/12/2026",
  organismeNom: "Axion-IA SAS",
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
  mentions: ["J'ai pris connaissance du devis et je l'accepte."],
  cgv: { libelle: "01/01/2026", href: "/cgv", pdfHref: "/cgv.pdf", version: "v1" },
  signerAction: vi.fn(),
};

const rendre = (extra: Record<string, unknown> = {}) =>
  render(
    <PieceSignatureForm
      {...({ ...base, ...extra } as unknown as React.ComponentProps<typeof PieceSignatureForm>)}
    />,
  );

describe("conditions particulières sur la page de signature", () => {
  it("titre, texte brut et phrase de primauté, AVANT le bloc des conditions générales", () => {
    const { container } = rendre({
      conditionsParticulieres: "Acompte de 30 %.\n\nSolde à 30 jours.",
      phrasePrimauteConditionsParticulieres: PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES,
    });
    expect(screen.getByText("Conditions particulières")).toBeTruthy();
    expect(screen.getByText(/Acompte de 30 %\./)).toBeTruthy();
    expect(screen.getByText(PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES)).toBeTruthy();
    const html = container.innerHTML;
    expect(html.indexOf("Conditions particulières")).toBeLessThan(
      html.indexOf("Conditions générales de vente (version"),
    );
    expect(html.indexOf("Total TTC")).toBeLessThan(html.indexOf("Conditions particulières"));
  });

  it("texte brut : un balisage saisi n'est jamais interprété, retours à la ligne conservés", () => {
    const { container } = rendre({ conditionsParticulieres: "<b>gras</b> <img src=x>\nligne 2" });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    const p = screen.getByText(/<b>gras<\/b>/);
    expect(p.className).toContain("whitespace-pre-line");
  });

  it("absent ou null : aucun bloc", () => {
    rendre();
    expect(screen.queryByText("Conditions particulières")).toBeNull();
    cleanup();
    rendre({ conditionsParticulieres: null });
    expect(screen.queryByText("Conditions particulières")).toBeNull();
  });

  it("la source n'utilise jamais dangerouslySetInnerHTML", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/components/portail/PieceSignatureForm.tsx", "utf8");
    expect(src).not.toContain("dangerouslySetInnerHTML");
  });
});

describe("articles des libellés de pièce", () => {
  it("bouton et lien PDF disent « le devis »", () => {
    rendre({ pieceLibelleDefini: "le devis" });
    expect(screen.getByRole("button", { name: "Signer le devis" })).toBeTruthy();
    expect(screen.getByText("Ouvrir le devis au format PDF")).toBeTruthy();
    expect(screen.queryByText("Signer devis")).toBeNull();
  });

  it("convention : « la convention de formation »", () => {
    rendre({
      pieceLibelle: "convention de formation",
      pieceLibelleDefini: "la convention de formation",
    });
    expect(screen.getByRole("button", { name: "Signer la convention de formation" })).toBeTruthy();
    expect(screen.getByText("Ouvrir la convention de formation au format PDF")).toBeTruthy();
  });
});
