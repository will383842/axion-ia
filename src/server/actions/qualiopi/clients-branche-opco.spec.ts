/**
 * Lot OPCO A7b — `updateClientAction` reçoit le bloc « Branche et OPCO » de la
 * fiche client : enveloppe (centimes), n° d'adhérent, offre Mobilités,
 * versement volontaire. Même action, mêmes gardes (`requireAdminWrite`,
 * journal) : aucune nouvelle porte d'écriture.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireAdminWrite: vi.fn(),
  log: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
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
  logQualiopiActivity: (...a: unknown[]) => m.log(...a),
}));
vi.mock("@/server/partners-sync/producteurs/client", () => ({
  chargeClientAvant: async () => null,
  emettreFaitClient: async () => undefined,
}));

import { updateClientAction } from "./clients";

const ID = "550e8400-e29b-41d4-a716-446655440077";

function ecrit(): Record<string, unknown> {
  return m.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
}

const jourParis = (): string =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAdminWrite.mockResolvedValue({ userId: "u1", role: "admin" });
  m.log.mockResolvedValue(undefined);
  m.update.mockResolvedValue({ id: ID });
  m.findUnique.mockResolvedValue({ type: "entreprise", nafCode: null, idcc: null });
});

describe("updateClientAction — bloc « Branche et OPCO » (A7b)", () => {
  it("la saisie de l'effectif pose effectifSource = saisie", async () => {
    await updateClientAction({ id: ID, effectif: 9 });
    expect(ecrit().effectif).toBe(9);
    expect(ecrit().effectifSource).toBe("saisie");
  });

  it("l'enveloppe s'écrit en centimes entiers ; null l'efface", async () => {
    await updateClientAction({ id: ID, opcoEnveloppeAnnuelleCents: 250_040 });
    expect(ecrit().opcoEnveloppeAnnuelleCents).toBe(250_040);

    m.update.mockClear();
    await updateClientAction({ id: ID, opcoEnveloppeAnnuelleCents: null });
    expect(ecrit().opcoEnveloppeAnnuelleCents).toBeNull();
  });

  it("refuse une enveloppe non entière (des euros envoyés à la place des centimes)", async () => {
    const r = await updateClientAction({ id: ID, opcoEnveloppeAnnuelleCents: 2500.4 });
    expect("error" in r).toBe(true);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("le n° d'adhérent s'efface avec null", async () => {
    await updateClientAction({ id: ID, opcoNumeroAdherent: null });
    expect(ecrit().opcoNumeroAdherent).toBeNull();
  });

  it("offre Mobilités et versement volontaire : écrits, et datés du jour (Paris)", async () => {
    const r = await updateClientAction({
      id: ID,
      opcoAdhesionOffreMobilites: true,
      opcoVersementVolontaire: false,
    });
    expect("data" in r).toBe(true);
    expect(ecrit().opcoAdhesionOffreMobilites).toBe(true);
    expect(ecrit().opcoVersementVolontaire).toBe(false);
    const le = ecrit().opcoAdhesionsRenseigneesLe as Date;
    expect(le.toISOString()).toBe(`${jourParis()}T00:00:00.000Z`);
    expect(m.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "qualiopi.client.update",
        changes: expect.objectContaining({ opcoAdhesionOffreMobilites: true }),
      }),
    );
  });

  it("une mise à jour sans ces deux faits ne touche pas leur date", async () => {
    await updateClientAction({ id: ID, notes: "x" });
    expect("opcoAdhesionsRenseigneesLe" in ecrit()).toBe(false);
  });

  it("refuse ces faits sur une fiche particulier en base", async () => {
    m.findUnique.mockResolvedValue({ type: "particulier" });
    const r1 = await updateClientAction({ id: ID, opcoVersementVolontaire: true });
    const r2 = await updateClientAction({ id: ID, opcoEnveloppeAnnuelleCents: 100 });
    expect("error" in r1).toBe(true);
    expect("error" in r2).toBe(true);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("lecture seule : la garde d'écriture refuse, rien n'est écrit", async () => {
    m.requireAdminWrite.mockRejectedValue(new Error("Forbidden"));
    await expect(updateClientAction({ id: ID, effectif: 3 })).rejects.toThrow();
    expect(m.update).not.toHaveBeenCalled();
  });
});
