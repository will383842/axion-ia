/**
 * PieceSignatureForm — conditions particulières (devis classique) et articles des libellés.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PieceSignatureForm } from "./PieceSignatureForm";

/** Phrase LUE DANS LA PHOTO de la pièce : le formulaire ne connaît aucune constante. */
const PHRASE_PHOTO = "Phrase de primauté figée dans la photo de la pièce.";

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
      phrasePrimaute: PHRASE_PHOTO,
    });
    expect(screen.getByText("Conditions particulières")).toBeTruthy();
    expect(screen.getByText(/Acompte de 30 %\./)).toBeTruthy();
    expect(screen.getByText(PHRASE_PHOTO)).toBeTruthy();
    const html = container.innerHTML;
    expect(html.indexOf("Conditions particulières")).toBeLessThan(
      html.indexOf("Conditions générales de vente (version"),
    );
    expect(html.indexOf("Total TTC")).toBeLessThan(html.indexOf("Conditions particulières"));
  });

  it("pas de phrase dans la photo (nulle ou absente) : le texte s'affiche sans phrase", () => {
    for (const extra of [{ phrasePrimaute: null }, {}]) {
      rendre({ conditionsParticulieres: "Acompte de 30 %.", ...extra });
      expect(screen.getByText(/Acompte de 30 %\./)).toBeTruthy();
      expect(screen.queryByText(/prévalent/)).toBeNull();
      cleanup();
    }
  });

  it("le formulaire n'importe plus la constante de la phrase", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/components/portail/PieceSignatureForm.tsx", "utf8");
    expect(src).not.toContain("PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES");
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

describe("version de mention postée avec la signature", () => {
  it("poste la version de mention reçue en propriété, sous `mentionVersionAffichee`", async () => {
    const { fireEvent, waitFor } = await import("@testing-library/react");
    const signerAction = vi.fn().mockResolvedValue({ ok: false, message: "x" });
    rendre({
      signerAction,
      mentionVersion: "doc-v2",
      cgv: undefined,
      pieceLibelleDefini: "le devis",
    });
    // Mode accessible : pas de tracé à produire ; puis la seule case à cocher (attestation).
    fireEvent.click(screen.getByRole("button", { name: /signer sans tracer/i }));
    for (const c of screen.getAllByRole("checkbox")) fireEvent.click(c);
    fireEvent.click(screen.getByRole("button", { name: "Signer le devis" }));
    await waitFor(() => expect(signerAction).toHaveBeenCalled());
    expect(signerAction.mock.calls[0]?.[0]).toMatchObject({ mentionVersionAffichee: "doc-v2" });
  });
});
