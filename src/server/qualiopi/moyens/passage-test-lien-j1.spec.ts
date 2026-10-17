/**
 * Tests — moyens/passage-test-lien-j1.ts (chantier QNC, lot L07).
 */

import { describe, expect, it, vi } from "vitest";

import { passerTestLienJ1 } from "./passage-test-lien-j1";

const SID = "11111111-1111-4111-8111-111111111111";
const DEBUT = new Date("2026-10-20T06:00:00.000Z");
const VEILLE = new Date("2026-10-19T09:00:00.000Z");

function deps(
  sessions: Array<{
    id: string;
    dateDebut: Date;
    lieuVisioUrl: string | null;
    estTestInterne: boolean;
  }>,
  dejaReussi = false,
) {
  const findMany = vi.fn().mockResolvedValue(sessions);
  const create = vi.fn().mockResolvedValue({});
  return {
    findMany,
    create,
    d: {
      trainingSession: { findMany },
      activityLog: {
        create,
        findFirst: vi.fn().mockResolvedValue(dejaReussi ? { id: "x" } : null),
      },
    },
  };
}
const S = {
  id: SID,
  dateDebut: DEBUT,
  lieuVisioUrl: "https://zoom.us/j/123456789",
  estTestInterne: false,
};
const OK = vi.fn().mockResolvedValue({ status: 200 });

describe("passerTestLienJ1", () => {
  it("éteint : ne lit rien, n'écrit rien", async () => {
    const x = deps([S]);
    const b = await passerTestLienJ1(x.d, "eteint", VEILLE, OK);
    expect(b.allume).toBe(false);
    expect(x.findMany).not.toHaveBeenCalled();
    expect(x.create).not.toHaveBeenCalled();
  });
  it("actif : teste la veille du début et journalise le résultat", async () => {
    const x = deps([S]);
    const b = await passerTestLienJ1(x.d, "actif", VEILLE, OK);
    expect(b).toEqual({ allume: true, testees: 1, reussis: 1, alertes: 0 });
    expect(x.create.mock.calls[0]![0].data.action).toBe("qualiopi.moyens.test_lien_j1");
    expect(x.create.mock.calls[0]![0].data.changes).toMatchObject({ ok: true });
  });
  it("ne teste pas avant la veille", async () => {
    const x = deps([S]);
    const b = await passerTestLienJ1(x.d, "actif", new Date("2026-10-18T09:00:00Z"), OK);
    expect(b.testees).toBe(0);
  });
  it("lien absent : alerte journalisée", async () => {
    const x = deps([{ ...S, lieuVisioUrl: null }]);
    const b = await passerTestLienJ1(x.d, "actif", VEILLE, OK);
    expect(b.alertes).toBe(1);
    expect(x.create.mock.calls[0]![0].data.changes).toMatchObject({
      ok: false,
      raison: "manquant",
    });
  });
  it("essai : seulement le banc d'essai", async () => {
    const x = deps([S, { ...S, id: "22222222-2222-4222-8222-222222222222", estTestInterne: true }]);
    const b = await passerTestLienJ1(x.d, "essai", VEILLE, OK);
    expect(b.testees).toBe(1);
  });
  it("test déjà réussi aujourd'hui : non refait", async () => {
    const x = deps([S], true);
    expect((await passerTestLienJ1(x.d, "actif", VEILLE, OK)).testees).toBe(0);
  });
});
