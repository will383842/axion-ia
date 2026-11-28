// @vitest-environment node

/** Lots 3c et 4a : les Server Actions refusent sans session, sans le droit de facturer, sans confirmation. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  session: null as unknown,
  envoyerLot: vi.fn(),
  preparer: vi.fn(),
  ecarter: vi.fn(),
  recalculer: vi.fn(),
  retablir: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: async () => m.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("../envoi", () => ({ envoyerLot: m.envoyerLot }));
vi.mock("../preparation", () => ({
  preparerTranche: m.preparer,
  ecarterReleve: m.ecarter,
  recalculerReleve: m.recalculer,
  retablirReleve: m.retablir,
}));

import { envoyerATousAction, renvoyerEchecsAction } from "../actions-envoi";
import { ecarterReleveAction, preparerRelevesAction } from "../actions-preparation";

const INITIAL = { etat: "initial" } as const;
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  m.session = { user: { id: "admin-1", role: "super_admin" } };
  m.envoyerLot.mockResolvedValue({
    ok: true,
    message: "3 relevé(s) envoyé(s).",
    nbEchecs: 0,
    nbBloques: 0,
  });
  m.preparer.mockResolvedValue({ crees: 2, reste: 0, echecs: [] });
});

describe("envoyer à tout le monde", () => {
  it("sans session : refus, rien n'est envoyé", async () => {
    m.session = null;
    const r = await envoyerATousAction(
      INITIAL,
      fd({ periode: "2026-10", confirmation: "2026-10" }),
    );
    expect(r.etat).toBe("erreur");
    expect(m.envoyerLot).not.toHaveBeenCalled();
  });

  it("rôle sans le droit de facturer (consultation) : refus", async () => {
    m.session = { user: { id: "u2", role: "reader" } };
    const r = await envoyerATousAction(
      INITIAL,
      fd({ periode: "2026-10", confirmation: "2026-10" }),
    );
    expect(r.etat).toBe("erreur");
    expect(m.envoyerLot).not.toHaveBeenCalled();
  });

  it("confirmation absente ou fausse : refus", async () => {
    for (const confirmation of ["", "2026-09", "oui"]) {
      const r = await envoyerATousAction(INITIAL, fd({ periode: "2026-10", confirmation }));
      expect(r.etat).toBe("erreur");
    }
    expect(m.envoyerLot).not.toHaveBeenCalled();
  });

  it("période illisible : refus", async () => {
    const r = await envoyerATousAction(
      INITIAL,
      fd({ periode: "2026-13", confirmation: "2026-13" }),
    );
    expect(r.etat).toBe("erreur");
    expect(m.envoyerLot).not.toHaveBeenCalled();
  });

  it("confirmation exacte : le lot part, tracé au nom de l'administrateur qui a cliqué", async () => {
    const r = await envoyerATousAction(
      INITIAL,
      fd({ periode: "2026-10", confirmation: "2026-10" }),
    );
    expect(r.etat).toBe("ok");
    expect(m.envoyerLot).toHaveBeenCalledWith({
      periode: "2026-10",
      declenchePar: "console:admin-1",
      mode: "tous",
    });
  });

  it("un lot avec échecs ou blocages n'est PAS présenté comme un succès", async () => {
    m.envoyerLot.mockResolvedValue({
      ok: true,
      message: "2 envoyé(s), 1 en échec.",
      nbEchecs: 1,
      nbBloques: 0,
    });
    const r = await envoyerATousAction(
      INITIAL,
      fd({ periode: "2026-10", confirmation: "2026-10" }),
    );
    expect(r.etat).toBe("erreur");
  });

  it("« Renvoyer les échecs » : même garde de rôle, mode `echecs`, sans saisie de confirmation", async () => {
    await renvoyerEchecsAction(INITIAL, fd({ periode: "2026-10" }));
    expect(m.envoyerLot).toHaveBeenCalledWith(expect.objectContaining({ mode: "echecs" }));
    m.envoyerLot.mockClear();
    m.session = { user: { id: "u2", role: "reader" } };
    await renvoyerEchecsAction(INITIAL, fd({ periode: "2026-10" }));
    expect(m.envoyerLot).not.toHaveBeenCalled();
  });
});

describe("préparer et écarter", () => {
  it("un compte de consultation ne prépare ni n'écarte", async () => {
    m.session = { user: { id: "u2", role: "reader" } };
    expect((await preparerRelevesAction(INITIAL, fd({ periode: "2026-10" }))).etat).toBe("erreur");
    expect(
      (await ecarterReleveAction(INITIAL, fd({ id: ID, periode: "2026-10", motif: "x" }))).etat,
    ).toBe("erreur");
    expect(m.preparer).not.toHaveBeenCalled();
    expect(m.ecarter).not.toHaveBeenCalled();
  });

  it("préparer n'appelle JAMAIS l'envoi", async () => {
    const r = await preparerRelevesAction(INITIAL, fd({ periode: "2026-10" }));
    expect(r.etat).toBe("ok");
    expect(m.preparer).toHaveBeenCalled();
    expect(m.envoyerLot).not.toHaveBeenCalled();
  });
});
