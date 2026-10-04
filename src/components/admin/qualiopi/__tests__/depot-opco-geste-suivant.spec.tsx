/**
 * Lot OPCO A7b — encart de dépôt de la page Financement : bouton « Ouvrir le
 * dossier OPCO » (portail de la fiche OPCO, nouvel onglet, `noopener`) et
 * saisie de l'accord écrit au même endroit que le dépôt ; estimation au barème
 * en lecture seule, avec son avertissement.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
const a = vi.hoisted(() => ({ accord: vi.fn(), envoyer: vi.fn(), arreter: vi.fn() }));
vi.mock("@/server/actions/qualiopi/documents", () => ({
  genererDossierPretADeposerAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/facturation-hub", () => ({
  enregistrerDepotDossierAction: vi.fn(),
  enregistrerAccordEcritAction: (...x: unknown[]) => a.accord(...x),
}));
// Lot A8 — module `"use server"` tiré par le panneau (garde admin, Prisma) : un
// mock de ses TROIS exports, tous ceux que le panneau importe.
vi.mock("@/server/actions/qualiopi/suivi-entreprise-opco", () => ({
  envoyerDossierEntrepriseAction: (...x: unknown[]) => a.envoyer(...x),
  arreterRelancesEntrepriseAction: (...x: unknown[]) => a.arreter(...x),
  lienAccordEntrepriseAction: vi.fn(),
}));

import { DepotOpcoPanel, type DepotOpcoPanelProps } from "../DepotOpcoPanel";
import { EstimationBaremeOpco } from "../EstimationBaremeOpco";
import { OPCO_FICHES } from "@/server/qualiopi/financements/opco-referentiel";

const DOSSIER = "44444444-4444-4444-8444-444444444444";
const PORTAIL = OPCO_FICHES.opcommerce.portailEntrepriseUrl.valeur!;

function props(p: Partial<DepotOpcoPanelProps> = {}): DepotOpcoPanelProps {
  return {
    sessionId: "s1",
    dossierId: DOSSIER,
    depotFaitLe: null,
    numeroDossierExterne: null,
    accordEcritLe: null,
    encart: {
      titre: "Comment déposer chez OPCOMMERCE",
      qui: "Dépôt par l'entreprise",
      portail: PORTAIL,
      portailUrl: PORTAIL,
      delai: "non renseigné",
      dateLimite: "non renseigné",
      regime: "à confirmer sur l'accord",
      etatFonds: null,
    },
    pieces: [],
    ...p,
  };
}

beforeEach(() => {
  a.accord.mockReset();
  a.accord.mockResolvedValue({ data: { dossierId: DOSSIER } });
  a.envoyer.mockReset();
  a.envoyer.mockResolvedValue({ data: { garePourValidation: false } });
  a.arreter.mockReset();
  a.arreter.mockResolvedValue({ data: { dossierId: DOSSIER } });
});
afterEach(cleanup);

describe("DepotOpcoPanel — geste suivant", () => {
  it("« Ouvrir le dossier OPCO » mène au portail de la fiche OPCO, nouvel onglet, noopener", () => {
    render(<DepotOpcoPanel {...props()} />);
    const lien = screen.getByRole("link", { name: /Ouvrir le dossier OPCO/ });
    expect(lien.getAttribute("href")).toBe(PORTAIL);
    expect(lien.getAttribute("target")).toBe("_blank");
    expect(lien.getAttribute("rel") ?? "").toContain("noopener");
  });

  it("portail non relevé : pas de lien inventé", () => {
    render(
      <DepotOpcoPanel
        {...props({ encart: { ...props().encart, portail: "non renseigné", portailUrl: null } })}
      />,
    );
    expect(screen.queryByRole("link", { name: /Ouvrir le dossier OPCO/ })).toBeNull();
  });

  it("la date de l'accord écrit se saisit ici et part à l'action", async () => {
    render(<DepotOpcoPanel {...props()} />);
    fireEvent.change(screen.getByLabelText("Accord écrit le"), {
      target: { value: "2026-10-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer l'accord" }));
    await waitFor(() => expect(a.accord).toHaveBeenCalledTimes(1));
    expect(a.accord).toHaveBeenCalledWith({ dossierId: DOSSIER, accordEcritLe: "2026-10-02" });
  });

  it("accord déjà daté : la date est pré-remplie", () => {
    render(<DepotOpcoPanel {...props({ accordEcritLe: "2026-09-30" })} />);
    expect((screen.getByLabelText("Accord écrit le") as HTMLInputElement).value).toBe("2026-09-30");
  });

  it("lecture seule : ni saisie du dépôt ni de l'accord, le lien reste", () => {
    render(<DepotOpcoPanel {...props({ peutEcrire: false })} />);
    expect(screen.queryByLabelText("Accord écrit le")).toBeNull();
    expect(screen.queryByLabelText("Dépôt fait le")).toBeNull();
    expect(screen.getByRole("link", { name: /Ouvrir le dossier OPCO/ })).toBeTruthy();
  });
});

describe("DepotOpcoPanel — envoi à l'entreprise (lot A8)", () => {
  const FRISE = {
    envoyeLe: "2026-10-01",
    envoiAutomatique: true,
    evenements: [
      { jour: "2026-10-01", libelle: "Dossier envoyé" },
      { jour: "2026-10-05", libelle: "Relance dépôt n° 1" },
      { jour: "2026-10-05", libelle: "Réponse de l'entreprise : pas encore" },
    ],
    relancesFaites: 1,
    prochaineRelance: { jour: "2026-10-08", libelle: "relance dépôt n° 2" },
    relancesArreteesLe: null,
    accordFichierDepose: false,
  };

  it("« Envoyer le dossier à l'entreprise » part à l'action", async () => {
    render(<DepotOpcoPanel {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le dossier à l'entreprise" }));
    await waitFor(() => expect(a.envoyer).toHaveBeenCalledWith({ dossierId: DOSSIER }));
    expect(await screen.findByText("Dossier envoyé à l'entreprise.")).toBeTruthy();
  });

  it("frise : envoi, relances, réponses, prochaine relance ; « Arrêter les relances »", async () => {
    render(<DepotOpcoPanel {...props({ suiviEntreprise: FRISE })} />);
    expect(screen.getByText(/Envoyé le 01\/10\/2026 \(automatiquement\) · 1 relance/)).toBeTruthy();
    expect(screen.getByText("05/10/2026 — Réponse de l'entreprise : pas encore")).toBeTruthy();
    expect(screen.getByText(/Prochaine relance : 08\/10\/2026/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Arrêter les relances" }));
    await waitFor(() => expect(a.arreter).toHaveBeenCalledWith({ dossierId: DOSSIER }));
  });

  it("relances arrêtées : plus de bouton d'arrêt ; lecture seule : aucun bouton", () => {
    render(
      <DepotOpcoPanel
        {...props({ suiviEntreprise: { ...FRISE, relancesArreteesLe: "2026-10-06" } })}
      />,
    );
    expect(screen.getByText("Relances arrêtées le 06/10/2026.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Arrêter les relances" })).toBeNull();
    cleanup();
    render(<DepotOpcoPanel {...props({ peutEcrire: false, suiviEntreprise: FRISE })} />);
    expect(screen.queryByRole("button", { name: /dossier à l'entreprise/ })).toBeNull();
  });
});

describe("EstimationBaremeOpco — lecture seule", () => {
  it("montant, reste à charge et mention d'estimation indicative", () => {
    const html = renderToStaticMarkup(
      <EstimationBaremeOpco
        estimation={{
          montantPriseEnChargeCents: 120_000,
          resteAChargeCents: 30_000,
          origine: "bareme",
        }}
      />,
    );
    expect(html).toMatch(/1\s200\s€/);
    expect(html).toMatch(/300\s€/);
    expect(html).toContain("Estimation indicative");
    expect(html).not.toContain("<input");
  });

  it("sans barème : l'avertissement de l'estimation est affiché", () => {
    const html = renderToStaticMarkup(
      <EstimationBaremeOpco
        estimation={{
          montantPriseEnChargeCents: 0,
          resteAChargeCents: 0,
          origine: "reglage_par_defaut",
          avertissement: "Aucun barème relevé pour cet OPCO.",
        }}
      />,
    );
    expect(html).toContain("Aucun barème relevé pour cet OPCO.");
  });

  it("aucune estimation : rien", () => {
    expect(renderToStaticMarkup(<EstimationBaremeOpco estimation={null} />)).toBe("");
  });
});
