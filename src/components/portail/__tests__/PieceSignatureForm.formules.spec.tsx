/**
 * Lot 4 — devis À FORMULES : le client choisit sa formule, ses options et sa durée AVANT de
 * signer ; le récapitulatif est calculé par le serveur ; la case des CGV reste obligatoire et
 * distincte ; le navigateur n'envoie que des choix, jamais un prix.
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PieceSignatureForm } from "../PieceSignatureForm";
import type { OffreAffichee } from "../PieceSignatureForm";

vi.mock("@/components/portail/SignaturePad", () => ({
  SignaturePad: (p: { onBasculerAccessible: () => void; onChange: (v: string | null) => void }) => (
    <div>
      <button type="button" onClick={() => p.onBasculerAccessible()}>
        mode-accessible
      </button>
    </div>
  ),
}));

const MENTIONS = ["J'accepte le devis n° AXI-DEV-2026-001.", "Valeur juridique.", "RGPD."];
const CGV = {
  version: "2026-10-04",
  libelle: "4 octobre 2026",
  href: "/fr/conditions-generales",
  pdfHref: "/api/cgv?dl=1",
};
/** Offre affichée, telle que le serveur la formate (montants FICTIFS, aucun import du domaine). */
function offreAffichee(over: Partial<OffreAffichee> = {}): OffreAffichee {
  return {
    formules: [
      {
        formule: "achat",
        libelle: "Formule A · Achat",
        baseHtLisible: "1 200,00 €",
        baseTtcLisible: "1 450,00 €",
        lignes: [{ libelle: "Ligne A", quantite: 1, prixLisible: "1 000,00 € HT" }],
        maintenance: {
          regle: "facultative",
          mensuelLisible: "40,00 € HT / mois",
          periodes: [
            { mois: 1, libelle: "1 mois d'avance : 40,00 € HT / mois" },
            { mois: 12, libelle: "12 mois (1 an) d'avance : 40,00 € HT / mois" },
          ],
        },
        abonnement: null,
      },
      {
        formule: "abonnement",
        libelle: "Formule B · Mise en place + abonnement",
        baseHtLisible: "300,00 €",
        baseTtcLisible: "360,00 €",
        lignes: [{ libelle: "Mise en service", quantite: 1, prixLisible: "300,00 € HT" }],
        maintenance: null,
        abonnement: {
          mensuelLisible: "90,00 € HT / mois",
          engagementMois: 12,
          periodes: [{ mois: 1, libelle: "1 mois d'avance : 90,00 € HT / mois" }],
        },
      },
    ],
    automatisations: [
      {
        code: "auto1",
        libelle: "Automatisation un",
        facultative: true,
        dependDe: [],
        dependDeLibelles: [],
        prixHtLisible: "50,00 € HT",
      },
    ],
    ...over,
  };
}

const RECAP = {
  formuleLibelle: "Formule B · Mise en place + abonnement",
  automatisations: [],
  totalPonctuelHtLisible: "300,00 €",
  totalPonctuelTtcLisible: "360,00 €",
  recurrent: ["Abonnement : 90,00 € HT / mois, payé 1 mois d'avance"],
};

function monter(
  opts: {
    offre?: OffreAffichee;
    apercu?: ReturnType<typeof vi.fn>;
    signer?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const apercuAction =
    opts.apercu ?? vi.fn().mockResolvedValue({ ok: true as const, recap: RECAP });
  const signerAction =
    opts.signer ??
    vi.fn().mockResolvedValue({ ok: true, signatureId: "s", statutSignature: "partielle" });
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
      cgv={CGV}
      formules={{ offre: opts.offre ?? offreAffichee(), apercuAction }}
      signerAction={signerAction}
    />,
  );
  return { apercuAction, signerAction };
}

const bouton = () => screen.getByRole("button", { name: /^signer devis$/i }) as HTMLButtonElement;

