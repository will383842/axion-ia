/**
 * DevisForm en mode ÉDITION (écran `/corriger`) : appelle l'action de modification avec
 * `attenduMajLe`, jamais `createDevisAction` ; client verrouillé ; mode formules masqué.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const creer = vi.fn();
const modifier = vi.fn();
const push = vi.fn();

vi.mock("@/server/actions/qualiopi/devis-formules", () => ({ creerDevisFormulesAction: vi.fn() }));
vi.mock("@/server/actions/qualiopi/devis", () => ({
  createDevisAction: (...a: unknown[]) => creer(...a),
  lireBandeauAttributionAction: async () => null,
}));
vi.mock("@/server/actions/qualiopi/devis-classique-modifier", () => ({
  modifierDevisClassiqueBrouillonAction: (...a: unknown[]) => modifier(...a),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
}));

import { DevisForm } from "../DevisForm";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const DEVIS_ID = "22222222-2222-4222-8222-222222222222";
const MAJ = "2026-11-01T10:00:00.000Z";

const edition = {
  conditionsParticulieres: null,
  devisId: DEVIS_ID,
  attenduMajLe: MAJ,
  lignes: [
    {
      designation: "Atelier",
      quantite: "2",
      prixUnitaireHtCents: "100000",
      offreTierId: "",
      offreCode: "AXI-OFF-205",
      designationDepuisOffre: false,
    },
  ],
  activite: "formation" as const,
  refClient: "BC-12" as string | null,
};

function monter() {
  return render(
    <DevisForm
      clients={[{ id: CLIENT_ID, numero: "AXI-CLI-001", raisonSociale: "ACME" }]}
      offres={[]}
      activites={[{ value: "formation", label: "Formation" }]}
      basePath="/fr/adm/qualiopi/devis"
      defaultClientId={CLIENT_ID}
      formules={{ textes: [], tvaStandardPct: 20 }}
      edition={edition}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  modifier.mockResolvedValue({ data: { id: DEVIS_ID, majLe: MAJ } });
});

describe("DevisForm — édition", () => {
  it("client verrouillé (affiché, non modifiable) et mode formules masqué", () => {
    monter();
    expect(screen.getByTestId("client-verrouille").textContent).toContain("ACME");
    expect(screen.queryByLabelText(/Client/, { selector: "select" })).toBeNull();
    expect(screen.queryByText(/Devis à formules/)).toBeNull();
  });

  it("enregistrer : action de modification avec attenduMajLe et refClient, jamais la création", async () => {
    monter();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    await waitFor(() => expect(modifier).toHaveBeenCalledTimes(1));
    expect(modifier).toHaveBeenCalledWith({
      id: DEVIS_ID,
      attenduMajLe: MAJ,
      input: {
        clientId: CLIENT_ID,
        lignes: [
          {
            designation: "Atelier",
            quantite: 2,
            prixUnitaireHtCents: 100000,
            offreCode: "AXI-OFF-205",
          },
        ],
        activite: "formation",
        refClient: "BC-12",
      },
    });
    expect(creer).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/fr/adm/qualiopi/devis/${DEVIS_ID}`));
  });

  it("refus (version périmée) : message affiché tel quel, pas de navigation", async () => {
    modifier.mockResolvedValue({ error: "Ce brouillon a été modifié ailleurs : rechargez." });
    monter();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    await screen.findByText("Ce brouillon a été modifié ailleurs : rechargez.");
    expect(push).not.toHaveBeenCalled();
    expect(creer).not.toHaveBeenCalled();
  });

  it("sans refClient stocké : la clé n'est pas envoyée", async () => {
    render(
      <DevisForm
        clients={[{ id: CLIENT_ID, numero: "AXI-CLI-001", raisonSociale: "ACME" }]}
        offres={[]}
        activites={[{ value: "formation", label: "Formation" }]}
        basePath="/b"
        edition={{ ...edition, refClient: null }}
        defaultClientId={CLIENT_ID}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    await waitFor(() => expect(modifier).toHaveBeenCalled());
    expect("refClient" in modifier.mock.calls[0]![0].input).toBe(false);
  });
});
