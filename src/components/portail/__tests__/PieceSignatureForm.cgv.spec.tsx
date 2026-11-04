/**
 * T12 — CGV avant signature du devis : accessibilité et verrou du bouton.
 *
 * Le bouton de signature reste inactif tant que la case « j'ai lu et j'accepte les CGV »
 * n'est pas cochée (en plus de l'attestation existante). Les liens « Lire » et
 * « Télécharger » sont de vrais liens (atteignables au clavier), HORS de l'étiquette de la
 * case : cliquer dessus ne doit jamais cocher la case.
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PieceSignatureForm } from "../PieceSignatureForm";

vi.mock("@/components/portail/SignaturePad", () => ({
  SignaturePad: (p: { onBasculerAccessible: () => void; onChange: (v: string | null) => void }) => (
    <div>
      <button type="button" onClick={() => p.onBasculerAccessible()}>
        mode-accessible
      </button>
      <button type="button" onClick={() => p.onChange("data:image/png;base64,AAAA")}>
        tracer
      </button>
    </div>
  ),
}));

const MENTIONS = ["J'accepte le devis n° AXI-DEV-2026-001.", "Valeur juridique.", "RGPD."];
const CGV = {
  version: "2026-10-04",
  libelle: "4 octobre 2026",
  href: "/fr/conditions-generales",
  pdfHref: "/api/cgv",
};

function monter(
  over: { cgv?: typeof CGV | undefined; signerAction?: ReturnType<typeof vi.fn> } = {},
) {
  const signerAction =
    over.signerAction ??
    vi.fn().mockResolvedValue({ ok: true, signatureId: "s", statutSignature: "partielle" });
  const cgv = "cgv" in over ? over.cgv : CGV;
  render(
    <PieceSignatureForm
      token="tok"
      numero="AXI-DEV-2026-001"
      dateValiditeLisible={null}
      organismeNom="Axion-IA"
      clientRaisonSociale="Acme"
      signataireNom="Marie Dupont"
      signataireQualite="Gérante"
      pieceLibelle="devis"
      pdfUrl={null}
      mentions={MENTIONS}
      signerAction={signerAction}
      {...(cgv !== undefined ? { cgv } : {})}
    />,
  );
  return signerAction;
}

const bouton = () => screen.getByRole("button", { name: /^signer devis$/i }) as HTMLButtonElement;

describe("bloc des CGV", () => {
  it("affiche la version et deux liens : lire (nouvel onglet) et télécharger", () => {
    monter();
    expect(
      screen.getByText(/conditions générales de vente \(version du 4 octobre 2026\)/i),
    ).toBeTruthy();
    const lire = screen.getByRole("link", { name: /lire/i }) as HTMLAnchorElement;
    expect(lire.getAttribute("href")).toBe("/fr/conditions-generales");
    expect(lire.getAttribute("target")).toBe("_blank");
    expect(lire.getAttribute("rel")).toContain("noopener");
    expect(lire.getAttribute("rel")).toContain("noreferrer");
    const tel = screen.getByRole("link", { name: /télécharger/i }) as HTMLAnchorElement;
    expect(tel.getAttribute("href")).toBe("/api/cgv");
  });

  it("les liens sont HORS de l'étiquette de la case", () => {
    monter();
    const etiquette = screen
      .getByRole("checkbox", { name: /j'ai lu et j'accepte les conditions générales de vente/i })
      .closest("label");
    expect(etiquette).not.toBeNull();
    expect(etiquette?.querySelector("a")).toBeNull();
  });

  it("la case CGV est un vrai <input type=checkbox> distinct de l'attestation", () => {
    monter();
    const cases = screen.getAllByRole("checkbox");
    expect(cases).toHaveLength(2);
    expect(cases.every((c) => c.tagName === "INPUT")).toBe(true);
  });
});

describe("verrou du bouton", () => {
  it("inactif tant que la case CGV n'est pas cochée, même attestation cochée", () => {
    monter();
    fireEvent.click(screen.getByText("mode-accessible"));
    fireEvent.click(screen.getByRole("checkbox", { name: /J'accepte le devis/ }));
    expect(bouton().disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /conditions générales de vente/i }));
    expect(bouton().disabled).toBe(false);
  });

  it("cocher les CGV seules ne suffit pas", () => {
    monter();
    fireEvent.click(screen.getByText("mode-accessible"));
    fireEvent.click(screen.getByRole("checkbox", { name: /conditions générales de vente/i }));
    expect(bouton().disabled).toBe(true);
  });

  it("l'aide sous le bouton mentionne les CGV", () => {
    monter();
    expect(screen.getByText(/conditions générales/i, { selector: "p.text-xs" })).toBeTruthy();
  });

  it("envoie cgvAcceptees:true et la version affichée", async () => {
    const action = monter();
    fireEvent.click(screen.getByText("mode-accessible"));
    fireEvent.click(screen.getByRole("checkbox", { name: /J'accepte le devis/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /conditions générales de vente/i }));
    fireEvent.click(bouton());
    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(action).toHaveBeenCalledWith(
      expect.objectContaining({ cgvAcceptees: true, cgvVersionAffichee: "2026-10-04" }),
    );
  });
});

describe("sans prop cgv (convention, contrat…) : écran inchangé", () => {
  it("une seule case, bouton actif dès l'attestation, aucun champ CGV envoyé", async () => {
    const action = monter({ cgv: undefined });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /télécharger/i })).toBeNull();
    fireEvent.click(screen.getByText("mode-accessible"));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(bouton().disabled).toBe(false);
    fireEvent.click(bouton());
    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(action.mock.calls[0]?.[0]).not.toHaveProperty("cgvAcceptees");
  });
});
