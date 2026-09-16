/**
 * Tests — Server Actions stagiaires (R10 audit E2E 2026-06-06).
 * Vérifie notamment le chiffrement PII du détail handicap (jamais en clair).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();
const mockJournal = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainee: {
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    activityLog: { create: (...args: unknown[]) => mockJournal(...args) },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

// ⚠️ Doublon FIDÈLE : il reproduit la garde d'idempotence du module réel (un
// texte déjà préfixé revient INCHANGÉ). Un doublon plus indulgent que la
// production rend invisible la garde qui refuse d'écrire du clair — c'est
// exactement ce qui avait laissé passer la faille corrigée ici.
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: vi.fn((v: string) => (v.startsWith("enc:v1:") ? v : `enc:v1:${v}`)),
  isEncryptedPii: (v: unknown) => typeof v === "string" && v.startsWith("enc:v1:"),
  PII_DECRYPT_PLACEHOLDER: "[encrypted — key missing]",
}));

import { createTraineeAction, updateTraineeAction } from "./trainees";

const TRAINEE_ID = "44444444-4444-4444-4444-444444444444";

beforeEach(() => {
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockFindUnique.mockReset();
  mockJournal.mockReset();
  mockJournal.mockResolvedValue({});
  mockFindUnique.mockResolvedValue({ situationHandicap: false });
  vi.stubEnv("DATABASE_URL", "postgresql://test");
});

/** Les déclarations de besoin datées au journal (ind. 10). */
function declarationsJournalisees(): Array<{ targetId: string; changes: unknown }> {
  return mockJournal.mock.calls
    .map((c) => (c[0] as { data: { action: string; targetId: string; changes: unknown } }).data)
    .filter((d) => d.action === "qualiopi.trainee.besoin_adaptation.declare");
}

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

  // 🔴 Ind. 10 (relecture #1095) — cocher la fiche ou réécrire le détail est une
  // NOUVELLE déclaration : elle est datée au journal, et rouvre une réponse déjà
  // consignée. Garder la case cochée n'en est pas une.
  it("🔴 cocher la situation de handicap DATE une nouvelle déclaration (origine console, sans détail)", async () => {
    mockUpdate.mockResolvedValue({ id: TRAINEE_ID });
    await updateTraineeAction({ id: TRAINEE_ID, situationHandicap: true });
    const decl = declarationsJournalisees();
    expect(decl).toHaveLength(1);
    expect(decl[0]).toMatchObject({ targetId: TRAINEE_ID, changes: { origine: "console" } });
  });

  it("réécrire le détail d'une situation déjà cochée est aussi une déclaration — le détail n'entre pas au journal", async () => {
    mockFindUnique.mockResolvedValue({ situationHandicap: true });
    mockUpdate.mockResolvedValue({ id: TRAINEE_ID });
    await updateTraineeAction({ id: TRAINEE_ID, situationHandicap: true, handicapDetails: "RQTH" });
    expect(declarationsJournalisees()).toHaveLength(1);
    expect(JSON.stringify(mockJournal.mock.calls)).not.toContain("RQTH");
  });

  it("réenregistrer la fiche SANS changer la case, ou décocher, n'est pas une déclaration", async () => {
    mockFindUnique.mockResolvedValue({ situationHandicap: true });
    mockUpdate.mockResolvedValue({ id: TRAINEE_ID });
    await updateTraineeAction({ id: TRAINEE_ID, situationHandicap: true, entreprise: "ACME" });
    await updateTraineeAction({ id: TRAINEE_ID, situationHandicap: false });
    expect(declarationsJournalisees()).toHaveLength(0);
  });
});
