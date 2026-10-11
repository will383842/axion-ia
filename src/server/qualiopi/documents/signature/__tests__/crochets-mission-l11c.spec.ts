/**
 * Lot L11c — les crochets de signature réveillent le moteur des missions ;
 * interrupteurs coupés, ils ne lisent rien (comportement d'avant).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  allume: false,
  prisma: {
    documentGenere: { findUnique: vi.fn(async () => ({ sessionId: "s-1" })) },
    missionFormateur: { findFirst: vi.fn(async () => ({ id: "m-1" })) },
  },
  reevaluer: vi.fn(async () => ({ etape: null, action: "rien" })),
  session: vi.fn(async () => 1),
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/qualiopi/formateurs-independants/moteur-mission", () => ({
  moteurAllume: vi.fn(async () => h.allume),
  reevaluerMission: h.reevaluer,
  reevaluerMissionsDeLaSession: h.session,
}));

import { lettreDue, reevaluerMission } from "../crochets-mission";

beforeEach(() => {
  vi.clearAllMocks();
  h.allume = false;
});

describe("crochets de la lettre de mission", () => {
  it("coupés : aucune lecture, aucun réveil", async () => {
    await lettreDue("d-1");
    await reevaluerMission("d-1");
    expect(h.prisma.documentGenere.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.missionFormateur.findFirst).not.toHaveBeenCalled();
    expect(h.session).not.toHaveBeenCalled();
    expect(h.reevaluer).not.toHaveBeenCalled();
  });
  it("allumés : la convention signée réveille les missions de la session ; la lettre signée, sa mission", async () => {
    h.allume = true;
    await lettreDue("d-1");
    expect(h.session).toHaveBeenCalledWith("s-1", "convention", expect.any(Date));
    await reevaluerMission("d-2");
    expect(h.reevaluer).toHaveBeenCalledWith("m-1", "signature_lettre", expect.any(Date));
  });
});
