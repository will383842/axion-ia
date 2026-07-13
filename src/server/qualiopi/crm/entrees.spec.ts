// Tests — entrees.ts (Lot 3 : pont appel/contact → CRM).
//
// Ce qu'on verrouille : la fusion CalendlyEvent + Submission triée date desc,
// la limite appliquée après fusion, le déchiffrement PII appliqué aux
// Submissions AVANT le match, le match email insensible à la casse contre
// Client.contactEmail, et la robustesse stub/DB down (→ [] / null).

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCalendlyFindMany = vi.fn();
const mockSubmissionFindMany = vi.fn();
const mockClientFindMany = vi.fn();
const mockClientFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: { findMany: (...a: unknown[]) => mockCalendlyFindMany(...a) },
    submission: { findMany: (...a: unknown[]) => mockSubmissionFindMany(...a) },
    client: {
      findMany: (...a: unknown[]) => mockClientFindMany(...a),
      findFirst: (...a: unknown[]) => mockClientFindFirst(...a),
    },
  },
}));

// decryptPii simulé : retire un préfixe "enc:" fictif → prouve que le service
// déchiffre AVANT d'utiliser les valeurs (match + affichage).
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null | undefined) =>
    typeof v === "string" && v.startsWith("enc:") ? v.slice(4) : v,
  isDecryptedEmailUsable: (v: string | null | undefined) =>
    !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
}));

import { listEntreesRecentes, findClientByEmail } from "./entrees";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function calRow(over: Record<string, unknown> = {}) {
  return {
    id: "cal-1",
    eventTypeName: "Appel découverte 30 min",
    startTime: new Date("2026-07-10T10:00:00Z"),
    capturedAt: new Date("2026-07-09T18:00:00Z"),
    inviteeName: "Alice Martin",
    inviteeEmail: "Alice@Acme.FR",
    inviteePhone: "+33600000001",
    ...over,
  };
}

function subRow(over: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    type: "contact",
    submittedAt: new Date("2026-07-11T09:00:00Z"),
    companyName: "Acme SAS",
    contactName: "enc:Bob Dupont",
    contactEmail: "enc:bob@acme.fr",
    contactPhone: "enc:+33600000002",
    details: { message: "Besoin d'une formation IA pour 12 collaborateurs." },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCalendlyFindMany.mockResolvedValue([]);
  mockSubmissionFindMany.mockResolvedValue([]);
  mockClientFindMany.mockResolvedValue([]);
  mockClientFindFirst.mockResolvedValue(null);
});

// ─────────────────────────────────────────────────────────────────────────────
// listEntreesRecentes
// ─────────────────────────────────────────────────────────────────────────────

describe("listEntreesRecentes — fusion + tri", () => {
  it("fusionne Calendly + Submission triés par date desc", async () => {
    mockCalendlyFindMany.mockResolvedValue([
      calRow(), // 2026-07-10 (startTime)
      calRow({ id: "cal-2", startTime: null, capturedAt: new Date("2026-07-12T08:00:00Z") }),
    ]);
    mockSubmissionFindMany.mockResolvedValue([subRow()]); // 2026-07-11

    const rows = await listEntreesRecentes();
    expect(rows.map((r) => r.id)).toEqual(["cal-2", "sub-1", "cal-1"]);
    expect(rows.map((r) => r.source)).toEqual(["calendly", "submission", "calendly"]);
    // cal-2 sans startTime → date de repli = capturedAt.
    expect(rows[0]?.date).toEqual(new Date("2026-07-12T08:00:00Z"));
  });

  it("déchiffre la PII Submission (nom / email / téléphone) et extrait le message", async () => {
    mockSubmissionFindMany.mockResolvedValue([subRow()]);
    const rows = await listEntreesRecentes();
    expect(rows[0]?.nom).toBe("Bob Dupont");
    expect(rows[0]?.email).toBe("bob@acme.fr");
    expect(rows[0]?.telephone).toBe("+33600000002");
    expect(rows[0]?.societe).toBe("Acme SAS");
    expect(rows[0]?.extrait).toContain("Besoin d'une formation IA");
  });

  it("applique la limite APRÈS fusion (et la passe aux deux findMany)", async () => {
    mockCalendlyFindMany.mockResolvedValue([
      calRow({ id: "cal-a", startTime: new Date("2026-07-12T10:00:00Z") }),
      calRow({ id: "cal-b", startTime: new Date("2026-07-10T10:00:00Z") }),
    ]);
    mockSubmissionFindMany.mockResolvedValue([
      subRow({ id: "sub-a", submittedAt: new Date("2026-07-11T10:00:00Z") }),
    ]);

    const rows = await listEntreesRecentes({ limit: 2 });
    expect(rows.map((r) => r.id)).toEqual(["cal-a", "sub-a"]);
    expect(mockCalendlyFindMany.mock.calls[0]?.[0]?.take).toBe(2);
    expect(mockSubmissionFindMany.mock.calls[0]?.[0]?.take).toBe(2);
  });

  it("exclut la corbeille (deletedAt null) côté Submission", async () => {
    await listEntreesRecentes();
    expect(mockSubmissionFindMany.mock.calls[0]?.[0]?.where).toEqual({ deletedAt: null });
  });

  it("stub/DB down → [] (jamais de throw)", async () => {
    mockCalendlyFindMany.mockRejectedValue(new Error("stub.invalid"));
    await expect(listEntreesRecentes()).resolves.toEqual([]);
  });
});

