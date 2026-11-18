/**
 * Lot 4 bis — signature « simple renforcée » du devis à formules : le signataire SAISIT son nom et
 * sa fonction, déclare avoir le pouvoir d'engager la société et saisit le code reçu par e-mail.
 * Le code n'est envoyé que sur le clic « Recevoir mon code ».
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PieceSignatureForm } from "../PieceSignatureForm";
import type { OffreAffichee } from "../PieceSignatureForm";

vi.mock("@/components/portail/SignaturePad", () => ({
  SignaturePad: (p: { onBasculerAccessible: () => void }) => (
    <button type="button" onClick={() => p.onBasculerAccessible()}>
      mode-accessible
    </button>
  ),
}));

const CGV = {
  version: "2026-10-04",
  libelle: "4 octobre 2026",
  href: "/fr/conditions-generales",
  pdfHref: "/api/cgv?dl=1",
};
const OFFRE: OffreAffichee = {
  formules: [
    {
      formule: "abonnement",
      libelle: "Formule B",
      baseHtLisible: "300,00 €",
      baseTtcLisible: "360,00 €",
      lignes: [],
      maintenance: null,
      abonnement: {
        mensuelLisible: "90,00 € HT / mois",
        engagementMois: 12,
        periodes: [{ mois: 1, libelle: "1 mois" }],
      },
    },
  ],
  automatisations: [],
};
const RECAP = {
  formuleLibelle: "Formule B",
  automatisations: [],
  totalPonctuelHtLisible: "300,00 €",
  totalPonctuelTtcLisible: "360,00 €",
  recurrent: [],
};

function monter(
  opts: { signer?: ReturnType<typeof vi.fn>; demander?: ReturnType<typeof vi.fn> } = {},
) {
  const signerAction =
    opts.signer ??
    vi.fn().mockResolvedValue({ ok: true, signatureId: "s", statutSignature: "partielle" });
  const demanderCodeAction =
    opts.demander ??
    vi.fn().mockResolvedValue({ ok: true, destinataireMasque: "c***@client.test" });
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
      mentions={["J'accepte le devis n° AXI-DEV-2026-001.", "Valeur juridique."]}
      cgv={CGV}
      formules={{
        offre: OFFRE,
        apercuAction: vi.fn().mockResolvedValue({ ok: true as const, recap: RECAP }),
      }}
      declaration
      demanderCodeAction={demanderCodeAction}
      signerAction={signerAction}
    />,
  );
  return { signerAction, demanderCodeAction };
}

const bouton = () => screen.getByRole("button", { name: /^signer devis$/i }) as HTMLButtonElement;
const nom = () => screen.getByLabelText(/votre nom/i) as HTMLInputElement;
const fonction = () => screen.getByLabelText(/votre fonction/i) as HTMLInputElement;
const pouvoir = () =>
  screen.getByRole("checkbox", { name: /pouvoir d'engager la société/i }) as HTMLInputElement;
const code = () => screen.getByLabelText(/code reçu par e-mail/i) as HTMLInputElement;

async function choisirLaFormule() {
  fireEvent.click(screen.getByRole("radio", { name: /Formule B/ }));
  fireEvent.click(screen.getByRole("radio", { name: /1 mois/ }));
  await waitFor(() => expect(screen.getAllByText(/300,00 €/).length).toBeGreaterThan(0));
}

async function toutRemplirSaufCode() {
  fireEvent.click(screen.getByText("mode-accessible"));
  fireEvent.click(screen.getByRole("checkbox", { name: /J'accepte le devis/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /conditions générales de vente/i }));
  await choisirLaFormule();
  fireEvent.change(nom(), { target: { value: "Marie Dupont" } });
  fireEvent.change(fonction(), { target: { value: "Gérante" } });
  fireEvent.click(pouvoir());
}

describe("signature renforcée — l'écran", () => {
  it("demande nom et fonction À SAISIR (jamais préremplis), la case du pouvoir et le code", () => {
    monter();
    expect(nom().value).toBe("");
    expect(fonction().value).toBe("");
    expect(pouvoir().checked).toBe(false);
    expect(code()).toBeTruthy();
    expect(screen.getByRole("button", { name: /recevoir mon code/i })).toBeTruthy();
  });

  it("le bouton reste inactif tant qu'un élément manque : nom, fonction, case, code", async () => {
    monter();
    fireEvent.click(screen.getByText("mode-accessible"));
    fireEvent.click(screen.getByRole("checkbox", { name: /J'accepte le devis/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /conditions générales de vente/i }));
    await choisirLaFormule();
    expect(bouton().disabled).toBe(true);
    fireEvent.change(nom(), { target: { value: "Marie Dupont" } });
    fireEvent.change(fonction(), { target: { value: "Gérante" } });
    fireEvent.change(code(), { target: { value: "123456" } });
    expect(bouton().disabled).toBe(true); // la case du pouvoir manque
    fireEvent.click(pouvoir());
    expect(bouton().disabled).toBe(false);
    fireEvent.change(nom(), { target: { value: " " } });
    expect(bouton().disabled).toBe(true);
    fireEvent.change(nom(), { target: { value: "Marie Dupont" } });
    fireEvent.change(code(), { target: { value: "12345" } });
    expect(bouton().disabled).toBe(true);
  });

  it("le code n'accepte que 6 chiffres", () => {
    monter();
    fireEvent.change(code(), { target: { value: "12a34b56789" } });
    expect(code().value).toBe("123456");
  });

  it("n'envoie le code qu'au CLIC, et affiche l'adresse masquée", async () => {
    const { demanderCodeAction } = monter();
    expect(demanderCodeAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /recevoir mon code/i }));
    await waitFor(() =>
      expect(screen.getByText(/Code envoyé à c\*\*\*@client\.test/)).toBeTruthy(),
    );
    expect(demanderCodeAction).toHaveBeenCalledTimes(1);
    expect(demanderCodeAction).toHaveBeenCalledWith({ token: "tok" });
  });

  it("affiche le refus du serveur (blocage, trop tôt…) sans rien envoyer d'autre", async () => {
    monter({
      demander: vi
        .fn()
        .mockResolvedValue({ ok: false, message: "Trop d'essais. Réessayez plus tard." }),
    });
    fireEvent.click(screen.getByRole("button", { name: /recevoir mon code/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Trop d'essais/));
  });

  it("signe avec la déclaration saisie, la case du pouvoir cochée et le code", async () => {
    const { signerAction } = monter();
    await toutRemplirSaufCode();
    fireEvent.change(code(), { target: { value: "654321" } });
    fireEvent.click(bouton());
    await waitFor(() => expect(signerAction).toHaveBeenCalledTimes(1));
    const arg = signerAction.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg["code"]).toBe("654321");
    expect(arg["declaration"]).toEqual({
      nom: "Marie Dupont",
      fonction: "Gérante",
      pouvoirEngager: true,
    });
    expect(arg["cgvAcceptees"]).toBe(true);
    await waitFor(() => expect(screen.getByText(/signature est enregistrée/i)).toBeTruthy());
  });

  it("refus du serveur (code faux) : le message s'affiche, la page reste signable", async () => {
    const { signerAction } = monter({
      signer: vi.fn().mockResolvedValue({ ok: false, message: "Ce code n'est pas valide." }),
    });
    await toutRemplirSaufCode();
    fireEvent.change(code(), { target: { value: "000000" } });
    fireEvent.click(bouton());
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/pas valide/));
    expect(signerAction).toHaveBeenCalledTimes(1);
    expect(bouton().disabled).toBe(false);
  });
});
