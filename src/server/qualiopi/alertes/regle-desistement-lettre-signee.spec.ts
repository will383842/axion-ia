import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ allume: true, lues: [] as unknown[], findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { missionFormateur: { findMany: h.findMany } } }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-envoi", () => ({
  envoiAllume: async () => h.allume,
}));

import {
  candidatsDesistementLettreSignee,
  regleDesistementLettreSignee,
} from "./regle-desistement-lettre-signee";

const NOW = new Date("2026-10-13T08:00:00Z");
const ligne = (incidents: Array<{ trainerId: string | null }>, session = "s1") => ({
  trainerId: "t1",
  session: {
    id: session,
    numero: "S-1",
    titreSession: "IA",
    dateDebut: new Date("2026-11-04T08:00:00Z"),
    incidents,
  },
});

beforeEach(() => {
  h.allume = true;
  h.findMany.mockReset();
});

describe("désistement après lettre signée — la décision préparée", () => {
  it("une alerte par session, sans nom, avec les deux issues", () => {
    const a = candidatsDesistementLettreSignee([
      { sessionId: "s1", numero: "S-1", titre: "IA", debutLe: NOW },
      { sessionId: "s1", numero: "S-1", titre: "IA", debutLe: NOW },
    ]);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({
      code: "formateur_desistement_lettre_signee",
      cibleType: "TrainingSession",
      cibleId: "s1",
    });
    expect(a[0]!.message).toMatch(/annuler la lettre/);
    expect(a[0]!.message).toMatch(/incident/);
    expect(a[0]!.message).not.toMatch(/€|indemnit|honoraires/i);
  });

  it("éteinte quand lettre_auto est coupé : rien n'est lu", async () => {
    h.allume = false;
    expect(await regleDesistementLettreSignee(NOW)).toEqual([]);
    expect(h.findMany).not.toHaveBeenCalled();
  });

  it("se referme quand un incident visant ce formateur est consigné", async () => {
    h.findMany.mockResolvedValue([ligne([]), ligne([{ trainerId: "t1" }], "s2")]);
    const a = await regleDesistementLettreSignee(NOW);
    expect(a.map((x) => x.cibleId)).toEqual(["s1"]);
  });

  it("un incident visant quelqu'un d'autre ne ferme pas l'alerte", async () => {
    h.findMany.mockResolvedValue([ligne([{ trainerId: "autre" }])]);
    expect(await regleDesistementLettreSignee(NOW)).toHaveLength(1);
  });
});
