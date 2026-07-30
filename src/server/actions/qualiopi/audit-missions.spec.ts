// Tests — audit-missions.ts (actions audits + acomptes).
//
// Ce qu'on verrouille : le numéro alloué sous advisory lock, l'affectation/retrait
// de formateur, l'acompte qui vise la BONNE table (formation vs audit) et convertit
// bien euros → centimes.

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdminWrite = vi.fn();
const mockLog = vi.fn();

const tx = {
  $executeRawUnsafe: vi.fn(),
  // `findMany` : chemin d'allocation depuis V20 (borne haute sur la série).
  auditMission: { count: vi.fn(), findMany: vi.fn(), create: vi.fn() },
};
const mockTransaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
const mockAuditUpdate = vi.fn();
const mockSessionUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...a: unknown[]) => mockTransaction(...(a as [never])),
    auditMission: { update: (...a: unknown[]) => mockAuditUpdate(...a) },
    trainingSession: { update: (...a: unknown[]) => mockSessionUpdate(...a) },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => mockRequireAdminWrite(),
  logQualiopiActivity: (...a: unknown[]) => mockLog(...a),
}));

import {
  assignAuditFormateurAction,
  createAuditMissionAction,
  setAcompteAction,
} from "./audit-missions";

const AID = "11111111-1111-4111-8111-111111111111";
const TID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminWrite.mockResolvedValue({ userId: "u1", role: "admin" });
  mockLog.mockResolvedValue(undefined);
  mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  tx.$executeRawUnsafe.mockResolvedValue(undefined);
  tx.auditMission.count.mockResolvedValue(0);
  // Série AXI-AUD vide par défaut → première allocation = …-001.
  tx.auditMission.findMany.mockResolvedValue([]);
  tx.auditMission.create.mockResolvedValue({ id: AID, numero: "AXI-AUD-2026-001" });
  mockAuditUpdate.mockResolvedValue({});
  mockSessionUpdate.mockResolvedValue({});
});

describe("createAuditMissionAction", () => {
  it("alloue un numéro sous advisory lock et convertit euros → centimes", async () => {
    const r = await createAuditMissionAction({
      titre: "Audit IA ACME",
      dateDebut: "2026-06-10",
      dateFin: "2026-06-11",
      montantEuros: 5000,
    });
    expect("data" in r && r.data.numero).toBe("AXI-AUD-2026-001");
    // Verrou pris.
    const sql = tx.$executeRawUnsafe.mock.calls[0]?.[0] as string;
    expect(sql).toContain("pg_advisory_xact_lock");
    // Montant converti.
    const data = tx.auditMission.create.mock.calls[0]?.[0]?.data as { montantHtCents: number };
    expect(data.montantHtCents).toBe(500_000);
  });

  it("refuse une fin antérieure au début", async () => {
    const r = await createAuditMissionAction({
      titre: "X",
      dateDebut: "2026-06-11",
      dateFin: "2026-06-10",
      montantEuros: 100,
    });
    expect("error" in r).toBe(true);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("refuse un titre vide", async () => {
    const r = await createAuditMissionAction({
      titre: "",
      dateDebut: "2026-06-10",
      dateFin: "2026-06-11",
      montantEuros: 100,
    });
    expect("error" in r).toBe(true);
  });
});

describe("assignAuditFormateurAction", () => {
  it("affecte un formateur", async () => {
    const r = await assignAuditFormateurAction({ id: AID, formateurId: TID });
    expect(r).toEqual({ data: { id: AID } });
    const data = mockAuditUpdate.mock.calls[0]?.[0]?.data as { formateurId: string };
    expect(data.formateurId).toBe(TID);
  });

  it("retire le formateur (null)", async () => {
    await assignAuditFormateurAction({ id: AID, formateurId: null });
    const data = mockAuditUpdate.mock.calls[0]?.[0]?.data as { formateurId: string | null };
    expect(data.formateurId).toBeNull();
  });
});

describe("setAcompteAction — vise la bonne table", () => {
  it("sur un AUDIT : met à jour auditMission, convertit euros → centimes", async () => {
    await setAcompteAction({
      prestation: "audit",
      id: AID,
      montantEuros: 1500,
      dateVersement: "2026-06-01",
      recu: true,
      moyen: "chèque",
    });
    expect(mockAuditUpdate).toHaveBeenCalled();
    expect(mockSessionUpdate).not.toHaveBeenCalled();
    const data = mockAuditUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.acompteMontantCents).toBe(150_000);
    expect(data.acompteRecu).toBe(true);
    expect(data.acompteMoyen).toBe("chèque");
  });

  it("sur une FORMATION : met à jour trainingSession, pas auditMission", async () => {
    await setAcompteAction({ prestation: "formation", id: AID, recu: true });
    expect(mockSessionUpdate).toHaveBeenCalled();
    expect(mockAuditUpdate).not.toHaveBeenCalled();
  });

  it("un moyen vide devient null (pas de chaîne vide en base)", async () => {
    await setAcompteAction({ prestation: "audit", id: AID, moyen: "" });
    const data = mockAuditUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.acompteMoyen).toBeNull();
  });
});
