import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrat 2.2 (art. 3.4) : une présentation confirmée À LA MAIN (réponse de l'entreprise,
// rendez-vous, « Confirmer l'attribution maintenant ») est protégée six mois à compter de la
// DÉCLARATION, comme la confirmation tacite — jamais à compter de la confirmation.
// Contrat 2.6 : présentations d'avant la 2.6 (toute l'entreprise) ; écriture du SIRET simulée.
vi.mock("../etablissement-presentation", async (orig) => {
  const vrai = await orig<typeof import("../etablissement-presentation")>();
  return {
    ...vrai,
    lireEtablissements: async (ids: readonly string[]) =>
      new Map(ids.map((id) => [id, vrai.AVANT_2_6] as const)),
    enregistrerEtablissement: vi.fn(async () => undefined),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => v,
  encryptPii: (v: string | null) => v,
}));

const h = vi.hoisted(() => ({
  recueAt: new Date("2026-10-04T00:00:00Z"),
  updateMany: vi.fn(async (_a?: unknown) => ({ count: 1 })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: {
      findUnique: vi.fn(async () => ({ recueAt: h.recueAt })),
      updateMany: (a: unknown) => h.updateMany(a),
    },
  },
}));

import { confirmerPresentation } from "../presentations";

beforeEach(() => vi.clearAllMocks());

describe("confirmation saisie en console (contrat 2.2)", () => {
  it("réponse le 20/11 à une déclaration du 04/10 : protégée jusqu'au 04/04, pas au 20/05", async () => {
    const r = await confirmerPresentation(
      "P1",
      new Date("2026-11-20T10:00:00Z"),
      new Date("2026-11-21T10:00:00Z"),
    );
    expect(r).toEqual({ ok: true });
    const data = (h.updateMany.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data["confirmeeAt"]).toEqual(new Date("2026-11-20T10:00:00Z"));
    expect(data["protegeeJusquAt"]).toEqual(new Date("2027-04-04T00:00:00Z"));
  });
});
