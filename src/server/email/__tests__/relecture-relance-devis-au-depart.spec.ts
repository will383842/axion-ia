// Relecture au départ de `relance-devis-client` : le même module que l'approbation décide.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  unique: vi.fn(),
  count: vi.fn(),
  trace: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findUnique: h.unique, count: h.count },
    activityLog: { findFirst: h.trace },
  },
}));

import { RELECTURES_AU_DEPART } from "../relecture-au-depart";

const lecteur = () => RELECTURES_AU_DEPART.get("relance-devis-client")!;
const job = { template: "relance-devis-client", entityType: "Devis", entityId: "d1" };

beforeEach(() => {
  vi.clearAllMocks();
  h.unique.mockResolvedValue({ statut: "envoye", dateValidite: new Date(Date.now() + 86_400_000) });
  h.count.mockResolvedValue(1);
  h.trace.mockResolvedValue(null);
});

describe("lecteur relance-devis-client", () => {
  it("le gabarit est relu au départ", () => {
    expect(RELECTURES_AU_DEPART.has("relance-devis-client")).toBe(true);
  });
  it("devis encore ouvert : la relance part", async () => {
    expect(await lecteur()(job as never)).toBeNull();
  });
  it("signé, refusé, accepté, périmé : retenue avec le motif du module", async () => {
    h.count.mockResolvedValue(0);
    expect(await lecteur()(job as never)).toMatch(/déjà signé/);
    h.count.mockResolvedValue(1);
    h.unique.mockResolvedValue({ statut: "refuse", dateValidite: new Date(Date.now() + 1e6) });
    expect(await lecteur()(job as never)).toMatch(/refusé/);
    h.unique.mockResolvedValue({ statut: "accepte", dateValidite: new Date(Date.now() + 1e6) });
    expect(await lecteur()(job as never)).toMatch(/accepté/);
    h.unique.mockResolvedValue({ statut: "envoye", dateValidite: new Date(Date.now() - 1e6) });
    expect(await lecteur()(job as never)).toMatch(/validité du devis est dépassée/);
  });
  it("échec fermé : base muette ou devis non lié → retenue", async () => {
    h.unique.mockRejectedValue(new Error("base"));
    expect(await lecteur()(job as never)).toMatch(/retenu par prudence/);
    expect(await lecteur()({ template: "relance-devis-client" } as never)).toMatch(/prudence/);
  });
});