describe("listEntreesRecentes — annotation clientExistant", () => {
  it("matche l'email insensible à la casse (Calendly cleartext + Submission chiffrée)", async () => {
    mockCalendlyFindMany.mockResolvedValue([calRow()]); // Alice@Acme.FR
    mockSubmissionFindMany.mockResolvedValue([subRow()]); // enc:bob@acme.fr
    mockClientFindMany.mockResolvedValue([
      {
        id: "cli-1",
        numero: "AXI-CLI-007",
        raisonSociale: "Acme SAS",
        contactEmail: "ALICE@acme.fr", // casse différente des deux côtés
      },
    ]);

    const rows = await listEntreesRecentes();
    const cal = rows.find((r) => r.id === "cal-1");
    const sub = rows.find((r) => r.id === "sub-1");
    expect(cal?.clientExistant).toEqual({
      id: "cli-1",
      numero: "AXI-CLI-007",
      raisonSociale: "Acme SAS",
    });
    expect(sub?.clientExistant).toBeNull();
    // Les clés du `in` sont normalisées lowercase.
    const where = mockClientFindMany.mock.calls[0]?.[0]?.where;
    expect(where.contactEmail.in).toEqual(expect.arrayContaining(["alice@acme.fr", "bob@acme.fr"]));
    expect(where.contactEmail.mode).toBe("insensitive");
  });

  it("entrée sans email exploitable → clientExistant null, pas de query client", async () => {
    mockCalendlyFindMany.mockResolvedValue([calRow({ inviteeEmail: null })]);
    const rows = await listEntreesRecentes();
    expect(rows[0]?.clientExistant).toBeNull();
    expect(mockClientFindMany).not.toHaveBeenCalled();
  });

  it("query clients en échec → entrées retournées sans annotation", async () => {
    mockCalendlyFindMany.mockResolvedValue([calRow()]);
    mockClientFindMany.mockRejectedValue(new Error("down"));
    const rows = await listEntreesRecentes();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.clientExistant).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findClientByEmail
// ─────────────────────────────────────────────────────────────────────────────

describe("findClientByEmail", () => {
  it("cherche en equals insensitive et retourne le client", async () => {
    mockClientFindFirst.mockResolvedValue({
      id: "cli-9",
      numero: "AXI-CLI-009",
      raisonSociale: "Beta SARL",
    });
    const r = await findClientByEmail("  Contact@Beta.FR  ".trim());
    expect(r?.numero).toBe("AXI-CLI-009");
    const where = mockClientFindFirst.mock.calls[0]?.[0]?.where;
    expect(where.contactEmail.mode).toBe("insensitive");
  });

  it("email vide → null sans query", async () => {
    await expect(findClientByEmail("   ")).resolves.toBeNull();
    expect(mockClientFindFirst).not.toHaveBeenCalled();
  });

  it("stub/DB down → null", async () => {
    mockClientFindFirst.mockRejectedValue(new Error("stub.invalid"));
    await expect(findClientByEmail("x@y.fr")).resolves.toBeNull();
  });
});
