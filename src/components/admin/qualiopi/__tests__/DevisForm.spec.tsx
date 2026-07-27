/**
 * F3 — « choisir une offre du catalogue » doit renseigner le PRIX et l'INTITULÉ.
 *
 * Aucun test n'existait sur ce formulaire : c'est exactement pour cela que le
 * <select> a pu vivre en production avec un `onChange` qui n'écrivait que
 * l'identifiant de l'offre, laissant le PU HT à 0. Les cas ci-dessous décrivent
 * ce que voit l'admin, jamais l'implémentation.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const createDevisActionMock = vi.fn();
const pushMock = vi.fn();

vi.mock("@/server/actions/qualiopi/devis", () => ({
  createDevisAction: (...args: unknown[]) => createDevisActionMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), replace: vi.fn() }),
}));

import { DevisForm, type ClientOption, type OffreOption } from "../DevisForm";

const CLIENT_ID = "11111111-1111-1111-1111-111111111111";

const CLIENTS: ClientOption[] = [{ id: CLIENT_ID, numero: "AXI-CLI-001", raisonSociale: "ACME" }];

const OFFRES: OffreOption[] = [
  {
    // Catalogue V2 : `tier_id` NULL en base (21 des 26 offres actives).
    tierId: null,
    code: "AXI-OFF-205",
    titreFr: "IA pour les RH",
    prixLabelFr: "1 900 € HT",
    prixHtCents: 190000,
    noteDevisFr: "2 à 15 participants — prix par GROUPE, laisser Qté = 1.",
  },
  {
    // Offre « sur devis » : aucun montant ferme dérivable.
    tierId: null,
    code: "AXI-OFF-115",
    titreFr: "Séminaire IA",
    prixLabelFr: "Sur devis",
    prixHtCents: null,
    noteDevisFr: "Aucun prix ferme dérivable — saisissez le PU HT à la main.",
  },
  {
    // Offre legacy : vrai tier pricing.ts, prix PAR PERSONNE.
    tierId: "intervention-dirigeants",
    code: "AXI-OFF-006",
    titreFr: "Dirigeants",
    prixLabelFr: "1 390 € HT",
    prixHtCents: 139000,
    noteDevisFr: "1 dirigeant (1-to-1) — frais de déplacement EN SUS.",
  },
];

function monter() {
  render(<DevisForm clients={CLIENTS} offres={OFFRES} basePath="/fr/adm/qualiopi/devis" />);
  return {
    client: screen.getByLabelText(/^Client/) as HTMLSelectElement,
    designation: screen.getByLabelText(/Désignation/) as HTMLInputElement,
    offre: screen.getByLabelText(/Offre catalogue/) as HTMLSelectElement,
    prix: screen.getByLabelText(/PU HT/) as HTMLInputElement,
    submit: screen.getByRole("button", { name: /Créer le devis/ }),
  };
}

beforeEach(() => {
  createDevisActionMock.mockReset();
  createDevisActionMock.mockResolvedValue({ data: { id: "d1", numero: "AXI-DEV-2026-003" } });
  pushMock.mockReset();
});

describe("DevisForm — offre catalogue → intitulé + prix", () => {
  it("renseigne l'intitulé ET le PU HT sur une ligne vierge", () => {
    const f = monter();
    fireEvent.change(f.offre, { target: { value: "AXI-OFF-205" } });
    expect(f.designation.value).toBe("IA pour les RH");
    expect(f.prix.value).toBe("1900");
  });

  it("ne remplace jamais une désignation saisie à la main", () => {
    const f = monter();
    fireEvent.change(f.designation, { target: { value: "Formation sur mesure client X" } });
    fireEvent.change(f.offre, { target: { value: "AXI-OFF-205" } });
    expect(f.designation.value).toBe("Formation sur mesure client X");
  });

  it("remplace en revanche la désignation héritée de l'offre PRÉCÉDENTE", () => {
    const f = monter();
    fireEvent.change(f.offre, { target: { value: "AXI-OFF-205" } });
    fireEvent.change(f.offre, { target: { value: "AXI-OFF-006" } });
    expect(f.designation.value).toBe("Dirigeants");
    expect(f.prix.value).toBe("1390");
  });

  it("offre sans prix ferme : ne recolle pas 0 sur un chiffrage existant, et le dit", () => {
    const f = monter();
    fireEvent.change(f.prix, { target: { value: "2500" } });
    fireEvent.change(f.offre, { target: { value: "AXI-OFF-115" } });
    expect(f.prix.value).toBe("2500");
    expect(screen.getByText(/Aucun prix ferme dérivable/)).toBeTruthy();
  });

  it("affiche la note DÉRIVÉE de l'offre, jamais une phrase en dur", () => {
    const f = monter();
    fireEvent.change(f.offre, { target: { value: "AXI-OFF-006" } });
    expect(screen.getByText(/1 dirigeant \(1-to-1\)/)).toBeTruthy();
    fireEvent.change(f.offre, { target: { value: "AXI-OFF-205" } });
    expect(screen.getByText(/prix par GROUPE/)).toBeTruthy();
  });
});

describe("DevisForm — ce qui part au serveur", () => {
  it("catalogue V2 : `offreCode` seul, jamais un code rangé dans `offreTierId`", async () => {
    const f = monter();
    fireEvent.change(f.client, { target: { value: CLIENT_ID } });
    fireEvent.change(f.offre, { target: { value: "AXI-OFF-205" } });
    fireEvent.click(f.submit);
    await waitFor(() => expect(createDevisActionMock).toHaveBeenCalledTimes(1));
    const ligne = createDevisActionMock.mock.calls[0]![0]!.lignes[0];
    expect(ligne.offreCode).toBe("AXI-OFF-205");
    expect(ligne).not.toHaveProperty("offreTierId");
    expect(ligne.prixUnitaireHtCents).toBe(190000);
  });

  it("offre legacy : les DEUX références", async () => {
    const f = monter();
    fireEvent.change(f.client, { target: { value: CLIENT_ID } });
    fireEvent.change(f.offre, { target: { value: "AXI-OFF-006" } });
    fireEvent.click(f.submit);
    await waitFor(() => expect(createDevisActionMock).toHaveBeenCalledTimes(1));
    const ligne = createDevisActionMock.mock.calls[0]![0]!.lignes[0];
    expect(ligne.offreCode).toBe("AXI-OFF-006");
    expect(ligne.offreTierId).toBe("intervention-dirigeants");
  });

  it("« — Aucune — » relâche les deux références sans effacer le chiffrage", async () => {
    const f = monter();
    fireEvent.change(f.client, { target: { value: CLIENT_ID } });
    fireEvent.change(f.offre, { target: { value: "AXI-OFF-205" } });
    fireEvent.change(f.offre, { target: { value: "" } });
    expect(f.prix.value).toBe("1900");
    fireEvent.click(f.submit);
    await waitFor(() => expect(createDevisActionMock).toHaveBeenCalledTimes(1));
    const ligne = createDevisActionMock.mock.calls[0]![0]!.lignes[0];
    expect(ligne).not.toHaveProperty("offreCode");
    expect(ligne).not.toHaveProperty("offreTierId");
  });

  it("ne transmet aucun taux de TVA : il se dérive du régime, côté serveur", async () => {
    const f = monter();
    fireEvent.change(f.client, { target: { value: CLIENT_ID } });
    fireEvent.change(f.offre, { target: { value: "AXI-OFF-205" } });
    fireEvent.click(f.submit);
    await waitFor(() => expect(createDevisActionMock).toHaveBeenCalledTimes(1));
    expect(createDevisActionMock.mock.calls[0]![0]!.lignes[0]).not.toHaveProperty("tauxTvaPercent");
  });

  it("refuse un devis dont le TOTAL est nul et n'appelle pas l'action", () => {
    const f = monter();
    fireEvent.change(f.client, { target: { value: CLIENT_ID } });
    fireEvent.change(f.designation, { target: { value: "Séminaire à chiffrer" } });
    fireEvent.change(f.offre, { target: { value: "AXI-OFF-115" } });
    fireEvent.click(f.submit);
    expect(screen.getByRole("alert").textContent).toContain("0,00");
    expect(createDevisActionMock).not.toHaveBeenCalled();
  });
});
