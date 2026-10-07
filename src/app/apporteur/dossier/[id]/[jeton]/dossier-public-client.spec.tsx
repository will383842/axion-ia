// Dossier public, côté navigateur : la coupure réseau ne perd pas la saisie (D8), le nom
// d'un seul mot se complète à l'étape 1 (D2), « Écrivez-nous » a une adresse (D18), l'étape
// est annoncée et reçoit le focus (D19).
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  signerAction: vi.fn(),
  deposerPieceAction: vi.fn(),
  enregistrerActiviteAction: vi.fn(),
  enregistrerCoordonneesAction: vi.fn(),
  rechercherSirenAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("./actions", () => ({
  signerAction: (...a: unknown[]) => h.signerAction(...a),
  deposerPieceAction: (...a: unknown[]) => h.deposerPieceAction(...a),
  enregistrerActiviteAction: (...a: unknown[]) => h.enregistrerActiviteAction(...a),
  enregistrerCoordonneesAction: (...a: unknown[]) => h.enregistrerCoordonneesAction(...a),
  rechercherSirenAction: (...a: unknown[]) => h.rechercherSirenAction(...a),
}));

import {
  CLES_ACCEPTATIONS,
  CLES_DECLARATIONS,
} from "@/features/apporteurs-reseau/signature-regles";

import { DepotPiece } from "./DepotPiece";
import { DossierEnLigne, type DossierPublic } from "./DossierEnLigne";
import { TEXTES } from "./textes";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

function dossier(over: Partial<DossierPublic> = {}): DossierPublic {
  return {
    id: ID,
    jeton: "j".repeat(43),
    statut: "dossier_en_cours",
    prenom: "Éloïse",
    nom: "Lefèvre",
    email: "e@exemple.fr",
    telephone: null,
    siren: "732829320",
    denomination: "Ma société",
    adresse: "1 rue des Alpes",
    statutJuridique: "micro_entrepreneur",
    regimeTva: "franchise_293b",
    numeroTva: null,
    ibanMasque: "FR76 •••• •••• 0189",
    ibanSaisi: true,
    dernierMessage: null,
    pieces: [
      { type: "identite", statut: "deposee", motif: null, nomFichier: "cni.pdf" },
      { type: "rib", statut: "deposee", motif: null, nomFichier: "rib.pdf" },
    ],
    ...over,
  };
}

const rendre = (d: DossierPublic, etape: 1 | 2 | 3 | 4) =>
  render(
    <DossierEnLigne dossier={d} etapeInitiale={etape} contrat={<p>Contrat</p>} urlPdf="/pdf" />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("D8 : une coupure réseau ne vide rien", () => {
  it("signature : message « Connexion perdue », cases et nom tapé conservés", async () => {
    h.signerAction.mockRejectedValue(new Error("Failed to fetch"));
    rendre(dossier(), 4);
    for (const c of screen.getAllByRole("checkbox")) fireEvent.click(c);
    const nom = screen.getByLabelText(TEXTES.nomTape) as HTMLInputElement;
    fireEvent.change(nom, { target: { value: "Éloïse Lefèvre" } });
    fireEvent.click(screen.getByRole("button", { name: TEXTES.signer }));
    expect(await screen.findByText(TEXTES.connexionPerdue)).toBeTruthy();
    expect(TEXTES.connexionPerdue).toContain("vos réponses sont conservées sur cet écran");
    expect(nom.value).toBe("Éloïse Lefèvre");
    const cochees = screen.getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked);
    expect(cochees).toHaveLength(CLES_DECLARATIONS.length + CLES_ACCEPTATIONS.length);
    // Toujours à l'étape 4, bouton de nouveau utilisable pour réessayer.
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: TEXTES.signer }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });

  it("enregistrement de l'activité : message, IBAN tapé conservé", async () => {
    h.enregistrerActiviteAction.mockRejectedValue(new Error("Failed to fetch"));
    rendre(dossier({ ibanSaisi: false, ibanMasque: null }), 2);
    const iban = screen.getByLabelText(TEXTES.iban) as HTMLInputElement;
    fireEvent.change(iban, { target: { value: "FR7630006000011234567890189" } });
    fireEvent.click(screen.getByRole("button", { name: TEXTES.continuer }));
    expect(await screen.findByText(TEXTES.connexionPerdue)).toBeTruthy();
    expect(iban.value).toBe("FR7630006000011234567890189");
  });

  it("dépôt d'une pièce : message, date de délivrance conservée", async () => {
    h.deposerPieceAction.mockRejectedValue(new Error("Failed to fetch"));
    render(
      <ul>
        <DepotPiece
          id={ID}
          jeton={"j".repeat(43)}
          type="vigilance"
          libelle="Attestation"
          aide=""
          piece={null}
          motifLibelle={null}
          avecDate
        />
      </ul>,
    );
    const date = screen.getByLabelText(TEXTES.dateDelivrance) as HTMLInputElement;
    fireEvent.change(date, { target: { value: "2026-10-01" } });
    const fichier = screen.getByLabelText("Attestation : choisir un fichier");
    fireEvent.change(fichier, {
      target: { files: [new File(["%PDF"], "a.pdf", { type: "application/pdf" })] },
    });
    expect(await screen.findByText(TEXTES.connexionPerdue)).toBeTruthy();
    expect(date.value).toBe("2026-10-01");
  });
});

