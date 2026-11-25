// « L'entreprise dit ne pas connaître l'apporteur » sur une présentation DÉJÀ confirmée :
// le statut passe à `dementie` et l'e-mail « non retenue » est annoncé (motif neutre).
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  updateMany: vi.fn(),
  annoncerRefus: vi.fn(async () => true),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { presentationEntreprise: { updateMany: h.updateMany } },
}));
vi.mock("../refus-annonce", () => ({ annoncerRefus: h.annoncerRefus }));

import { dementirPresentation } from "../presentations";

describe("dementirPresentation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepte une présentation confirmée, pose `dementie` et annonce le refus", async () => {
    h.updateMany.mockResolvedValue({ count: 1 });
    expect(await dementirPresentation("p1")).toEqual({ ok: true });
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", statut: { in: ["reservee", "confirmee"] } },
      data: { statut: "dementie" },
    });
    expect(h.annoncerRefus).toHaveBeenCalledWith("p1", "dementie");
  });

  it("présentation plus en cours : rien n'est annoncé", async () => {
    h.updateMany.mockResolvedValue({ count: 0 });
    expect((await dementirPresentation("p1")).ok).toBe(false);
    expect(h.annoncerRefus).not.toHaveBeenCalled();
  });
});