function cocherLeReste() {
  fireEvent.click(screen.getByText("mode-accessible"));
  fireEvent.click(screen.getByRole("checkbox", { name: /J'accepte le devis/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /conditions générales de vente/i }));
}

describe("devis à formules — le choix", () => {
  it("propose les deux formules sous leurs noms, sans prix saisissable", () => {
    monter();
    expect(screen.getByText("Formule A · Achat")).toBeTruthy();
    expect(screen.getByText("Formule B · Mise en place + abonnement")).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(document.body.textContent).not.toMatch(/token|jeton/i);
  });

  it("🔴 le bouton reste inactif sans choix, même attestation et CGV cochées", () => {
    monter();
    cocherLeReste();
    expect(bouton().disabled).toBe(true);
    expect(screen.getByText(/choisissez votre formule/i, { selector: "p.text-xs" })).toBeTruthy();
  });

  it("formule B + durée : demande le récapitulatif au serveur, puis le bouton s'active", async () => {
    const { apercuAction } = monter();
    fireEvent.click(screen.getByRole("radio", { name: /Formule B/ }));
    cocherLeReste();
    expect(bouton().disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /1 mois d'avance/ }));
    await waitFor(() => expect(apercuAction).toHaveBeenCalled());
    expect(apercuAction).toHaveBeenCalledWith({
      token: "tok",
      choix: {
        formule: "abonnement",
        automatisationsRetenues: [],
        maintenanceRetenue: null,
        periodiciteMois: 1,
      },
    });
    await screen.findByText(/Récapitulatif de ce que vous signez/);
    expect(screen.getByText(/soit 360,00 € TTC/)).toBeTruthy();
    await waitFor(() => expect(bouton().disabled).toBe(false));
  });

  it("changer de choix invalide le récapitulatif : on ne signe pas un autre choix que celui affiché", async () => {
    const base = offreAffichee();
    const offre = offreAffichee({
      formules: base.formules.map((f) =>
        f.abonnement === null
          ? f
          : {
              ...f,
              abonnement: {
                ...f.abonnement,
                periodes: [
                  ...f.abonnement.periodes,
                  { mois: 6, libelle: "6 mois d'avance : 85,50 € HT / mois — remise de 5 %" },
                ],
              },
            },
      ),
    });
    let resolve!: (v: unknown) => void;
    const apercu = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, recap: RECAP })
      .mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    monter({ offre, apercu });
    fireEvent.click(screen.getByRole("radio", { name: /Formule B/ }));
    cocherLeReste();
    fireEvent.click(screen.getByRole("radio", { name: /1 mois d'avance/ }));
    await waitFor(() => expect(bouton().disabled).toBe(false));
    fireEvent.click(screen.getByRole("radio", { name: /6 mois d'avance/ }));
    // Le récapitulatif du nouveau choix n'est pas encore là : signature impossible.
    expect(bouton().disabled).toBe(true);
    resolve({ ok: true, recap: { ...RECAP, recurrent: ["Abonnement 6 mois"] } });
    await waitFor(() => expect(bouton().disabled).toBe(false));
  });

  it("une erreur du serveur sur le choix s'affiche et empêche de signer", async () => {
    const apercu = vi.fn().mockResolvedValue({ ok: false, message: "Choix refusé." });
    monter({ apercu });
    fireEvent.click(screen.getByRole("radio", { name: /Formule B/ }));
    cocherLeReste();
    fireEvent.click(screen.getByRole("radio", { name: /1 mois d'avance/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Choix refusé.");
    expect(bouton().disabled).toBe(true);
  });

  it("formule A, maintenance facultative : une réponse explicite est exigée", async () => {
    const { apercuAction } = monter();
    fireEvent.click(screen.getByRole("radio", { name: /Formule A/ }));
    cocherLeReste();
    expect(apercuAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: /ne souscris pas la maintenance/i }));
    await waitFor(() => expect(apercuAction).toHaveBeenCalled());
    expect(apercuAction).toHaveBeenCalledWith({
      token: "tok",
      choix: {
        formule: "achat",
        automatisationsRetenues: [],
        maintenanceRetenue: false,
        periodiciteMois: null,
      },
    });
  });

  it("formule A, maintenance OBLIGATOIRE : incluse d'office, aucune case à décocher", async () => {
    const base = offreAffichee();
    const offre = offreAffichee({
      formules: base.formules.map((f) =>
        f.maintenance === null
          ? f
          : { ...f, maintenance: { ...f.maintenance, regle: "obligatoire" } },
      ),
    });
    const { apercuAction } = monter({ offre });
    fireEvent.click(screen.getByRole("radio", { name: /Formule A/ }));
    expect(screen.getByText(/maintenance est incluse/i)).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /ne souscris pas/i })).toBeNull();
    // Reste la durée à choisir.
    fireEvent.click(screen.getByRole("radio", { name: /12 mois \(1 an\) d'avance/ }));
    await waitFor(() => expect(apercuAction).toHaveBeenCalled());
    expect(apercuAction.mock.calls[0]?.[0].choix).toMatchObject({
      formule: "achat",
      maintenanceRetenue: true,
      periodiciteMois: 12,
    });
  });

  it("automatisation dépendante : la cocher coche ce dont elle dépend ; décocher la base décoche la dépendante", () => {
    const base = offreAffichee();
    const offre = offreAffichee({
      automatisations: [
        ...base.automatisations,
        {
          code: "auto2",
          libelle: "Automatisation deux",
          facultative: true,
          dependDe: ["auto1"],
          dependDeLibelles: ["Automatisation un"],
          prixHtLisible: "1,00 € HT",
        },
      ],
    });
    monter({ offre });
    fireEvent.click(screen.getByRole("radio", { name: /Formule B/ }));
    const deux = screen.getByRole("checkbox", { name: /Automatisation deux/ }) as HTMLInputElement;
    const un = screen.getByRole("checkbox", { name: /^Automatisation un — / }) as HTMLInputElement;
    expect(un.checked).toBe(false);
    fireEvent.click(deux);
    expect(deux.checked).toBe(true);
    expect(un.checked).toBe(true);
    fireEvent.click(un);
    expect(un.checked).toBe(false);
    expect(deux.checked).toBe(false);
  });
});

describe("devis à formules — la signature", () => {
  async function pret() {
    const m = monter();
    fireEvent.click(screen.getByRole("radio", { name: /Formule B/ }));
    cocherLeReste();
    fireEvent.click(screen.getByRole("radio", { name: /1 mois d'avance/ }));
    await waitFor(() => expect(bouton().disabled).toBe(false));
    return m;
  }

  it("envoie le choix (et seulement des choix) avec les CGV, jamais un prix", async () => {
    const { signerAction } = await pret();
    fireEvent.click(bouton());
    await waitFor(() => expect(signerAction).toHaveBeenCalled());
    const arg = signerAction.mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      token: "tok",
      cgvAcceptees: true,
      cgvVersionAffichee: "2026-10-04",
      choix: {
        formule: "abonnement",
        automatisationsRetenues: [],
        maintenanceRetenue: null,
        periodiciteMois: 1,
      },
    });
    expect(JSON.stringify(arg)).not.toMatch(/prix|remise|montant/i);
  });

  it("🔴 double clic : une seule signature envoyée", async () => {
    let fin!: (v: unknown) => void;
    const signer = vi.fn(() => new Promise((r) => (fin = r)));
    monter({ signer });
    fireEvent.click(screen.getByRole("radio", { name: /Formule B/ }));
    cocherLeReste();
    fireEvent.click(screen.getByRole("radio", { name: /1 mois d'avance/ }));
    await waitFor(() => expect(bouton().disabled).toBe(false));
    const b = bouton();
    fireEvent.click(b);
    fireEvent.click(b);
    fireEvent.click(b);
    expect(signer).toHaveBeenCalledTimes(1);
    fin({ ok: true, signatureId: "s", statutSignature: "partielle" });
  });

  it("après la signature : le choix est enregistré, le contrat n'est formé qu'à la contresignature", async () => {
    const { signerAction } = await pret();
    fireEvent.click(bouton());
    await screen.findByText(/Votre signature est enregistrée/);
    expect(signerAction).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/formé lorsque Axion-IA contresigne/)).toBeTruthy();
  });

  it("la case des CGV reste obligatoire : sans elle, aucune signature", async () => {
    monter();
    fireEvent.click(screen.getByRole("radio", { name: /Formule B/ }));
    fireEvent.click(screen.getByText("mode-accessible"));
    fireEvent.click(screen.getByRole("checkbox", { name: /J'accepte le devis/ }));
    fireEvent.click(screen.getByRole("radio", { name: /1 mois d'avance/ }));
    await screen.findByText(/Récapitulatif de ce que vous signez/);
    expect(bouton().disabled).toBe(true);
  });
});
