/**
 * B4 — `updateClientAction` accepte la civilité, le prénom et le nom de famille
 * du contact, et les confie à `definirContactFacturation` (jamais d'écriture directe).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireAdminWrite: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  definir: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    client: {
      update: (...a: unknown[]) => m.update(...a),
      findUnique: (...a: unknown[]) => m.findUnique(...a),
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma };
});
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => m.requireAdminWrite(),
  requireHabilitation: vi.fn(),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("@/server/partners-sync/producteurs/client", () => ({
  chargeClientAvant: async () => null,
  emettreFaitClient: async () => undefined,
}));
vi.mock("@/server/qualiopi/crm/contact-facturation", () => ({
  definirContactFacturation: (...a: unknown[]) => m.definir(...a),
}));

import { updateClientAction } from "./clients";

const ID = "550e8400-e29b-41d4-a716-446655440078";

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAdminWrite.mockResolvedValue({ userId: "u1", role: "admin" });
  m.update.mockResolvedValue({ id: ID });
  m.findUnique.mockResolvedValue({ type: "entreprise", nafCode: null, idcc: null });
});

function transmis(): Record<string, unknown> {
  return m.definir.mock.calls[0]?.[1] as Record<string, unknown>;
}

describe("updateClientAction — identité de salutation du contact", () => {
  it("accepte madame / monsieur, prénom, nom de famille", async () => {
    const r = await updateClientAction({
      id: ID,
      contactCivilite: "madame",
      contactPrenom: "Léa",
      contactNomFamille: "Dupont",
    });
    expect("data" in r).toBe(true);
    expect(transmis()).toMatchObject({
      clientId: ID,
      civilite: "madame",
      prenom: "Léa",
      nomFamille: "Dupont",
    });
    expect(transmis()).not.toHaveProperty("nom");
  });

  it("refuse une civilité inconnue, sans rien écrire", async () => {
    const r = await updateClientAction({ id: ID, contactCivilite: "docteur" as never });
    expect("error" in r).toBe(true);
    expect(m.definir).not.toHaveBeenCalled();
  });

  it("vide → null (efface)", async () => {
    await updateClientAction({
      id: ID,
      contactCivilite: "",
      contactPrenom: "  ",
      contactNomFamille: "",
    });
    expect(transmis()).toMatchObject({ civilite: null, prenom: null, nomFamille: null });
  });

  it("refuse un nom de famille de plus de 80 caractères", async () => {
    const r = await updateClientAction({ id: ID, contactNomFamille: "x".repeat(81) });
    expect("error" in r).toBe(true);
  });
});
