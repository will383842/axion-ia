// Tests — entrees.ts (action convertir une entrée en client, Lot 3).
//
// Ce qu'on verrouille : la dédup par email (client existant → dejaExistant:true
// SANS création), la création déléguée à createClientAction (numérotation
// AXI-CLI réutilisée, source tracée), la propagation d'erreur et la validation.

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdminWrite = vi.fn();
const mockLog = vi.fn();
const mockFindClientByEmail = vi.fn();
const mockCreateClientAction = vi.fn();

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => mockRequireAdminWrite(),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => mockLog(...a),
}));
vi.mock("@/server/qualiopi/crm/entrees", () => ({
  findClientByEmail: (...a: unknown[]) => mockFindClientByEmail(...a),
}));
vi.mock("@/server/actions/qualiopi/clients", () => ({
  createClientAction: (...a: unknown[]) => mockCreateClientAction(...a),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { convertirEntreeEnClientAction } from "./entrees";

const BASE_INPUT = {
  source: "calendly" as const,
  entreeId: "cal-1",
  raisonSociale: "Acme SAS",
  contactNom: "Alice Martin",
  contactEmail: "alice@acme.fr",
  contactTelephone: "+33600000001",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminWrite.mockResolvedValue({ userId: "u1", role: "admin" });
  mockLog.mockResolvedValue(undefined);
  mockFindClientByEmail.mockResolvedValue(null);
  mockCreateClientAction.mockResolvedValue({ data: { id: "cli-new", numero: "AXI-CLI-042" } });
});

describe("convertirEntreeEnClientAction — dédup email", () => {
  it("client au même email déjà présent → dejaExistant:true, AUCUNE création", async () => {
    mockFindClientByEmail.mockResolvedValue({
      id: "cli-1",
      numero: "AXI-CLI-007",
      raisonSociale: "Acme SAS",
    });

    const r = await convertirEntreeEnClientAction(BASE_INPUT);
    expect(r).toEqual({ data: { id: "cli-1", numero: "AXI-CLI-007", dejaExistant: true } });
    expect(mockCreateClientAction).not.toHaveBeenCalled();
    // Audit tracé même sans création.
    const log = mockLog.mock.calls[0]?.[0];
    expect(log.action).toBe("qualiopi.crm.convertir_entree");
    expect(log.targetId).toBe("cli-1");
    expect(log.changes.dejaExistant).toBe(true);
  });

  it("sans email fourni → pas de lookup dédup, création directe", async () => {
    const { contactEmail: _omit, ...sansEmail } = BASE_INPUT;
    const r = await convertirEntreeEnClientAction(sansEmail);
    expect(mockFindClientByEmail).not.toHaveBeenCalled();
    expect("data" in r && r.data.dejaExistant).toBe(false);
  });
});

describe("convertirEntreeEnClientAction — création", () => {
  it("délègue à createClientAction (mêmes champs + source tracée) et log l'audit", async () => {
    const r = await convertirEntreeEnClientAction(BASE_INPUT);
    expect(r).toEqual({ data: { id: "cli-new", numero: "AXI-CLI-042", dejaExistant: false } });

    const payload = mockCreateClientAction.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      raisonSociale: "Acme SAS",
      contactNom: "Alice Martin",
      contactEmail: "alice@acme.fr",
      contactTelephone: "+33600000001",
      source: "appel_calendly",
    });

    const log = mockLog.mock.calls[0]?.[0];
    expect(log.action).toBe("qualiopi.crm.convertir_entree");
    expect(log.targetType).toBe("Client");
    expect(log.targetId).toBe("cli-new");
    expect(log.changes).toMatchObject({
      source: "calendly",
      entreeId: "cal-1",
      numero: "AXI-CLI-042",
      dejaExistant: false,
    });
  });

  it("source submission → source client « formulaire_contact »", async () => {
    await convertirEntreeEnClientAction({
      ...BASE_INPUT,
      source: "submission",
      entreeId: "sub-1",
    });
    expect(mockCreateClientAction.mock.calls[0]?.[0]?.source).toBe("formulaire_contact");
  });

  it("propage l'erreur de createClientAction sans log convertir_entree", async () => {
    mockCreateClientAction.mockResolvedValue({ error: "Données invalides" });
    const r = await convertirEntreeEnClientAction(BASE_INPUT);
    expect(r).toEqual({ error: "Données invalides" });
    expect(mockLog).not.toHaveBeenCalled();
  });
});

describe("convertirEntreeEnClientAction — validation", () => {
  it("refuse une raison sociale vide", async () => {
    const r = await convertirEntreeEnClientAction({ ...BASE_INPUT, raisonSociale: "" });
    expect("error" in r).toBe(true);
    expect(mockCreateClientAction).not.toHaveBeenCalled();
  });

  it("refuse un email invalide", async () => {
    const r = await convertirEntreeEnClientAction({ ...BASE_INPUT, contactEmail: "pas-un-email" });
    expect("error" in r).toBe(true);
    expect(mockFindClientByEmail).not.toHaveBeenCalled();
  });
});
