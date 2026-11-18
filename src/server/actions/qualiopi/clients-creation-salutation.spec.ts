/**
 * R2 — `createClientAction` accepte la civilité, le prénom et le nom de famille du contact
 * et les transmet à la porte unique. Données personnelles : rien en clair au journal.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireAdminWrite: vi.fn(),
  porte: vi.fn(),
  log: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => m.requireAdminWrite(),
  requireHabilitation: vi.fn(),
  logQualiopiActivity: (...a: unknown[]) => m.log(...a),
}));
vi.mock("@/server/qualiopi/crm/naf-opco", () => ({
  inferOpcoDepuisTable: async () => null,
}));
vi.mock("@/server/qualiopi/crm/porte-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/crm/porte-client")>()),
  creerOuRetrouverClient: (...a: unknown[]) => m.porte(...a),
}));

import { createClientAction } from "./clients";

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAdminWrite.mockResolvedValue({ userId: "u1", role: "admin" });
  m.porte.mockResolvedValue({
    statut: "cree",
    id: "c1",
    numero: "AXI-CLI-001",
    proches: [],
    creationForcee: false,
  });
});

const personne = () => m.porte.mock.calls[0]?.[2] as Record<string, unknown>;
const changes = () => (m.log.mock.calls[0]?.[0] as { changes: Record<string, unknown> }).changes;

describe("createClientAction — identité de salutation du contact", () => {
  it("transmet une civilité valide, le prénom et le nom de famille", async () => {
    const r = await createClientAction({
      raisonSociale: "Société Test",
      contactNom: "Léa Dupont",
      contactCivilite: "madame",
      contactPrenom: " Léa ",
      contactNomFamille: "Dupont",
    });
    expect("data" in r).toBe(true);
    expect(personne()).toMatchObject({
      nom: "Léa Dupont",
      civilite: "madame",
      prenom: "Léa",
      nomFamille: "Dupont",
    });
  });

  it("refuse « mademoiselle », sans rien créer", async () => {
    const r = await createClientAction({
      raisonSociale: "Société Test",
      contactCivilite: "mademoiselle" as never,
    });
    expect("error" in r).toBe(true);
    expect(m.porte).not.toHaveBeenCalled();
  });

  it("une valeur vide vaut absent", async () => {
    await createClientAction({
      raisonSociale: "Société Test",
      contactNom: "Léa Dupont",
      contactCivilite: "",
      contactPrenom: "  ",
      contactNomFamille: "",
    });
    expect(personne()).not.toHaveProperty("civilite");
    expect(personne()).not.toHaveProperty("prenom");
    expect(personne()).not.toHaveProperty("nomFamille");
  });

  it("refuse un prénom de plus de 80 caractères", async () => {
    const r = await createClientAction({
      raisonSociale: "Société Test",
      contactPrenom: "x".repeat(81),
    });
    expect("error" in r).toBe(true);
  });

  it("le journal ne porte aucune identité en clair", async () => {
    await createClientAction({
      raisonSociale: "Société Test",
      contactCivilite: "monsieur",
      contactPrenom: "Prénomsecret",
      contactNomFamille: "Nomsecret",
    });
    const j = JSON.stringify(m.log.mock.calls[0]);
    expect(j).not.toContain("Prénomsecret");
    expect(j).not.toContain("Nomsecret");
    expect(j).not.toContain("monsieur");
    expect(changes()).toMatchObject({
      contactCivilite: { modifie: true },
      contactPrenom: { modifie: true },
      contactNomFamille: { modifie: true },
    });
  });

  it("sans ces champs, rien ne change (ni transmis, ni journalisé)", async () => {
    await createClientAction({ raisonSociale: "Société Test", contactNom: "Léa Dupont" });
    expect(personne()).toEqual({ nom: "Léa Dupont" });
    expect(changes()).not.toHaveProperty("contactCivilite");
    expect(changes()).not.toHaveProperty("contactPrenom");
    expect(changes()).not.toHaveProperty("contactNomFamille");
  });
});
