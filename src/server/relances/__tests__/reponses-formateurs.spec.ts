// Lot 8A (#1511) — la lecture des réponses des formateurs pour arrêter leurs relances.
import { beforeEach, describe, expect, it, vi } from "vitest";

const trainerFindMany = vi.fn();
const reponsesFindMany = vi.fn();
let allume = false;
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: { findMany: (...a: unknown[]) => trainerFindMany(...a) },
    reponseEntranteFormateur: { findMany: (...a: unknown[]) => reponsesFindMany(...a) },
  },
}));
vi.mock("@/server/email/outbox-service", () => ({ jobIdDejaGare: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: async () => ({ reponses_formateurs: allume }),
}));

import { reponsesFormateurs } from "../passer-campagnes";

const DEPUIS = new Date("2026-10-01T00:00:00Z");

beforeEach(() => {
  trainerFindMany.mockReset().mockResolvedValue([{ id: "t2", candidatureId: "c2" }]);
  reponsesFindMany.mockReset().mockResolvedValue([]);
  allume = false;
});

describe("reponsesFormateurs", () => {
  it("interrupteur `reponses_formateurs` coupé : aucune lecture, carte vide", async () => {
    const r = await reponsesFormateurs(["t1"], DEPUIS);
    expect(r?.size).toBe(0);
    expect(trainerFindMany).not.toHaveBeenCalled();
    expect(reponsesFindMany).not.toHaveBeenCalled();
  });

  it("allumé : réponses humaines seules, rangées sur la fiche OU sur sa candidature", async () => {
    allume = true;
    const a = new Date("2026-10-05T10:00:00Z");
    const b = new Date("2026-10-06T10:00:00Z");
    reponsesFindMany.mockResolvedValue([
      { trainerId: "t1", candidatureId: null, recuLe: a },
      { trainerId: null, candidatureId: "c2", recuLe: b },
      { trainerId: null, candidatureId: "inconnue", recuLe: b },
    ]);
    const r = await reponsesFormateurs(["t1", "t2"], DEPUIS);
    expect(r?.get("t1")).toEqual([a]);
    expect(r?.get("t2")).toEqual([b]);
    expect(r?.size).toBe(2);
    const where = reponsesFindMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ auto: false, recuLe: { gte: DEPUIS } });
  });

  it("base en panne : `null` (inconnu)", async () => {
    allume = true;
    reponsesFindMany.mockRejectedValue(new Error("panne"));
    expect(await reponsesFormateurs(["t1"], DEPUIS)).toBeNull();
  });
});
