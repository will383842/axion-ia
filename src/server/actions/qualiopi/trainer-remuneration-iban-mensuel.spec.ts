/**
 * Relecture de #1561 (bloquant) — LA RÈGLE C-1 GARDE AUSSI LE RELEVÉ MENSUEL.
 *
 * Le canal de changement d'IBAN est ouvert AVANT la date de passage au paiement par
 * mission : pendant toute cette période, les indépendants sont payés par relevé
 * mensuel. « Virement fait » sur un mensuel lit donc la même règle que la mission
 * (`gardeChangementIban`) : refusé pendant la vérification, puis tant que
 * `maintenant < max(demande + 48 h, validation)` ; relue sous verrou.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLog = vi.fn();
const mockCount = vi.fn();
const mockFindFirst = vi.fn();
const mockTxCount = vi.fn();
const mockTxFindFirst = vi.fn();

const tx = {
  $executeRawUnsafe: vi.fn(),
  trainerStatement: { updateMany: vi.fn() },
  trainerFeeLine: { updateMany: vi.fn() },
  demandeChangementFormateur: {
    count: (...a: unknown[]) => mockTxCount(...a),
    findFirst: (...a: unknown[]) => mockTxFindFirst(...a),
  },
};

const mockStatementFindUnique = vi.fn();
const mockTransaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: { findUnique: (...a: unknown[]) => mockStatementFindUnique(...a) },
    demandeChangementFormateur: {
      count: (...a: unknown[]) => mockCount(...a),
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...(a as [never])),
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => mockLog(...a),
}));

vi.mock("@/server/qualiopi/remuneration/statements", () => ({
  runRemunerationMensuelle: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { LIBELLE_SUSPENSION_VIREMENT } from "@/server/qualiopi/formateurs-independants/paiement/virement-mission";

import { transitionStatementAction } from "./trainer-remuneration";

const ID = "11111111-1111-4111-8111-111111111111";
const TRAINER = "22222222-2222-4222-8222-222222222222";
const H = 3_600_000;
const DEMANDE = new Date("2026-11-02T09:00:00Z");
const VALIDATION = new Date("2026-11-03T15:00:00Z");

/** Un relevé MENSUEL d'indépendant (origine `releve_mensuel`), facture reçue et conforme. */
function mensuel(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    trainerId: TRAINER,
    periodeYear: 2026,
    periodeMonth: 10,
    statut: "facture_recue",
    totalTtcCents: 108_000,
    numeroFacture: "F-001",
    dateFacture: new Date("2026-11-01T00:00:00Z"),
    montantFactureTtcCents: 108_000,
    autofactureAt: null,
    contesteeAt: null,
    contestationMotif: null,
    contestationCloseIssue: null,
    origine: "releve_mensuel",
    echeanceAt: null,
    avoirDeId: null,
    remplaceId: null,
    feeLines: [],
    sessionId: null,
    ...over,
  };
}

const payer = () => transitionStatementAction({ id: ID, to: "paye", moyenPaiement: "virement" });

function changementAccepte() {
  const d = { createdAt: DEMANDE, traiteAt: VALIDATION };
  mockFindFirst.mockResolvedValue(d);
  mockTxFindFirst.mockResolvedValue(d);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  mockStatementFindUnique.mockResolvedValue(mensuel());
  mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  tx.$executeRawUnsafe.mockResolvedValue(0);
  tx.trainerStatement.updateMany.mockResolvedValue({ count: 1 });
  tx.trainerFeeLine.updateMany.mockResolvedValue({ count: 0 });
  mockCount.mockResolvedValue(0);
  mockFindFirst.mockResolvedValue(null);
  mockTxCount.mockResolvedValue(0);
  mockTxFindFirst.mockResolvedValue(null);
  mockLog.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("relevé MENSUEL — « Virement fait » lit la règle C-1", () => {
  it("demande d'IBAN en attente : refusé, rien n'est écrit", async () => {
    vi.setSystemTime(new Date(DEMANDE.getTime() + 1000 * H));
    mockCount.mockResolvedValue(1);
    const res = await payer();
    expect(res).toEqual({ error: LIBELLE_SUSPENSION_VIREMENT.compte_bancaire_a_valider });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockCount).toHaveBeenCalledWith({
      where: { trainerId: TRAINER, nature: "iban", statut: "en_attente" },
    });
  });

  it("IBAN changé, 48 h moins 1 ms après la demande : refusé", async () => {
    vi.setSystemTime(new Date(DEMANDE.getTime() + 48 * H - 1));
    changementAccepte();
    const res = await payer();
    expect(res).toEqual({ error: LIBELLE_SUSPENSION_VIREMENT.nouvel_iban_moins_de_48h });
    expect(tx.trainerStatement.updateMany).not.toHaveBeenCalled();
  });

  it("IBAN changé, exactement 48 h après la demande : payé", async () => {
    vi.setSystemTime(new Date(DEMANDE.getTime() + 48 * H));
    changementAccepte();
    const res = await payer();
    expect(res).toEqual({ data: { id: ID, statut: "paye" } });
    const data = tx.trainerStatement.updateMany.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.statut).toBe("paye");
  });

  it("validation après les 48 h : refusé jusqu'à la validation (max des deux)", async () => {
    const tardive = { createdAt: DEMANDE, traiteAt: new Date(DEMANDE.getTime() + 60 * H) };
    mockFindFirst.mockResolvedValue(tardive);
    vi.setSystemTime(new Date(DEMANDE.getTime() + 60 * H - 1));
    expect(await payer()).toEqual({
      error: LIBELLE_SUSPENSION_VIREMENT.nouvel_iban_moins_de_48h,
    });
  });

  it("🔒 demande déposée entre la garde et le verrou : relue SOUS VERROU, refusé", async () => {
    vi.setSystemTime(new Date(DEMANDE.getTime() + 1000 * H));
    mockTxCount.mockResolvedValue(1);
    const res = await payer();
    expect(res).toEqual({ error: LIBELLE_SUSPENSION_VIREMENT.compte_bancaire_a_valider });
    expect(tx.$executeRawUnsafe).toHaveBeenCalled(); // les verrous sont pris AVANT la relecture
    expect(tx.trainerStatement.updateMany).not.toHaveBeenCalled();
  });

  it("lecture des demandes en échec : refusé (jamais « rien à signaler »)", async () => {
    vi.setSystemTime(new Date(DEMANDE.getTime() + 1000 * H));
    mockCount.mockRejectedValue(new Error("base"));
    const res = await payer();
    expect("error" in res && res.error).toMatch(/compte bancaire.*paiement refusé/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("aucun changement d'IBAN (salarié, dirigeant, indépendant sans demande) : inchangé, payé", async () => {
    vi.setSystemTime(new Date(DEMANDE.getTime()));
    expect(await payer()).toEqual({ data: { id: ID, statut: "paye" } });
  });

  it("les autres transitions du mensuel ne lisent pas la règle", async () => {
    mockStatementFindUnique.mockResolvedValue(mensuel({ statut: "a_valider" }));
    mockCount.mockResolvedValue(1);
    expect(await transitionStatementAction({ id: ID, to: "valide" })).toEqual({
      data: { id: ID, statut: "valide" },
    });
    expect(mockCount).not.toHaveBeenCalled();
  });
});
