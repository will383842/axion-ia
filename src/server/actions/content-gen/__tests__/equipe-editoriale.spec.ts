import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const reviewFindUnique = vi.fn();
const activityCount = vi.fn();
const approveMock = vi.fn();
const requestEditsMock = vi.fn();
const logMock = vi.fn();
const persistMock = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true, count: 1 }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reviewQueue: {
      findUnique: (a: unknown) => reviewFindUnique(a),
      findMany: vi.fn(async () => []),
    },
    activityLog: { count: (a: unknown) => activityCount(a) },
  },
}));
vi.mock("@/server/content-gen/config-store", () => ({
  persistContentGenConfig: (...a: unknown[]) => persistMock(...a),
  readContentGenConfigDirect: async (_k: string, d: unknown) => d,
}));
vi.mock("@/server/content-gen/shared/activity-log", () => ({
  logActivity: (a: unknown) => logMock(a),
}));
vi.mock("../review", () => ({
  approveReview: (...a: unknown[]) => approveMock(...a),
  requestEdits: (...a: unknown[]) => requestEditsMock(...a),
}));

import {
  definirMarcheEquipe,
  definirQuotasEquipe,
  getPilotageEquipe,
  publierArticleEquipe,
  renvoyerArticleEquipe,
} from "../equipe-editoriale";

const admin = () =>
  authMock.mockResolvedValue({ user: { id: "u1", email: "a@x.fr", role: "admin" } });
const aRelire = {
  status: "pending",
  jobId: "j1",
  job: { outputJsonRaw: { equipe: { issue: "a_relire" } } },
};

beforeEach(() => {
  vi.clearAllMocks();
  admin();
  reviewFindUnique.mockResolvedValue(aRelire);
  activityCount.mockResolvedValue(0);
});

describe("accès réservé à l'administration", () => {
  it("non-admin refusé sur toutes les actions", async () => {
    authMock.mockResolvedValue({ user: { id: "u2", email: "l@x.fr", role: "reader" } });
    await expect(getPilotageEquipe()).rejects.toThrow("forbidden");
    await expect(definirMarcheEquipe(true)).rejects.toThrow("forbidden");
    await expect(definirQuotasEquipe({ articlesMaxJour: 1, majMaxJour: 1 })).rejects.toThrow(
      "forbidden",
    );
    await expect(publierArticleEquipe("r1")).rejects.toThrow("forbidden");
    await expect(renvoyerArticleEquipe("r1")).rejects.toThrow("forbidden");
    expect(approveMock).not.toHaveBeenCalled();
    expect(persistMock).not.toHaveBeenCalled();
  });
  it("non connecté refusé", async () => {
    authMock.mockResolvedValue(null);
    await expect(getPilotageEquipe()).rejects.toThrow("unauthorized");
  });
});

describe("quotas", () => {
  it("hors bornes : rien n'est écrit", async () => {
    await expect(definirQuotasEquipe({ articlesMaxJour: 11, majMaxJour: 1 })).rejects.toThrow();
    await expect(definirQuotasEquipe({ articlesMaxJour: 1, majMaxJour: 6 })).rejects.toThrow();
    expect(persistMock).not.toHaveBeenCalled();
  });
  it("dans les bornes : écrit sous les clés existantes et tracé", async () => {
    await definirQuotasEquipe({ articlesMaxJour: 10, majMaxJour: 5 });
    const cles = persistMock.mock.calls.map((c) => [c[0], c[1]]);
    expect(cles).toEqual([
      ["equipe_articles_max_jour", 10],
      ["equipe_maj_max_jour", 5],
    ]);
    expect(logMock).toHaveBeenCalledTimes(1);
  });
});

describe("marche / arrêt", () => {
  it("écrit equipe_marche et trace qui", async () => {
    await definirMarcheEquipe(false);
    expect(persistMock.mock.calls[0]![0]).toBe("equipe_marche");
    expect(persistMock.mock.calls[0]![1]).toMatchObject({ marche: false, par: "a@x.fr" });
    expect(logMock.mock.calls[0]![0]).toMatchObject({ action: "content-gen.equipe.marche" });
  });
});

describe("Publier", () => {
  it("réutilise approveReview (chemin existant) et trace l'action", async () => {
    await publierArticleEquipe("r1");
    expect(approveMock).toHaveBeenCalledWith("r1", expect.any(String));
    expect(logMock.mock.calls[0]![0]).toMatchObject({
      action: "content-gen.equipe.publier",
      session: { userId: "u1", email: "a@x.fr" },
    });
  });
  it("refuse un article qui n'est pas « à relire » de l'équipe", async () => {
    reviewFindUnique.mockResolvedValue({ ...aRelire, job: { outputJsonRaw: { title: "x" } } });
    await expect(publierArticleEquipe("r1")).rejects.toThrow("review_not_a_relire");
    expect(approveMock).not.toHaveBeenCalled();
  });
});

describe("Renvoyer en correction", () => {
  it("un renvoi via requestEdits, tracé", async () => {
    await renvoyerArticleEquipe("r1");
    expect(requestEditsMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0]![0]).toMatchObject({ action: "content-gen.equipe.renvoyer" });
  });
  it("au plus 1 renvoi depuis la console", async () => {
    activityCount.mockResolvedValue(1);
    await expect(renvoyerArticleEquipe("r1")).rejects.toThrow("renvoi_deja_fait");
    expect(requestEditsMock).not.toHaveBeenCalled();
  });
});
