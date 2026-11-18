import { beforeEach, describe, expect, it, vi } from "vitest";

import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";

const clientFindUnique = vi.fn();
const devisCreate = vi.fn();
const formulesActives = vi.fn();
const projetOuvrable = vi.fn();
const lierProjet = vi.fn();
const logActivity = vi.fn();
const tx = {
  devis: { create: (...a: unknown[]) => devisCreate(...a), findMany: vi.fn(async () => []) },
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findUnique: (...a: unknown[]) => clientFindUnique(...a) },
    $transaction: async (f: (t: typeof tx) => unknown) => f(tx),
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1" })),
  logQualiopiActivity: (...a: unknown[]) => logActivity(...a),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: (...a: unknown[]) => formulesActives(...a),
}));
vi.mock("@/server/qualiopi/crm/devis-projet", () => ({
  projetOuvrableDuClient: (...a: unknown[]) => projetOuvrable(...a),
  lierDevisAuProjet: (...a: unknown[]) => lierProjet(...a),
}));
vi.mock("@/server/qualiopi/numbering/allocate", () => ({ nextNumero: vi.fn(async () => "N-1") }));
vi.mock("@/server/qualiopi/numbering/retry", () => ({
  withNumberRetry: (f: () => unknown) => f(),
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async () => "assujetti"),
}));

import { creerDevisFormulesAction } from "./devis-formules";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PROJET = "22222222-2222-4222-8222-222222222222";
const appel = (over: Record<string, unknown> = {}) =>
  creerDevisFormulesAction({
    clientId: CLIENT,
    offre: offreFictive(),
    activite: "implementation",
    ...over,
  } as never);

beforeEach(() => {
  for (const m of [
    clientFindUnique,
    devisCreate,
    formulesActives,
    projetOuvrable,
    lierProjet,
    logActivity,
  ])
    m.mockReset();
  formulesActives.mockResolvedValue(true);
  clientFindUnique.mockResolvedValue({ type: "entreprise" });
  projetOuvrable.mockResolvedValue(true);
  devisCreate.mockResolvedValue({ id: "d1", numero: "N-1" });
});

describe("creerDevisFormulesAction", () => {
  it("interrupteur éteint : inerte, ni lecture ni écriture", async () => {
    formulesActives.mockResolvedValue(false);
    const r = await appel();
    expect("error" in r && r.error).toMatch(/pas activé/);
    expect(clientFindUnique).not.toHaveBeenCalled();
    expect(devisCreate).not.toHaveBeenCalled();
  });
  it("stub.invalid : inerte", async () => {
    const avant = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      expect("error" in (await appel())).toBe(true);
      expect(devisCreate).not.toHaveBeenCalled();
    } finally {
      if (avant === undefined) delete process.env["DATABASE_URL"];
      else process.env["DATABASE_URL"] = avant;
    }
  });
  it("client inexistant : message clair, aucune écriture (pas d'erreur de clé étrangère)", async () => {
    clientFindUnique.mockResolvedValue(null);
    const r = await appel();
    expect("error" in r && r.error).toMatch(/client.*introuvable/i);
    expect(devisCreate).not.toHaveBeenCalled();
  });
  it("client particulier : refusé (offre réservée aux professionnels)", async () => {
    clientFindUnique.mockResolvedValue({ type: "particulier" });
    const r = await appel();
    expect("error" in r && r.error).toMatch(/professionnel/i);
    expect(devisCreate).not.toHaveBeenCalled();
  });
  it("crée le brouillon avec l'offre, son empreinte et l'activité", async () => {
    const r = await appel();
    expect(r).toEqual({ data: { id: "d1", numero: "N-1" } });
    const data = devisCreate.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      clientId: CLIENT,
      statut: "brouillon",
      activite: "implementation",
    });
    expect(data.offreSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(lierProjet).not.toHaveBeenCalled();
  });
  it("projetId : vérifié puis lié dans la transaction du devis", async () => {
    await appel({ projetId: PROJET });
    expect(projetOuvrable).toHaveBeenCalledWith(expect.anything(), PROJET, CLIENT);
    expect(lierProjet).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        devisId: "d1",
        projetId: PROJET,
        clientId: CLIENT,
        lieParId: "adm-1",
      }),
    );
  });
  it("projet d'un autre client : refus, aucune écriture", async () => {
    projetOuvrable.mockResolvedValue(false);
    const r = await appel({ projetId: PROJET });
    expect("error" in r && r.error).toMatch(/projet/i);
    expect(devisCreate).not.toHaveBeenCalled();
  });
});
