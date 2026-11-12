/**
 * Correctifs avant allumage du devis à formules : envoi refusé tant que la signature des
 * formules n'est pas livrée, révision qui recopie l'offre.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const create = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      findMany: vi.fn(async () => []),
    },
    $transaction: async (f: (t: unknown) => unknown) =>
      f({ devis: { create: (...a: unknown[]) => create(...a), findMany: vi.fn(async () => []) } }),
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => false,
}));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));
const lireContexte = vi.fn();
vi.mock("@/server/qualiopi/documents/donnees-pdf-devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/donnees-pdf-devis")>()),
  lireContextePdfDevis: (...a: unknown[]) => lireContexte(...a),
  donneesPdfDevis: vi.fn(() => {
    throw new Error("interception du test");
  }),
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async () => "assujetti"),
}));
vi.mock("@/server/qualiopi/numbering/allocate", () => ({
  nextNumero: vi.fn(async () => "AXI-DEV-2026-002"),
}));
vi.mock("@/server/qualiopi/numbering/retry", () => ({
  withNumberRetry: (f: () => unknown) => f(),
}));
vi.mock("@/server/qualiopi/crm/devis-projet", () => ({
  recopierLienProjet: vi.fn(),
  lierDevisAuProjet: vi.fn(),
  projetOuvrableDuClient: vi.fn(),
}));

import { reviseDevisAction, sendDevisAction } from "./devis";

const ID = "550e8400-e29b-41d4-a716-446655440001";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("sendDevisAction — offre à formules", () => {
  it("interrupteur éteint : refuse l'envoi d'un devis portant une offre, avec un message clair", async () => {
    findUnique.mockResolvedValue({
      id: ID,
      numero: "AXI-DEV-2026-001",
      clientId: "c1",
      statut: "brouillon",
      montantTotalHtCents: 150000,
      lignes: [],
      offre: { v: 1 },
      client: { type: "entreprise", raisonSociale: "Client SA" },
    });
    const r = await sendDevisAction(ID);
    expect("error" in r && r.error).toMatch(/formules/i);
    expect("error" in r && r.error).toMatch(/désactivés/i);
    expect(lireContexte).not.toHaveBeenCalled();
  });
  it("la lecture du devis demande bien la colonne offre", async () => {
    findUnique.mockResolvedValue(null);
    await sendDevisAction(ID);
    expect(findUnique.mock.calls[0]![0].select.offre).toBe(true);
  });
});

describe("reviseDevisAction — offre à formules", () => {
  const origine = (over: Record<string, unknown> = {}) => ({
    id: ID,
    numero: "AXI-DEV-2026-001",
    statut: "envoye",
    clientId: "c1",
    lignes: [],
    activite: "implementation",
    refClient: null,
    financementSuggere: null,
    mentionTva: "m",
    montantTotalHtCents: 0,
    montantOpcoEstimeCents: null,
    opcoEstimationOrigine: null,
    opcoEstimationAvertissement: null,
    resteAChargeCents: null,
    ...over,
  });
  it("recopie offre et offreSha256", async () => {
    findUnique.mockResolvedValue(origine({ offre: { v: 1, x: 1 }, offreSha256: "a".repeat(64) }));
    create.mockResolvedValue({ id: "n1", numero: "AXI-DEV-2026-002" });
    await reviseDevisAction(ID).catch(() => undefined);
    expect(findUnique.mock.calls[0]![0].select).toMatchObject({ offre: true, offreSha256: true });
    const data = create.mock.calls[0]![0].data;
    expect(data.offre).toEqual({ v: 1, x: 1 });
    expect(data.offreSha256).toBe("a".repeat(64));
  });
  it("devis classique : aucune clé offre posée", async () => {
    findUnique.mockResolvedValue(origine({ offre: null, offreSha256: null }));
    create.mockResolvedValue({ id: "n1", numero: "AXI-DEV-2026-002" });
    await reviseDevisAction(ID).catch(() => undefined);
    const data = create.mock.calls[0]![0].data;
    expect("offre" in data).toBe(false);
    expect("offreSha256" in data).toBe(false);
  });
});
