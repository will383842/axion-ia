/** Lot L08 — un questionnaire créé porte la version de ses questions (si le lot est allumé). */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { questionnaire: { findUnique: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/server/qualiopi/documents/qr", () => ({ makeQrToken: vi.fn().mockReturnValue("tok") }));
vi.mock("@/server/qualiopi/evaluations/evaluations-service", () => ({ createEvaluation: vi.fn() }));
vi.mock("@/server/qualiopi/portail/appreciation-service", () => ({ creerAppreciation: vi.fn() }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({ creerOuDedup: vi.fn() }));
vi.mock("./questionnaire-versions", () => ({ versionIdPourNouvelEnvoi: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { creerQuestionnaire } from "../satisfaction/satisfaction-service";
import { versionIdPourNouvelEnvoi } from "./questionnaire-versions";

const q = (
  prisma as unknown as {
    questionnaire: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  }
).questionnaire;
const version = versionIdPourNouvelEnvoi as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  q.findUnique.mockResolvedValue(null);
  q.create.mockResolvedValue({ id: "q1" });
});

describe("creerQuestionnaire × versionnage", () => {
  it("lot allumé : le questionnaire porte la version courante", async () => {
    version.mockResolvedValue("ver-2");
    await creerQuestionnaire({ enrollmentId: "e1", type: "satisfaction_chaud" });
    expect(q.create.mock.calls[0]![0].data.versionId).toBe("ver-2");
    expect(version).toHaveBeenCalledWith("e1", "satisfaction_chaud");
  });

  it("lot éteint : aucune colonne posée, données identiques à avant", async () => {
    version.mockResolvedValue(null);
    await creerQuestionnaire({ enrollmentId: "e1", type: "satisfaction_chaud" });
    expect(Object.keys(q.create.mock.calls[0]![0].data).sort()).toEqual(
      ["enrollmentId", "tokenHash", "type"].sort(),
    );
  });

  it("questionnaire déjà créé : idempotent, version non touchée", async () => {
    q.findUnique.mockResolvedValue({ id: "deja" });
    expect(await creerQuestionnaire({ enrollmentId: "e1", type: "positionnement" })).toEqual({
      id: "deja",
    });
    expect(version).not.toHaveBeenCalled();
  });
});