describe("D2 / D18 : étape 1", () => {
  it("nom d'un seul mot : le champ « Nom » est modifiable et « Continuer » attend sa saisie", () => {
    rendre(dossier({ nom: "" }), 1);
    const suite = screen.getByRole("button", { name: TEXTES.continuer }) as HTMLButtonElement;
    expect(suite.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(TEXTES.nom), { target: { value: "Ciccone" } });
    expect(suite.disabled).toBe(false);
  });

  it("nom connu : lecture seule, pas de champ nom", () => {
    rendre(dossier(), 1);
    expect(screen.queryByLabelText(TEXTES.nom)).toBeNull();
    expect(
      (screen.getByRole("button", { name: TEXTES.continuer }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("« Écrivez-nous » porte l'adresse de contact", () => {
    rendre(dossier(), 1);
    const lien = screen.getByRole("link", { name: "contact@axion-ia.com" });
    expect(lien.getAttribute("href")).toBe("mailto:contact@axion-ia.com");
  });

  it("le nom saisi part avec l'enregistrement de l'étape 2", async () => {
    h.enregistrerActiviteAction.mockResolvedValue({ ok: true });
    h.enregistrerCoordonneesAction.mockResolvedValue({ ok: true });
    rendre(dossier({ nom: "" }), 1);
    fireEvent.change(screen.getByLabelText(TEXTES.nom), { target: { value: "Ciccone" } });
    fireEvent.click(screen.getByRole("button", { name: TEXTES.continuer }));
    // 07/10 : l'étape 1 enregistre d'abord le nom et le téléphone, puis passe à l'étape 2.
    await waitFor(() => expect(h.enregistrerCoordonneesAction).toHaveBeenCalled());
    await screen.findByLabelText(TEXTES.siren);
    // Étape 2 : SIREN déjà enregistré, statut et TVA remplis : « Continuer » est actif.
    const suite = await screen.findByRole("button", { name: TEXTES.continuer });
    await waitFor(() => expect((suite as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(suite);
    await waitFor(() => expect(h.enregistrerActiviteAction).toHaveBeenCalled());
    const fd = h.enregistrerActiviteAction.mock.calls[0]![0] as FormData;
    expect(fd.get("nom")).toBe("Ciccone");
  });
});

describe("D19 : changement d'étape annoncé et focalisé", () => {
  it("zone `status` polie + titre d'étape focalisable qui prend le focus", async () => {
    rendre(dossier(), 3);
    const annonce = screen.getByRole("status");
    expect(annonce.getAttribute("aria-live")).toBe("polite");
    expect(annonce.textContent).toBe(TEXTES.etapeAnnonce(3, "Vos documents"));
    fireEvent.click(screen.getByRole("button", { name: TEXTES.continuer }));
    const titre = await screen.findByRole("heading", { level: 1, name: TEXTES.contratTitre });
    expect(titre.getAttribute("tabindex")).toBe("-1");
    await waitFor(() => expect(document.activeElement).toBe(titre));
    expect(screen.getByRole("status").textContent).toBe(TEXTES.etapeAnnonce(4, "Votre contrat"));
  });
});
