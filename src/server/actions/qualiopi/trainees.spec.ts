/**
 * Tests — Server Actions stagiaires (R10 audit E2E 2026-06-06).
 * Vérifie notamment le chiffrement PII du détail handicap (jamais en clair).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainee: {
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: vi.fn((v: string) => `enc:v1:${v}`),
}));

import { createTraineeAction, updateTraineeAction } from "./trainees";

const TRAINEE_ID = "44444444-4444-4444-4444-444444444444";

beforeEach(() => {
  mockCreate.mockReset();
  mockUpdate.mockReset();
});

describe("createTraineeAction", () => {
  it("crée un stagiaire valide", async () => {
    mockCreate.mockResolvedValue({ id: TRAINEE_ID });
    const r = await createTraineeAction({ nom: "Martin", prenom: "Léa", email: "lea@example.com" });
    expect(r).toEqual({ data: { id: TRAINEE_ID } });
  });

  it("CHIFFRE le détail handicap (jamais en clair) + déduit situationHandicap", async () => {
    mockCreate.mockResolvedValue({ id: TRAINEE_ID });
    await createTraineeAction({
      nom: "Martin",
      prenom: "Léa",
      email: "lea@example.com",
      handicapDetails: "Besoin d'un écran adapté",
    });
    const arg = mockCreate.mock.calls[0]?.[0] as {
      data: { handicapDetailsChiffre?: string; situationHandicap: boolean };
    };
    expect(arg.data.handicapDetailsChiffre).toBe("enc:v1:Besoin d'un écran adapté");
    expect(arg.data.handicapDetailsChiffre).toContain("enc:v1:"); // chiffré, pas en clair
    expect(arg.data.situationHandicap).toBe(true);
  });

  it("ne stocke pas de détail handicap si non fourni", async () => {
    mockCreate.mockResolvedValue({ id: TRAINEE_ID });
    await createTraineeAction({ nom: "X", prenom: "Y", email: "xy@example.com" });
    const arg = mockCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(arg.data.handicapDetailsChiffre).toBeUndefined();
    expect(arg.data.situationHandicap).toBe(false);
  });

  it("refuse un email invalide", async () => {
    const r = await createTraineeAction({ nom: "X", prenom: "Y", email: "nope" } as never);
    expect("error" in r).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("erreur claire si email déjà pris (P2002)", async () => {
    mockCreate.mockRejectedValue({ code: "P2002" });
    const r = await createTraineeAction({ nom: "X", prenom: "Y", email: "dup@example.com" });
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toContain("email");
  });
});

describe("updateTraineeAction", () => {
  it("re-chiffre le détail handicap fourni", async () => {
    mockUpdate.mockResolvedValue({ id: TRAINEE_ID });
    await updateTraineeAction({ id: TRAINEE_ID, handicapDetails: "RQTH — poste assis" });
    const arg = mockUpdate.mock.calls[0]?.[0] as { data: { handicapDetailsChiffre?: string } };
    expect(arg.data.handicapDetailsChiffre).toBe("enc:v1:RQTH — poste assis");
  });

  it("met à jour des champs simples sans toucher au handicap", async () => {
    mockUpdate.mockResolvedValue({ id: TRAINEE_ID });
    await updateTraineeAction({ id: TRAINEE_ID, entreprise: "ACME" });
    const arg = mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(arg.data.entreprise).toBe("ACME");
    expect(arg.data.handicapDetailsChiffre).toBeUndefined();
  });
});
