// @vitest-environment node

/** Lot 4a : reprise des `envoi_en_cours` (10 min) et des lots morts (15 min). */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  lotUpdateMany: vi.fn(),
  dejaEnvoye: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    releveMensuelApporteur: { findMany: m.findMany, updateMany: m.updateMany },
    lotReleveMensuel: { updateMany: m.lotUpdateMany },
  },
}));
vi.mock("../../commissions", () => ({ dejaEnvoye: m.dejaEnvoye }));
vi.mock("../../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ emailsQueue: null }));

import { abandonnerLotsMorts, reprendreEnvoisEnCours } from "../reprise";

const MAINTENANT = new Date("2026-11-03T08:00:00Z");
const PRIS = new Date("2026-11-03T07:30:00Z");
const ligne = { id: "id-1", periode: "2026-10", rang: 0, apporteurId: "a1", prisAt: PRIS };

beforeEach(() => {
  vi.clearAllMocks();
  m.findMany.mockResolvedValue([ligne]);
  m.updateMany.mockResolvedValue({ count: 1 });
  m.dejaEnvoye.mockResolvedValue(false);
});

describe("reprise des envois en cours", () => {
  it("ne regarde que les lignes prises depuis plus de 10 minutes", async () => {
    await reprendreEnvoisEnCours(MAINTENANT, async () => false);
    expect(m.findMany.mock.calls[0]![0].where).toEqual({
      statut: "envoi_en_cours",
      prisAt: { lt: new Date("2026-11-03T07:50:00Z") },
    });
  });

  it("job présent dans la file → `envoye`, avec envoyeAt = prisAt", async () => {
    const r = await reprendreEnvoisEnCours(MAINTENANT, async () => true);
    expect(r).toEqual({ envoyes: 1, echecs: 0 });
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { id: "id-1", statut: "envoi_en_cours" },
      data: {
        statut: "envoye",
        envoyeAt: PRIS,
        emailJobId: "apporteur-releve-mensuel-2026-10-r0-a1",
        erreur: null,
      },
    });
  });

  it("e-mail déjà dans le journal (EmailLog) → `envoye`", async () => {
    m.dejaEnvoye.mockResolvedValue(true);
    const r = await reprendreEnvoisEnCours(MAINTENANT, async () => false);
    expect(r.envoyes).toBe(1);
  });

  it("ni journal ni file → `echec` « envoi interrompu », renvoyable par un clic", async () => {
    const r = await reprendreEnvoisEnCours(MAINTENANT, async () => false);
    expect(r).toEqual({ envoyes: 0, echecs: 1 });
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { id: "id-1", statut: "envoi_en_cours" },
      data: { statut: "echec", erreur: "envoi interrompu" },
    });
  });

  it("une ligne reprise entre-temps par un autre (count 0) n'est pas comptée", async () => {
    m.updateMany.mockResolvedValue({ count: 0 });
    const r = await reprendreEnvoisEnCours(MAINTENANT, async () => true);
    expect(r).toEqual({ envoyes: 0, echecs: 0 });
  });
});

describe("lots morts", () => {
  it("un lot sans fin depuis plus de 15 minutes est marqué `abandonneAt`", async () => {
    m.lotUpdateMany.mockResolvedValue({ count: 1 });
    expect(await abandonnerLotsMorts(MAINTENANT)).toBe(1);
    expect(m.lotUpdateMany).toHaveBeenCalledWith({
      where: { finAt: null, abandonneAt: null, debutAt: { lt: new Date("2026-11-03T07:45:00Z") } },
      data: { abandonneAt: MAINTENANT },
    });
  });
});
