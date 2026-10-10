/**
 * Lot S3 — un relevé ne se modifie ni PENDANT son calcul, ni APRÈS son autofacture.
 *
 * (C4) La transition prend le verrou de période PUIS le verrou formateur — les
 *      mêmes, dans le même ordre, que le run mensuel — et n'écrit le nouveau
 *      statut que si le relevé est toujours dans celui qu'elle a lu. Sinon :
 *      « le relevé a changé, rechargez ». La course elle-même (run ∥ validation,
 *      50 itérations) est jouée sur un vrai Postgres dans
 *      `tests/integration/remuneration/`.
 * (C5) Une autofacture émise est une pièce comptable : on ne revient plus en
 *      arrière (`valide → a_valider`, `facture_recue → valide`) et on ne change
 *      plus son numéro. Une correction passera par un avoir.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  $executeRawUnsafe: vi.fn(),
  trainerStatement: { update: vi.fn(), updateMany: vi.fn() },
  trainerFeeLine: { updateMany: vi.fn() },
};

const mockStatementFindUnique = vi.fn();
const mockTransaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: { findUnique: (...a: unknown[]) => mockStatementFindUnique(...a) },
    $transaction: (...a: unknown[]) => mockTransaction(...(a as [never])),
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/qualiopi/remuneration/statements", () => ({
  runRemunerationMensuelle: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/autofacture", () => ({
  emettreAutofactureAction: vi.fn().mockResolvedValue({ error: "neutralisée" }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { transitionStatementAction } from "./trainer-remuneration";

const ID = "11111111-1111-4111-8111-111111111111";
const TRAINER = "22222222-2222-4222-8222-222222222222";
const EMISE = new Date("2026-07-02T10:00:00Z");

function releve(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    trainerId: TRAINER,
    periodeYear: 2026,
    periodeMonth: 6,
    statut: "valide",
    totalTtcCents: 108_000,
    numeroFacture: null,
    dateFacture: null,
    montantFactureTtcCents: null,
    autofactureAt: null,
    contesteeAt: null,
    contestationMotif: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  tx.$executeRawUnsafe.mockResolvedValue(0);
  tx.trainerStatement.update.mockResolvedValue({});
  tx.trainerStatement.updateMany.mockResolvedValue({ count: 1 });
  tx.trainerFeeLine.updateMany.mockResolvedValue({ count: 0 });
});

describe("C4 — la transition se sérialise avec le run mensuel", () => {
  it("prend le verrou de PÉRIODE puis le verrou FORMATEUR, avant toute écriture", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "a_valider" }));

    const res = await transitionStatementAction({ id: ID, to: "valide" });

    expect(res).toEqual({ data: { id: ID, statut: "valide" } });
    const verrous = tx.$executeRawUnsafe.mock.calls.map((c) => String(c[0]));
    expect(verrous).toHaveLength(2);
    expect(verrous[0]).toContain("pg_advisory_xact_lock(hashtext('remuneration_run_2026_6'))");
    expect(verrous[1]).toContain(
      `pg_advisory_xact_lock(hashtext('remuneration_trainer_${TRAINER}'))`,
    );
    const premierVerrou = tx.$executeRawUnsafe.mock.invocationCallOrder[1] ?? Infinity;
    const ecriture = tx.trainerStatement.updateMany.mock.invocationCallOrder[0] ?? -Infinity;
    expect(premierVerrou).toBeLessThan(ecriture);
  });

  it("écrit CONDITIONNELLEMENT : seulement si le relevé est encore dans le statut lu", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "a_valider" }));

    await transitionStatementAction({ id: ID, to: "valide" });

    const where = tx.trainerStatement.updateMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ id: ID, statut: "a_valider" });
    expect(tx.trainerStatement.update).not.toHaveBeenCalled();
  });

  it("si le relevé a changé entre-temps : refus, « rechargez », et aucune ligne gelée", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "a_valider" }));
    tx.trainerStatement.updateMany.mockResolvedValue({ count: 0 });

    const res = await transitionStatementAction({ id: ID, to: "valide" });

    expect(res).toEqual({ error: expect.stringMatching(/a changé.*recharge/i) });
    expect(tx.trainerFeeLine.updateMany).not.toHaveBeenCalled();
  });

  it("double clic « payé » : le second ne trouve plus `facture_recue` et est refusé", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({
        statut: "facture_recue",
        numeroFacture: "F-001",
        montantFactureTtcCents: 108_000,
      }),
    );
    tx.trainerStatement.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const a = await transitionStatementAction({ id: ID, to: "paye", moyenPaiement: "virement" });
    const b = await transitionStatementAction({ id: ID, to: "paye", moyenPaiement: "virement" });

    expect(a).toEqual({ data: { id: ID, statut: "paye" } });
    expect(b).toEqual({ error: expect.stringMatching(/a changé.*recharge/i) });
  });
});

describe("C5 — une autofacture émise ne se défait pas", () => {
  it("REFUSE `valide → a_valider` quand une autofacture a été émise", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "valide", autofactureAt: EMISE }));

    const res = await transitionStatementAction({ id: ID, to: "a_valider" });

    expect(res).toEqual({ error: expect.stringMatching(/autofacture/i) });
    expect(res).toEqual({ error: expect.stringMatching(/avoir/i) });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("REFUSE `facture_recue → valide` quand une autofacture a été émise", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({
        statut: "facture_recue",
        autofactureAt: EMISE,
        numeroFacture: "AF-2026-0001",
        montantFactureTtcCents: 108_000,
      }),
    );

    const res = await transitionStatementAction({ id: ID, to: "valide" });

    expect(res).toEqual({ error: expect.stringMatching(/autofacture/i) });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("REFUSE de changer le numéro de facture d'une autofacture", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({
        statut: "facture_recue",
        autofactureAt: EMISE,
        numeroFacture: "AF-2026-0001",
        montantFactureTtcCents: 108_000,
      }),
    );

    const res = await transitionStatementAction({
      id: ID,
      to: "paye",
      moyenPaiement: "virement",
      numeroFacture: "AUTRE-001",
    });

    expect(res).toEqual({ error: expect.stringMatching(/numéro/i) });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("l'écriture conditionnelle vérifie aussi que l'autofacture n'a pas été émise entre-temps", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "valide" }));

    await transitionStatementAction({ id: ID, to: "a_valider" });

    const where = tx.trainerStatement.updateMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ id: ID, statut: "valide", autofactureAt: null });
  });

  it("CONTRE-TÉMOIN : payer une autofacture conforme, numéro inchangé, PASSE", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({
        statut: "facture_recue",
        autofactureAt: EMISE,
        numeroFacture: "AF-2026-0001",
        montantFactureTtcCents: 108_000,
      }),
    );

    const res = await transitionStatementAction({
      id: ID,
      to: "paye",
      moyenPaiement: "virement",
      numeroFacture: "AF-2026-0001",
    });

    expect(res).toEqual({ data: { id: ID, statut: "paye" } });
  });

  it("CONTRE-TÉMOIN : sans autofacture, `valide → a_valider` reste possible", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "valide" }));

    const res = await transitionStatementAction({ id: ID, to: "a_valider" });

    expect(res).toEqual({ data: { id: ID, statut: "a_valider" } });
  });
});

/**
 * ASSEMBLAGE S3 — la transition attend le run, elle ne casse pas sur lui.
 *
 * Le run mensuel tient le verrou de période jusqu'à `DELAI_TRANSACTION_RUN_MS`.
 * Avec les 5 s par défaut de Prisma, une validation lancée pendant un run levait
 * une erreur brute au bout de 5 s.
 */
