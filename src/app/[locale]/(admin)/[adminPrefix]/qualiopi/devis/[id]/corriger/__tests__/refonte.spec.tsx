/**
 * Refonte visuelle de « Corriger un devis » : tuiles, encadrés, pastilles avec icône,
 * actions identiques, vocabulaire.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ garde: vi.fn(), devis: vi.fn(), formulaire: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
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
const params = { params: Promise.resolve({ locale: "fr" as const, adminPrefix: "adm", id: ID }) };
const devis = (over: Record<string, unknown> = {}) => ({
  id: ID,
  numero: "AXI-DEV-2026-007",
  statut: "brouillon",
  offre: null,
  offreSha256: null,
  financementSuggere: null,
  montantOpcoEstimeCents: null,
  lignes: [
    { designation: "Atelier", quantite: 2, prixUnitaireHtCents: 100000 },
    { designation: "Suivi", quantite: 1, prixUnitaireHtCents: 50000 },
  ],
  activite: "formation",
  refClient: "BC-12",
  conditionsParticulieres: null,
  updatedAt: new Date("2026-11-01T10:00:00Z"),
  client: { id: "c1", numero: "AXI-CLI-001", raisonSociale: "ACME" },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.garde.mockResolvedValue({ autorise: true, role: "admin", peutEcrire: true });
  m.devis.mockResolvedValue(devis());
});

describe("Corriger un devis — refonte visuelle", () => {
  it("affiche les tuiles de chiffres clés calculées sur les données chargées", async () => {
    const { container } = render(await Page(params));
    expect(container.querySelectorAll(".admin-stat-card")).toHaveLength(4);
    expect(screen.getAllByText("AXI-DEV-2026-007").length).toBeGreaterThan(0);
    expect(screen.getByText("2")).toBeTruthy(); // lignes
    expect(screen.getByText(/2\s?500,00/)).toBeTruthy(); // total HT
    expect(screen.getByText(/1 nov\. 2026|1 novembre 2026/)).toBeTruthy();
  });

  it("les icônes des tuiles sont décoratives (svg masqués)", async () => {
    const { container } = render(await Page(params));
    const icones = container.querySelectorAll(".admin-stat-card svg");
    expect(icones.length).toBeGreaterThanOrEqual(4);
    icones.forEach((i) => expect(i.closest("[aria-hidden='true']")).not.toBeNull());
  });

  it("l'explication est dans un bloc repliable fermé", async () => {
    const { container } = render(await Page(params));
    const d = container.querySelector("details");
    expect(d).not.toBeNull();
    expect(d?.hasAttribute("open")).toBe(false);
    expect(d?.textContent).toContain("Un devis envoyé ne se modifie pas");
  });

  it("monte le formulaire avec les mêmes props d'édition", async () => {
    render(await Page(params));
    expect(screen.getByTestId("formulaire-devis")).toBeTruthy();
    expect(m.formulaire.mock.calls[0]![0]).toMatchObject({
      defaultClientId: "c1",
      edition: { devisId: ID, attenduMajLe: "2026-11-01T10:00:00.000Z", refClient: "BC-12" },
    });
  });

  it("lignes illisibles : encadré d'alerte teinté avec icône, formulaire non ouvert", async () => {
    m.devis.mockResolvedValue(devis({ lignes: "illisible" }));
    const { container } = render(await Page(params));
    const alerte = screen.getByRole("alert");
    expect(alerte.textContent).toContain("ne peuvent pas être relues");
    expect(alerte.querySelector("svg")).not.toBeNull();
    expect(alerte.className).toContain("bg-[color:var(--color-admin-destructive-soft)]");
    expect(container.querySelector("[data-testid='formulaire-devis']")).toBeNull();
  });

  it("règlement par un tiers : encadré d'alerte, formulaire non ouvert", async () => {
    m.devis.mockResolvedValue(devis({ financementSuggere: "opco", montantOpcoEstimeCents: 1000 }));
    render(await Page(params));
    expect(screen.queryByTestId("formulaire-devis")).toBeNull();
    expect(screen.getByRole("alert").querySelector("svg")).not.toBeNull();
  });

  it("aucune couleur Tailwind par défaut ni iframe", async () => {
    const { container } = render(await Page(params));
    expect(container.innerHTML).not.toMatch(
      /\b(bg|text|border)-(red|green|blue|gray|amber|yellow)-\d/,
    );
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("garde de vocabulaire : les textes ajoutés n'emploient aucun mot interdit", async () => {
    const { container } = render(await Page(params));
    const ajoutes = Array.from(container.querySelectorAll(".admin-stat-card, summary"))
      .map((n) => n.textContent ?? "")
      .join(" ");
    expect(ajoutes).not.toMatch(/qualiopi|opco|financement|prise en charge|certification|cpf/i);
  });
});
