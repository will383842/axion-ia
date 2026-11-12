// Les anciens liens `op1` restent valables SANS DATE DE FIN (plan « jeton op2 », J1).
// Un e-mail de 2026 ouvert en 2040 doit encore permettre de dire « stop ».

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const create = vi.fn();
const lireMarques = vi.fn();

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmSyncOutbox: { findFirst: vi.fn().mockResolvedValue({ id: "ob" }) },
    emailOpposition: {
      findUnique: (...a: unknown[]) =>
        (a[0] as { where: { id?: string } }).where.id !== undefined
          ? lireMarques(...a)
          : findUnique(...a),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: (...a: unknown[]) => create(...a),
    },
  },
}));
vi.mock("@/server/crm-sync", () => ({
  syncNewsletterOptOutToCrm: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: vi.fn().mockResolvedValue(0),
}));

import { enregistrerOpposition } from "../opposition";
import { jetonOppositionOp2, lireJetonOpposition } from "../opposition-jeton";

// Jeton `op1` FIGÉ, calculé une fois avec AUTH_SECRET = SECRET_AUTH ci-dessous. S'il
// cesse d'être lu, c'est le code qui a changé — pas le test à régénérer.
const SECRET_AUTH = "secret-de-test-op1-figé";
const OP1_FIGE = "op1.c3RvcEBleGVtcGxlLmZy.4i7Rj8urt0BFzMVPUGXKVwBm9B-mPbTz";

beforeEach(() => {
  process.env["AUTH_SECRET"] = SECRET_AUTH;
  process.env["OPPOSITION_JETON_SECRET"] = "secret-dedie-op2-suffisamment-long-0123456789";
  findUnique.mockReset().mockResolvedValue(null);
  create.mockReset().mockResolvedValue({ id: "opp-1" });
  lireMarques.mockReset().mockResolvedValue({ crmEnAttenteDepuis: null, crmInterditLe: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
});

describe("op1 à vie", () => {
  it("un op1 figé se lit aujourd'hui et en 2040", () => {
    expect(lireJetonOpposition(OP1_FIGE)).toBe("stop@exemple.fr");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2040-01-01"));
    expect(lireJetonOpposition(OP1_FIGE)).toBe("stop@exemple.fr");
  });

  it("un op1 se lit encore quand le secret dédié op2 est absent", () => {
    delete process.env["OPPOSITION_JETON_SECRET"];
    expect(lireJetonOpposition(OP1_FIGE)).toBe("stop@exemple.fr");
  });

  it("🔴 op1 et op2 de la même adresse posent UNE seule ligne d'opposition", async () => {
    const op2 = jetonOppositionOp2("stop@exemple.fr")!;
    const premier = await enregistrerOpposition(OP1_FIGE);
    expect(premier).toMatchObject({ ok: true, dejaOpposee: false });
    expect(create).toHaveBeenCalledTimes(1);
    const hash = (create.mock.calls[0]![0] as { data: { emailHash: string } }).data.emailHash;
    // La ligne existe maintenant : la seconde porte rend « déjà opposée », sans créer.
    findUnique.mockResolvedValue({ id: "opp-1" });
    const second = await enregistrerOpposition(op2);
    expect(second).toMatchObject({ ok: true, dejaOpposee: true });
    expect(create).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { emailHash: hash } }),
    );
  });
});
