// Dossier public, côté navigateur : la coupure réseau ne perd pas la saisie (D8), le nom
// d'un seul mot se complète à l'étape 1 (D2), « Écrivez-nous » a une adresse (D18), l'étape
// est annoncée et reçoit le focus (D19).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    siret: null,
    denomination: "Ma société",
    adresse: "1 rue des Alpes",
    statutJuridique: "micro_entrepreneur",
    // Contrat 2.7, art. 14 : l'entrepreneur individuel a dit s'il est immatriculé au RCS.
    immatriculeRcs: false,
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
  it("signature : message « Connexion perdue », les deux cases restent cochées", async () => {
    h.signerAction.mockRejectedValue(new Error("Failed to fetch"));
    rendre(dossier(), 4);
    for (const c of screen.getAllByRole("checkbox")) fireEvent.click(c);
    fireEvent.click(screen.getByRole("button", { name: TEXTES.signer }));
    expect(await screen.findByText(TEXTES.connexionPerdue)).toBeTruthy();
    expect(TEXTES.connexionPerdue).toContain("vos réponses sont conservées sur cet écran");
    const cochees = screen.getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked);
    expect(cochees).toHaveLength(2);
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

describe("contrat 2.7, art. 14 : la qualité au dossier", () => {
  it("entrepreneur individuel sans réponse sur le RCS : « Continuer » attend, et le dit", () => {
    rendre(dossier({ immatriculeRcs: null }), 2);
    expect(screen.getByRole("group", { name: TEXTES.rcs })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: TEXTES.continuer }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText(new RegExp(TEXTES.manqueRcs))).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole("group", { name: TEXTES.rcs })).getByLabelText(TEXTES.rcsOui),
    );
    expect(
      (screen.getByRole("button", { name: TEXTES.continuer }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("société : adresse du siège et fonction du signataire demandées, puis envoyées", async () => {
    h.enregistrerActiviteAction.mockResolvedValue({ ok: true });
    rendre(dossier({ statutJuridique: "sas", immatriculeRcs: null }), 2);
    expect(screen.queryByRole("group", { name: TEXTES.rcs })).toBeNull();
    const suite = screen.getByRole("button", { name: TEXTES.continuer }) as HTMLButtonElement;
    expect(suite.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(TEXTES.siege), {
      target: { value: "3 place Grenette, 38000 Grenoble" },
    });
    fireEvent.change(screen.getByLabelText(TEXTES.fonction), { target: { value: "Président" } });
    expect(suite.disabled).toBe(false);
    fireEvent.click(suite);
    await waitFor(() => expect(h.enregistrerActiviteAction).toHaveBeenCalled());
    const fd = h.enregistrerActiviteAction.mock.calls[0]![0] as FormData;
    expect(fd.get("siegeAdresse")).toBe("3 place Grenette, 38000 Grenoble");
    expect(fd.get("fonctionSignataire")).toBe("Président");
    expect(fd.get("immatriculeRcs")).toBeNull();
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

describe("contrat 2.5 : deux cases, nom affiché, PDF dans un nouvel onglet", () => {
  it("deux cases seulement ; le bouton attend les deux ; le serveur reçoit les 10 engagements un par un", async () => {
    h.signerAction.mockResolvedValue({ ok: true });
    rendre(dossier(), 4);
    const cases = screen.getAllByRole("checkbox");
    expect(cases).toHaveLength(2);
    // Le mandat de facturation et la clause des tribunaux restent écrits en clair sous la case.
    expect(document.body.textContent).toContain(
      "Je donne mandat à Axion-IA d'établir mes factures",
    );
    expect(document.body.textContent).toContain(
      "tribunaux du siège d'Axion-IA sont seuls compétents",
    );
    const signer = screen.getByRole("button", { name: TEXTES.signer }) as HTMLButtonElement;
    expect(signer.disabled).toBe(true);
    expect(screen.getByText(TEXTES.cochezLesDeuxCases)).toBeTruthy();
    fireEvent.click(cases[0]!);
    expect(signer.disabled).toBe(true);
    fireEvent.click(cases[1]!);
    expect(signer.disabled).toBe(false);
    fireEvent.click(signer);
    await waitFor(() => expect(h.signerAction).toHaveBeenCalled());
    const fd = h.signerAction.mock.calls[0]![0] as FormData;
    expect(fd.getAll("declarations")).toEqual([...CLES_DECLARATIONS]);
    expect(fd.getAll("acceptations")).toEqual([...CLES_ACCEPTATIONS]);
    // Le nom n'est plus tapé : celui du dossier part dans la preuve.
    expect(fd.get("nomTape")).toBe("Éloïse Lefèvre");
  });

  it("décocher une case la décoche en entier (pas d'acceptation partielle)", () => {
    rendre(dossier(), 4);
    const [certifie] = screen.getAllByRole("checkbox") as HTMLInputElement[];
    fireEvent.click(certifie!);
    expect(certifie!.checked).toBe(true);
    fireEvent.click(certifie!);
    expect(certifie!.checked).toBe(false);
  });

  it("le nom du signataire est affiché ; pour une société, « pour le compte de » sa dénomination", () => {
    rendre(dossier({ statutJuridique: "sas", denomination: "ACME" }), 4);
    expect(screen.getByText("Éloïse Lefèvre")).toBeTruthy();
    expect(screen.getByText(TEXTES.pourLeCompteDe("ACME"))).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    cleanup();
    rendre(dossier(), 4);
    expect(screen.queryByText(TEXTES.pourLeCompteDe("Ma société"))).toBeNull();
  });

  it("le PDF du contrat s'ouvre dans un nouvel onglet", () => {
    rendre(dossier(), 4);
    const lien = screen.getByRole("link", { name: new RegExp(TEXTES.telecharger) });
    expect(lien.getAttribute("target")).toBe("_blank");
    expect(lien.getAttribute("rel")).toContain("noopener");
  });
});

describe("aperçu du fichier envoyé", () => {
  it("photo : une vignette apparaît après l'envoi ; PDF : un lien « Voir » dans un nouvel onglet", async () => {
    URL.createObjectURL = vi.fn(() => "blob:apercu");
    URL.revokeObjectURL = vi.fn();
    h.deposerPieceAction.mockResolvedValue({ ok: true });
    const piece = { statut: "deposee" as const, motif: null, nomFichier: "cni.png" };
    const { rerender } = render(
      <ul>
        <DepotPiece
          id={ID}
          jeton={"j".repeat(43)}
          type="identite"
          libelle="Pièce d'identité"
          aide=""
          piece={null}
          motifLibelle={null}
        />
      </ul>,
    );
    fireEvent.change(screen.getByLabelText("Pièce d'identité : choisir un fichier"), {
      target: { files: [new File(["x"], "cni.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    rerender(
      <ul>
        <DepotPiece
          id={ID}
          jeton={"j".repeat(43)}
          type="identite"
          libelle="Pièce d'identité"
          aide=""
          piece={piece}
          motifLibelle={null}
        />
      </ul>,
    );
    const img = screen.getByAltText(TEXTES.apercuDe("Pièce d'identité")) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("blob:apercu");

    fireEvent.change(screen.getByLabelText("Pièce d'identité : choisir un fichier"), {
      target: { files: [new File(["%PDF"], "cni.pdf", { type: "application/pdf" })] },
    });
    const lien = await screen.findByRole("link", { name: TEXTES.voirLePdf });
    expect(lien.getAttribute("target")).toBe("_blank");
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