describe("ASSEMBLAGE S3 — délais de la transaction de transition", () => {
  it("la transaction attend au moins aussi longtemps que le run peut tenir le verrou", async () => {
    const { DELAI_TRANSACTION_RUN_MS, ATTENTE_CONNEXION_RUN_MS } =
      await import("@/server/qualiopi/remuneration/verrou-remuneration");
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "a_valider" }));

    await transitionStatementAction({ id: ID, to: "valide" });

    const options = (mockTransaction.mock.calls[0] as unknown[] | undefined)?.[1] as
      { timeout?: number; maxWait?: number } | undefined;
    expect(options?.timeout).toBeGreaterThan(DELAI_TRANSACTION_RUN_MS);
    expect(options?.maxWait).toBe(ATTENTE_CONNEXION_RUN_MS);
  });

  it("délai dépassé (P2028) : message clair « calcul en cours », pas une erreur brute", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "a_valider" }));
    mockTransaction.mockRejectedValueOnce(
      Object.assign(new Error("Transaction already closed: timeout"), { code: "P2028" }),
    );

    const res = await transitionStatementAction({ id: ID, to: "valide" });

    expect(res).toEqual({
      error: expect.stringMatching(/calcul .*en cours.*réessayez dans une minute/i),
    });
  });

  it("CONTRE-TÉMOIN : une autre erreur garde le message générique", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "a_valider" }));
    mockTransaction.mockRejectedValueOnce(new Error("connexion perdue"));

    const res = await transitionStatementAction({ id: ID, to: "valide" });

    expect(res).toEqual({ error: "Erreur lors du changement de statut." });
  });

  it("le paiement n'écrit que si aucune contestation n'est arrivée entre-temps", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({ statut: "facture_recue", numeroFacture: "F-001", montantFactureTtcCents: 108_000 }),
    );

    await transitionStatementAction({ id: ID, to: "paye", moyenPaiement: "virement" });

    const where = tx.trainerStatement.updateMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ id: ID, statut: "facture_recue", contesteeAt: null });
  });
});
