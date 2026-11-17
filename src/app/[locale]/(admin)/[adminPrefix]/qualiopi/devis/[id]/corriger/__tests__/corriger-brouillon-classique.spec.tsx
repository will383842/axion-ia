/**
 * `/qualiopi/devis/[id]/corriger` — REPLI D7 : modification d'un brouillon CLASSIQUE.
 * 404 pour un devis à formules et pour tout statut autre que « brouillon » ; lignes illisibles :
 * message, formulaire non ouvert (jamais d'écrasement).
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ garde: vi.fn(), devis: vi.fn(), formulaire: vi.fn() }));

class Introuvable extends Error {}
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Introuvable("NOT_FOUND");
  },
}));
vi.mock("@/server/auth/garde-page", () => ({ gardePage: m.garde }));
vi.mock("@/lib/prisma", () => ({ prisma: { devis: { findUnique: m.devis } } }));
vi.mock("@/server/qualiopi/offres/offres", () => ({ listOffres: async () => [] }));
vi.mock("@/components/admin/qualiopi/DevisForm", () => ({
  DevisForm: (p: unknown) => {
    m.formulaire(p);
    return <div data-testid="formulaire-devis" />;
  },
}));

import Page from "../page";

const ID = "550e8400-e29b-41d4-a716-446655440002";
const MAJ = new Date("2026-11-01T10:00:00Z");
const params = (id = ID) => ({
  params: Promise.resolve({ locale: "fr" as const, adminPrefix: "adm", id }),
});
const devis = (over: Record<string, unknown> = {}) => ({
  id: ID,
  numero: "AXI-DEV-2026-007",
  statut: "brouillon",
  offre: null,
  offreSha256: null,
  lignes: [{ designation: "Atelier", quantite: 2, prixUnitaireHtCents: 100000 }],
  activite: "formation",
  refClient: "BC-12",
  updatedAt: MAJ,
  client: { id: "c1", numero: "AXI-CLI-001", raisonSociale: "ACME" },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.garde.mockResolvedValue({ autorise: true, role: "admin", peutEcrire: true });
  m.devis.mockResolvedValue(devis());
});

describe("/corriger", () => {
  it("brouillon classique : monte le formulaire en mode édition", async () => {
    render(await Page(params()));
    expect(screen.getByTestId("formulaire-devis")).toBeTruthy();
    expect(m.formulaire.mock.calls[0]![0]).toMatchObject({
      edition: {
        devisId: ID,
        attenduMajLe: MAJ.toISOString(),
        activite: "formation",
        refClient: "BC-12",
        lignes: [
          {
            designation: "Atelier",
            quantite: "2",
            prixUnitaireHtCents: "100000",
            offreTierId: "",
            offreCode: "",
            designationDepuisOffre: false,
          },
        ],
      },
    });
  });

  it("devis à formules : 404", async () => {
    m.devis.mockResolvedValue(devis({ offre: { v: 1 }, offreSha256: "a".repeat(64) }));
    await expect(Page(params())).rejects.toBeInstanceOf(Introuvable);
  });

  it.each(["envoye", "accepte", "refuse", "expire", "transforme_convention"])(
    "statut « %s » : 404",
    async (statut) => {
      m.devis.mockResolvedValue(devis({ statut }));
      await expect(Page(params())).rejects.toBeInstanceOf(Introuvable);
    },
  );

  it("devis inconnu ou identifiant invalide : 404", async () => {
    m.devis.mockResolvedValue(null);
    await expect(Page(params())).rejects.toBeInstanceOf(Introuvable);
    await expect(Page(params("pas-un-uuid"))).rejects.toBeInstanceOf(Introuvable);
  });

  it("lignes illisibles : message, formulaire NON ouvert", async () => {
    m.devis.mockResolvedValue(devis({ lignes: [{ designation: "x", tauxTvaPercent: 20 }] }));
    render(await Page(params()));
    expect(screen.queryByTestId("formulaire-devis")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("ne peuvent pas être relues");
  });

  it("accès refusé : rien n'est lu", async () => {
    m.garde.mockResolvedValue({ autorise: false, motif: "non_connecte" });
    await Page(params());
    expect(m.devis).not.toHaveBeenCalled();
  });
});
